-- Adicionar campos de endereço do evento na tabela pedidos
-- Permite especificar um endereço diferente do residencial do cliente

ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS usar_endereco_residencial BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS endereco_evento TEXT;

-- Comentários explicativos
COMMENT ON COLUMN pedidos.usar_endereco_residencial IS 'Se true, usa endereço residencial do cliente. Se false, usa endereco_evento';
COMMENT ON COLUMN pedidos.endereco_evento IS 'Endereço do evento quando diferente do residencial do cliente';
