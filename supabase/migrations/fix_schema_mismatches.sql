-- Fix schema mismatches causing 400 errors
-- Migration: fix_schema_mismatches
-- Execute this in the Supabase SQL Editor

-- =============================================
-- PRE-MIGRATION: Run these queries first to check your data
-- =============================================
-- SELECT DISTINCT categoria FROM produtos;
-- SELECT COUNT(*) FROM pedidos;
-- SELECT COUNT(*) FROM configuracoes;

-- =============================================
-- STEP 1: Change produtos.categoria from ENUM to TEXT
-- =============================================
ALTER TABLE produtos 
ALTER COLUMN categoria TYPE TEXT;

-- =============================================
-- STEP 2: Update existing categories to match categorias table
-- (Run only if your categories are lowercase)
-- =============================================
UPDATE produtos SET categoria = 'Mesas' WHERE LOWER(categoria) = 'mesas';
UPDATE produtos SET categoria = 'Cadeiras' WHERE LOWER(categoria) = 'cadeiras';
UPDATE produtos SET categoria = 'Toalhas' WHERE LOWER(categoria) = 'toalhas';
UPDATE produtos SET categoria = 'Caixa Térmica' WHERE LOWER(categoria) = 'caixa_termica';
UPDATE produtos SET categoria = 'Outros' WHERE LOWER(categoria) = 'outros';

-- =============================================
-- STEP 3: Add freight columns to pedidos
-- Using NULL default to distinguish "not calculated" from "zero freight"
-- =============================================
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS frete DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS distancia_km DECIMAL(10,2) DEFAULT NULL;

-- =============================================
-- STEP 4: Add owner WhatsApp to configuracoes
-- =============================================
ALTER TABLE configuracoes 
ADD COLUMN IF NOT EXISTS whatsapp_proprietario TEXT DEFAULT '5531982290789';

-- =============================================
-- STEP 5 (OPTIONAL): Add foreign key constraint for category validation
-- Uncomment if you want database-level validation
-- =============================================
-- ALTER TABLE produtos 
-- ADD CONSTRAINT fk_produtos_categoria 
-- FOREIGN KEY (categoria) REFERENCES categorias(nome)
-- ON UPDATE CASCADE;

-- =============================================
-- POST-MIGRATION: Verify changes
-- =============================================
-- SELECT categoria, COUNT(*) FROM produtos GROUP BY categoria;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pedidos';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'configuracoes';

COMMENT ON COLUMN pedidos.frete IS 'Freight cost for delivery (NULL = not calculated)';
COMMENT ON COLUMN pedidos.distancia_km IS 'Distance in kilometers (NULL = not calculated)';
COMMENT ON COLUMN configuracoes.whatsapp_proprietario IS 'Owner WhatsApp for route links';

