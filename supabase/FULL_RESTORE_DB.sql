-- ==============================================================================
-- FESTALOG - SCRIPT DE RECUPERAÇÃO/RESTAURAÇÃO COMPLETA DO BANCO DE DADOS
-- DATA: 2026-01-30
-- AUTOR: Antigravity (Via solicitação do usuário)
--
-- INSTRUÇÕES:
-- 1. Este arquivo contém a concatenação de todos os scripts de estrutura e migração 
--    do projeto Festalog, na ordem correta de execução.
-- 2. Copie todo o conteúdo abaixo e cole no SQL Editor do Supabase Dashboard.
-- 3. Execute o script.
-- 
-- ATENÇÃO:
-- Se o banco de dados já contiver tabelas, alguns comandos podem falhar se não
-- tiverem a cláusula "IF NOT EXISTS". Recomenda-se rodar em um banco limpo
-- ou ignorar erros de objetos já existentes.
-- ==============================================================================

-- ##############################################################################
-- 1. ESTRUTURA BASE (schema.sql)
-- ##############################################################################

-- Criar ENUM para status do pedido
CREATE TYPE status_pedido AS ENUM (
  'orcamento',
  'contrato_enviado',
  'assinado',
  'pago_50',
  'entregue',
  'recolhido',
  'finalizado'
);

-- Criar ENUM para categoria de produto
CREATE TYPE categoria_produto AS ENUM (
  'mesas',
  'cadeiras',
  'toalhas',
  'caixa_termica',
  'outros'
);

-- =============================================
-- TABELA: clientes
-- =============================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  endereco_completo TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  cpf TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_whatsapp ON clientes(whatsapp);

-- =============================================
-- TABELA: produtos
-- =============================================
CREATE TABLE IF NOT EXISTS produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  quantidade_total INTEGER NOT NULL DEFAULT 0,
  preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  categoria categoria_produto NOT NULL DEFAULT 'outros',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);

-- =============================================
-- TABELA: pedidos
-- =============================================
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  data_evento DATE NOT NULL,
  status status_pedido NOT NULL DEFAULT 'orcamento',
  total_pedido DECIMAL(10,2) NOT NULL DEFAULT 0,
  data_entrega TIMESTAMPTZ,
  data_recolhimento TIMESTAMPTZ,
  observacoes TEXT,
  assinatura_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_evento ON pedidos(data_evento);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_entrega ON pedidos(data_entrega);

