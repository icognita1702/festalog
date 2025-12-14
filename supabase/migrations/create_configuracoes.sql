-- Tabela de Configurações do FestaLog
-- Execute este SQL no Supabase Dashboard > SQL Editor

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

-- Política para permitir todas as operações (ajuste conforme necessário)
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

CREATE TRIGGER update_configuracoes_updated_at
    BEFORE UPDATE ON configuracoes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
