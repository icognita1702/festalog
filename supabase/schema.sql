-- =============================================
-- FESTALOG - Script de Criação do Banco de Dados
-- Execute este script no SQL Editor do Supabase
-- =============================================

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
CREATE TABLE clientes (
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
CREATE INDEX idx_clientes_nome ON clientes(nome);
CREATE INDEX idx_clientes_whatsapp ON clientes(whatsapp);

-- =============================================
-- TABELA: produtos
-- =============================================
CREATE TABLE produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  quantidade_total INTEGER NOT NULL DEFAULT 0,
  preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  categoria categoria_produto NOT NULL DEFAULT 'outros',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_produtos_categoria ON produtos(categoria);
CREATE INDEX idx_produtos_nome ON produtos(nome);

-- =============================================
-- TABELA: pedidos
-- =============================================
CREATE TABLE pedidos (
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
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_data_evento ON pedidos(data_evento);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_data_entrega ON pedidos(data_entrega);

-- =============================================
-- TABELA: itens_pedido
-- =============================================
CREATE TABLE itens_pedido (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL
);

-- Índices
CREATE INDEX idx_itens_pedido_pedido ON itens_pedido(pedido_id);
CREATE INDEX idx_itens_pedido_produto ON itens_pedido(produto_id);

-- =============================================
-- TABELA: rotas
-- =============================================
CREATE TABLE rotas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  motorista TEXT,
  ordem_entregas JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_rotas_data ON rotas(data);

-- =============================================
-- FUNÇÃO: calcular_disponibilidade
-- Retorna a disponibilidade de produtos para uma data específica
-- =============================================
CREATE OR REPLACE FUNCTION calcular_disponibilidade(data_consulta DATE)
RETURNS TABLE (
  produto_id UUID,
  nome TEXT,
  quantidade_total INTEGER,
  quantidade_reservada BIGINT,
  quantidade_disponivel BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as produto_id,
    p.nome,
    p.quantidade_total,
    COALESCE(SUM(ip.quantidade), 0)::BIGINT as quantidade_reservada,
    (p.quantidade_total - COALESCE(SUM(ip.quantidade), 0))::BIGINT as quantidade_disponivel
  FROM produtos p
  LEFT JOIN itens_pedido ip ON ip.produto_id = p.id
  LEFT JOIN pedidos ped ON ip.pedido_id = ped.id 
    AND ped.data_evento = data_consulta
    AND ped.status NOT IN ('orcamento', 'finalizado')
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

-- Criar trigger
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
CREATE POLICY "Acesso público clientes" ON clientes FOR ALL USING (true);
CREATE POLICY "Acesso público produtos" ON produtos FOR ALL USING (true);
CREATE POLICY "Acesso público pedidos" ON pedidos FOR ALL USING (true);
CREATE POLICY "Acesso público itens_pedido" ON itens_pedido FOR ALL USING (true);
CREATE POLICY "Acesso público rotas" ON rotas FOR ALL USING (true);

-- =============================================
-- DADOS INICIAIS DE EXEMPLO
-- =============================================

-- Produtos iniciais
INSERT INTO produtos (nome, quantidade_total, preco_unitario, categoria) VALUES
  ('Mesa Redonda 1.20m', 20, 25.00, 'mesas'),
  ('Mesa Retangular 2m', 15, 35.00, 'mesas'),
  ('Cadeira Plástica Branca', 200, 3.00, 'cadeiras'),
  ('Cadeira de Ferro Preta', 100, 5.00, 'cadeiras'),
  ('Toalha Branca Redonda', 30, 15.00, 'toalhas'),
  ('Toalha Colorida Retangular', 25, 18.00, 'toalhas'),
  ('Caixa Térmica 50L', 1, 50.00, 'caixa_termica');

-- Cliente de exemplo
INSERT INTO clientes (nome, whatsapp, endereco_completo, lat, lng, cpf) VALUES
  ('Cliente Exemplo', '31999999999', 'Rua das Flores, 100 - BH/MG', -19.9245, -43.9352, '123.456.789-00');
