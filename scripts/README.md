# WhatsApp Interpreter - CLI Tool

Ferramenta CLI para extrair informações de conversas do WhatsApp.

## Uso

```bash
# A partir de arquivo
npx tsx scripts/whatsapp-interpreter.ts mensagens.txt

# A partir de stdin
echo "mensagens" | npx tsx scripts/whatsapp-interpreter.ts --stdin

# Com IA (requer GOOGLE_GEMINI_API_KEY)
npx tsx scripts/whatsapp-interpreter.ts mensagens.txt --use-ai

# Criar cliente/pedido automaticamente no Supabase
npx tsx scripts/whatsapp-interpreter.ts mensagens.txt --create

# Saída apenas JSON
npx tsx scripts/whatsapp-interpreter.ts mensagens.txt --json
```

## Flags

| Flag | Descrição |
|------|-----------|
| `--stdin` | Lê da entrada padrão (stdin) |
| `--use-ai` | Usa Gemini AI para melhorar a extração |
| `--create` | Cria cliente/pedido no Supabase |
| `--json` | Saída apenas em JSON (máquina) |

## Variáveis de Ambiente

```env
GOOGLE_GEMINI_API_KEY=sua-chave    # Para --use-ai
NEXT_PUBLIC_SUPABASE_URL=...       # Para --create
NEXT_PUBLIC_SUPABASE_ANON_KEY=... # Para --create
```

## Extração por Regex (Sem IA)

O script extrai automaticamente:
- ✅ Timestamps das mensagens
- ✅ Nome do remetente
- ✅ Números de telefone (formato brasileiro)
- ✅ Datas explícitas (DD/MM, DD/MM/YYYY)
- ✅ Horários (14h, 15:00, às 3 da tarde)
- ✅ Endereços (Rua, Avenida, etc.)
- ✅ Quantidades e itens (10 mesas, 50 cadeiras)

## Extração com IA (Opcional)

Com a flag `--use-ai`, o Gemini AI:
- Interpreta datas relativas ("amanhã", "próximo sábado")
- Entende linguagem informal ("umas 10 mesa")
- Completa informações parciais
- Aumenta a confiança da extração

## Exemplo de Saída

```json
{
  "cliente": {
    "nome": "Maria Silva",
    "telefone": "5531999998888",
    "endereco": "Rua das Flores, 100 - Centro"
  },
  "pedido": {
    "data_evento": "2025-12-20",
    "hora_evento": "14:00",
    "itens": ["10 mesas", "40 cadeiras", "10 toalhas"]
  },
  "confianca": 0.85,
  "metodo": "regex"
}
```
