-- Create categories table for dynamic product categories
-- Migration: create_categorias_table

CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    cor TEXT DEFAULT 'bg-gray-500',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

-- Allow public access (same as other tables in this app)
CREATE POLICY "Allow all on categorias" ON categorias FOR ALL USING (true);

-- Insert default categories
INSERT INTO categorias (nome, cor) VALUES
    ('Mesas', 'bg-blue-500'),
    ('Cadeiras', 'bg-green-500'),
    ('Toalhas', 'bg-purple-500'),
    ('Caixa Térmica', 'bg-orange-500'),
    ('Outros', 'bg-gray-500')
ON CONFLICT (nome) DO NOTHING;

-- Alter produtos table to use foreign key (optional - can keep as text for simplicity)
-- For now we'll use categoria as TEXT matching categorias.nome

COMMENT ON TABLE categorias IS 'Dynamic product categories';
