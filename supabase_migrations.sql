-- ============================================
-- FESTALOG: SQLs para novas funcionalidades
-- Execute no Supabase SQL Editor
-- ============================================

-- =============================================
-- 1. TABELA DE DESPESAS OPERACIONAIS
-- =============================================
CREATE TABLE IF NOT EXISTS despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  categoria VARCHAR(50) NOT NULL DEFAULT 'outros', -- combustivel, manutencao, outros
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para consultas por data
CREATE INDEX IF NOT EXISTS idx_despesas_data ON despesas(data);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON despesas(categoria);

-- RLS (Row Level Security) - Opcional, comente se não usar
-- ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. TABELA DE NOTIFICAÇÕES
-- =============================================
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL, -- evento_proximo, pagamento_pendente, devolucao
  titulo TEXT NOT NULL,
  mensagem TEXT,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo ON notificacoes(tipo);

-- =============================================
-- 3. ALTERAÇÕES NA TABELA PEDIDOS (Financeiro Avançado)
-- =============================================
-- Adiciona colunas para controle de pagamentos parciais
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS valor_pago DECIMAL(10,2) DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS data_vencimento DATE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS inadimplente BOOLEAN DEFAULT FALSE;

-- =============================================
-- 4. TABELA DE PAGAMENTOS PARCIAIS
-- =============================================
CREATE TABLE IF NOT EXISTS pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  metodo VARCHAR(50) DEFAULT 'dinheiro', -- pix, dinheiro, cartao, transferencia
  observacao TEXT,
  data_pagamento DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_pedido ON pagamentos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_data ON pagamentos(data_pagamento);

-- =============================================
-- 5. FUNÇÃO PARA CALCULAR SALDO DEVEDOR
-- =============================================
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

-- =============================================
-- PRONTO! Agora atualize os tipos gerados:
-- npx supabase gen types typescript --linked > src/lib/database.types.ts
-- =============================================