-- =============================================
-- TABELA: itens_pedido
-- =============================================
CREATE TABLE IF NOT EXISTS itens_pedido (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido ON itens_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_produto ON itens_pedido(produto_id);

-- =============================================
-- TABELA: rotas
-- =============================================
CREATE TABLE IF NOT EXISTS rotas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  motorista TEXT,
  ordem_entregas JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rotas_data ON rotas(data);

-- =============================================
-- FUNÇÃO: calcular_disponibilidade (Versão Base - Será atualizada depois)
-- =============================================
CREATE OR REPLACE FUNCTION calcular_disponibilidade(data_consulta DATE)
RETURNS TABLE (
  produto_id UUID,
  nome TEXT,
  quantidade_total INTEGER,
  quantidade_reservada BIGINT,
  quantidade_disponivel BIGINT
) AS $$
DECLARE
  hoje DATE := CURRENT_DATE;
BEGIN
  RETURN QUERY
  SELECT 
    p.id as produto_id,
    p.nome,
    p.quantidade_total,
    COALESCE(SUM(
      CASE 
        WHEN ped.id IS NOT NULL 
             AND ped.status IN ('pago_50', 'entregue')
             AND (ped.data_evento = data_consulta OR ped.data_evento < hoje)
        THEN ip.quantidade 
        ELSE 0 
      END
    ), 0)::BIGINT as quantidade_reservada,
    (p.quantidade_total - COALESCE(SUM(
      CASE 
        WHEN ped.id IS NOT NULL 
             AND ped.status IN ('pago_50', 'entregue')
             AND (ped.data_evento = data_consulta OR ped.data_evento < hoje)
        THEN ip.quantidade 
        ELSE 0 
      END
    ), 0))::BIGINT as quantidade_disponivel
  FROM produtos p
  LEFT JOIN itens_pedido ip ON ip.produto_id = p.id
  LEFT JOIN pedidos ped ON ip.pedido_id = ped.id
  GROUP BY p.id, p.nome, p.quantidade_total
  ORDER BY p.nome;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FUNÇÃO: atualizar_total_pedido
-- Trigger para atualizar o total do pedido automaticamente
-- =============================================
CREATE OR REPLACE FUNCTION atualizar_total_pedido()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pedidos
  SET total_pedido = (
    SELECT COALESCE(SUM(quantidade * preco_unitario), 0)
    FROM itens_pedido
    WHERE pedido_id = COALESCE(NEW.pedido_id, OLD.pedido_id)
  )
  WHERE id = COALESCE(NEW.pedido_id, OLD.pedido_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Criar trigger com verificação de existência para evitar erros
DROP TRIGGER IF EXISTS trigger_atualizar_total ON itens_pedido;
CREATE TRIGGER trigger_atualizar_total
AFTER INSERT OR UPDATE OR DELETE ON itens_pedido
FOR EACH ROW EXECUTE FUNCTION atualizar_total_pedido();

-- =============================================
-- HABILITAR RLS (Row Level Security)
-- =============================================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (para MVP - depois adicionar autenticação)
-- Usando DO block para evitar erro se política já existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público clientes') THEN
        CREATE POLICY "Acesso público clientes" ON clientes FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público produtos') THEN
         CREATE POLICY "Acesso público produtos" ON produtos FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público pedidos') THEN
         CREATE POLICY "Acesso público pedidos" ON pedidos FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público itens_pedido') THEN
         CREATE POLICY "Acesso público itens_pedido" ON itens_pedido FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso público rotas') THEN
         CREATE POLICY "Acesso público rotas" ON rotas FOR ALL USING (true);
    END IF;
END $$;


-- ##############################################################################
-- 2. MIGRAÇÃO: CONFIGURAÇÕES (create_configuracoes.sql)
-- ##############################################################################

CREATE TABLE IF NOT EXISTS configuracoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome_empresa TEXT DEFAULT 'Lu Festas',
    cnpj TEXT DEFAULT '46.446.131/0001-06',
    endereco TEXT DEFAULT 'Rua Ariramba, 121 - Alípio de Melo, Belo Horizonte - MG',
    telefone TEXT DEFAULT '(31) 98229-0789',
    email TEXT DEFAULT 'contato@lufestas.com.br',
    pix_tipo TEXT DEFAULT 'CNPJ',
    pix_chave TEXT DEFAULT '46.446.131/0001-06',
    pix_nome TEXT DEFAULT 'GABRIEL LUCAS',
    pix_banco TEXT DEFAULT 'CORA SCD',
    google_place_id TEXT DEFAULT 'ChIJxyFz3xGXpgAR8jNtT0lyZTE',
    whatsapp_instance TEXT DEFAULT 'lufestas',
    mensagem_boas_vindas TEXT DEFAULT 'Olá! Bem-vindo à Lu Festas! Como posso ajudar?',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita RLS
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas as operações
CREATE POLICY "Permitir todas as operações" ON configuracoes
    FOR ALL USING (true) WITH CHECK (true);

-- Insere configurações padrão se não existir
INSERT INTO configuracoes (id) 
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM configuracoes LIMIT 1);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_configuracoes_updated_at ON configuracoes;
CREATE TRIGGER update_configuracoes_updated_at
    BEFORE UPDATE ON configuracoes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ##############################################################################
-- 3. MIGRAÇÃO: CATEGORIAS (create_categorias_table.sql)
-- ##############################################################################

CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    cor TEXT DEFAULT 'bg-gray-500',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on categorias" ON categorias FOR ALL USING (true);

INSERT INTO categorias (nome, cor) VALUES
    ('Mesas', 'bg-blue-500'),
    ('Cadeiras', 'bg-green-500'),
    ('Toalhas', 'bg-purple-500'),
    ('Caixa Térmica', 'bg-orange-500'),
    ('Outros', 'bg-gray-500')
ON CONFLICT (nome) DO NOTHING;


-- ##############################################################################
-- 4. MIGRAÇÃO: CORREÇÕES DE SCHEMA E FRETE (fix_schema_mismatches.sql)
-- ##############################################################################

-- Alterar tipo da categoria se necessário (ENUM para TEXT)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produtos' AND column_name = 'categoria' AND data_type = 'USER-DEFINED') THEN
        ALTER TABLE produtos ALTER COLUMN categoria TYPE TEXT USING categoria::TEXT;
    END IF;
END $$;

-- Atualizar categorias existentes
UPDATE produtos SET categoria = 'Mesas' WHERE LOWER(categoria) = 'mesas';
UPDATE produtos SET categoria = 'Cadeiras' WHERE LOWER(categoria) = 'cadeiras';
UPDATE produtos SET categoria = 'Toalhas' WHERE LOWER(categoria) = 'toalhas';
UPDATE produtos SET categoria = 'Caixa Térmica' WHERE LOWER(categoria) = 'caixa_termica';
UPDATE produtos SET categoria = 'Outros' WHERE LOWER(categoria) = 'outros';

-- Adicionar colunas de frete na tabela pedidos
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS frete DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS distancia_km DECIMAL(10,2) DEFAULT NULL;

-- Adicionar whatsapp proprietario nas configurações
ALTER TABLE configuracoes 
ADD COLUMN IF NOT EXISTS whatsapp_proprietario TEXT DEFAULT '5531982290789';


-- ##############################################################################
-- 5. MIGRAÇÃO: CONFIGURAÇÕES DE FRETE ADICIONAIS (add_freight_settings.sql)
-- ##############################################################################

ALTER TABLE configuracoes
ADD COLUMN IF NOT EXISTS preco_km NUMERIC(10, 2) DEFAULT 2.00,
ADD COLUMN IF NOT EXISTS frete_minimo NUMERIC(10, 2) DEFAULT 15.00;

-- ##############################################################################
-- 6. MIGRAÇÃO: ENDEREÇO DO EVENTO (20251219_add_event_address.sql)
-- ##############################################################################

ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS usar_endereco_residencial BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS endereco_evento TEXT;

COMMENT ON COLUMN pedidos.usar_endereco_residencial IS 'Se true, usa endereço residencial do cliente. Se false, usa endereco_evento';
COMMENT ON COLUMN pedidos.endereco_evento IS 'Endereço do evento quando diferente do residencial do cliente';


-- ##############################################################################
-- 7. MIGRAÇÃO: LÓGICA DE ESTOQUE V5 (20251218_stock_logic_v5_fixed.sql)
-- ##############################################################################

CREATE OR REPLACE FUNCTION calcular_disponibilidade(data_consulta DATE)
RETURNS TABLE (
  produto_id UUID,
  nome TEXT,
  quantidade_total INTEGER,
  quantidade_reservada BIGINT,
  quantidade_disponivel BIGINT
) AS $$
DECLARE
  hoje DATE := CURRENT_DATE;
BEGIN
  RETURN QUERY
  SELECT 
    p.id as produto_id,
    p.nome,
    p.quantidade_total,
    -- CORREÇÃO: Só soma quantidade quando o pedido existe E corresponde aos critérios
    COALESCE(SUM(
      CASE 
        WHEN ped.id IS NOT NULL 
             AND ped.status IN ('pago_50', 'entregue')
             AND (ped.data_evento = data_consulta OR ped.data_evento < hoje)
        THEN ip.quantidade 
        ELSE 0 
      END
    ), 0)::BIGINT as quantidade_reservada,
    -- Disponível = Total - Reservada
    (p.quantidade_total - COALESCE(SUM(
      CASE 
        WHEN ped.id IS NOT NULL 
             AND ped.status IN ('pago_50', 'entregue')
             AND (ped.data_evento = data_consulta OR ped.data_evento < hoje)
        THEN ip.quantidade 
        ELSE 0 
      END
    ), 0))::BIGINT as quantidade_disponivel
  FROM produtos p
  LEFT JOIN itens_pedido ip ON ip.produto_id = p.id
  LEFT JOIN pedidos ped ON ip.pedido_id = ped.id
  GROUP BY p.id, p.nome, p.quantidade_total
  ORDER BY p.nome;
END;
$$ LANGUAGE plpgsql;


-- ##############################################################################
-- 8. NOVAS FUNCIONALIDADES: FINANCEIRO E NOTIFICAÇÕES (supabase_migrations.sql)
-- ##############################################################################

-- DESPESAS
CREATE TABLE IF NOT EXISTS despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  categoria VARCHAR(50) NOT NULL DEFAULT 'outros', 
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_despesas_data ON despesas(data);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON despesas(categoria);

-- NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo ON notificacoes(tipo);

-- ATUALIZAÇÃO PEDIDOS (Financeiro Avançado)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS valor_pago DECIMAL(10,2) DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS data_vencimento DATE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS inadimplente BOOLEAN DEFAULT FALSE;

-- PAGAMENTOS PARCIAIS
CREATE TABLE IF NOT EXISTS pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  metodo VARCHAR(50) DEFAULT 'dinheiro',
  observacao TEXT,
  data_pagamento DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_pedido ON pagamentos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_data ON pagamentos(data_pagamento);

-- FUNÇÃO SALDO DEVEDOR
CREATE OR REPLACE FUNCTION calcular_saldo_devedor(p_pedido_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_total DECIMAL;
  v_pago DECIMAL;
BEGIN
  SELECT total_pedido INTO v_total FROM pedidos WHERE id = p_pedido_id;
  SELECT COALESCE(SUM(valor), 0) INTO v_pago FROM pagamentos WHERE pedido_id = p_pedido_id;
  RETURN COALESCE(v_total, 0) - v_pago;
END;
$$ LANGUAGE plpgsql;

-- FIM DO SCRIPT DE RECUPERAÇÃO
-- Agora você pode rodar 'npx supabase gen types typescript' se tiver o CLI local,
-- ou simplesmente usar o banco restaurado.
