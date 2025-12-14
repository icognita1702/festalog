-- Add freight settings columns to configuracoes table
-- Migration: add_freight_settings

ALTER TABLE configuracoes
ADD COLUMN IF NOT EXISTS preco_km NUMERIC(10, 2) DEFAULT 2.00,
ADD COLUMN IF NOT EXISTS frete_minimo NUMERIC(10, 2) DEFAULT 15.00;

-- Drop bot-related columns (optional, can be kept if needed for reference)
-- ALTER TABLE configuracoes DROP COLUMN IF EXISTS whatsapp_instance;
-- ALTER TABLE configuracoes DROP COLUMN IF EXISTS mensagem_boas_vindas;

COMMENT ON COLUMN configuracoes.preco_km IS 'Price per kilometer for freight calculation';
COMMENT ON COLUMN configuracoes.frete_minimo IS 'Minimum freight charge';
