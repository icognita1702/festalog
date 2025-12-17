-- Fix schema mismatches causing 400 errors
-- Migration: fix_schema_mismatches
-- Execute this in the Supabase SQL Editor

-- 1. Change produtos.categoria from ENUM to TEXT for dynamic categories
ALTER TABLE produtos 
ALTER COLUMN categoria TYPE TEXT;

-- 2. Update existing product categories to match the categorias table (capitalize first letter)
UPDATE produtos SET categoria = 'Mesas' WHERE categoria = 'mesas';
UPDATE produtos SET categoria = 'Cadeiras' WHERE categoria = 'cadeiras';
UPDATE produtos SET categoria = 'Toalhas' WHERE categoria = 'toalhas';
UPDATE produtos SET categoria = 'Caixa Térmica' WHERE categoria = 'caixa_termica';
UPDATE produtos SET categoria = 'Outros' WHERE categoria = 'outros';

-- 3. Add missing columns to pedidos table for freight calculation
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS frete DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS distancia_km DECIMAL(10,2) DEFAULT 0;

-- 4. Add missing column to configuracoes for owner WhatsApp
ALTER TABLE configuracoes 
ADD COLUMN IF NOT EXISTS whatsapp_proprietario TEXT DEFAULT '5531982290789';

-- 5. Optional: Drop the old ENUM type if it's no longer needed
-- (only run after confirming the migration worked)
-- DROP TYPE IF EXISTS categoria_produto;

COMMENT ON COLUMN pedidos.frete IS 'Freight cost for delivery';
COMMENT ON COLUMN pedidos.distancia_km IS 'Distance in kilometers for freight calculation';
COMMENT ON COLUMN configuracoes.whatsapp_proprietario IS 'Owner WhatsApp number for receiving route links';
