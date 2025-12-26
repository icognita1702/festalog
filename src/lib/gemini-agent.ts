import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '')

// ============ Schemas ============

const IntencaoSchema = z.enum([
    'disponibilidade',
    'preco',
    'orcamento',
    'atendente',
    'saudacao',
    'geral'
])

const ClassificacaoResponseSchema = z.object({
    intencao: IntencaoSchema,
    confianca: z.number().min(0).max(1),
    razao: z.string().optional()
})

export type TipoIntencao = z.infer<typeof IntencaoSchema>

// ============ System Prompts ============

const CHAT_SYSTEM_PROMPT = `Você é o assistente virtual da Lu Festas, uma locadora de materiais para festas em Belo Horizonte.

SOBRE A EMPRESA:
- Nome: Lu Festas
- Endereço: Rua Ariramba, 121 - Alípio de Melo, Belo Horizonte, MG
- Horário: Seg-Sex 8h-18h, Sáb 8h-12h
- WhatsApp: (número da loja)

SERVIÇOS OFERECIDOS:
- Locação de mesas (redondas e retangulares)
- Locação de cadeiras
- Locação de toalhas
- Locação de caixas térmicas
- Entrega e recolhimento inclusos na região de BH

DIRETRIZES DE RESPOSTA:
1. Seja simpático, objetivo e profissional
2. Use emojis com moderação
3. Para orçamentos: peça data, endereço e itens
4. Para disponibilidade: pergunte a data
5. NÃO invente preços
6. Se complexo: encaminhe para atendente humano
7. Respostas CURTAS (WhatsApp)`

// ============ Public API ============

export async function gerarRespostaIA(mensagemUsuario: string, historicoConversa?: string): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        const prompt = `${CHAT_SYSTEM_PROMPT}

${historicoConversa ? `HISTÓRICO DA CONVERSA:\n${historicoConversa}\n\n` : ''}
MENSAGEM DO CLIENTE:
${mensagemUsuario}

Responda de forma natural e útil:`

        const result = await model.generateContent(prompt)
        const text = result.response.text()

        return text || 'Desculpe, não consegui processar sua mensagem. Um atendente entrará em contato.'
    } catch (error) {
        console.error('Erro ao gerar resposta com Gemini:', error)
        return 'Desculpe, estou com dificuldades técnicas. Um atendente entrará em contato em breve. 🙏'
    }
}

/**
 * Classifica a intenção usando regras locais (rápido) ou fallback para IA (inteligente)
 */
export async function classificarIntencao(mensagem: string): Promise<TipoIntencao> {
    const msgLower = mensagem.toLowerCase().trim()

    // 1. Tentativa Rápida (Heurística Local)

    // Menu numérico
    if (/^[1-4]$/.test(msgLower)) {
        const map: Record<string, TipoIntencao> = { '1': 'disponibilidade', '2': 'preco', '3': 'orcamento', '4': 'atendente' }
        return map[msgLower] || 'geral'
    }

    const keywords: Record<string, TipoIntencao> = {
        'disponibilidade': 'disponibilidade', 'disponivel': 'disponibilidade', 'agenda': 'disponibilidade',
        'preço': 'preco', 'preco': 'preco', 'valor': 'preco', 'custa': 'preco',
        'orçamento': 'orcamento', 'alugar': 'orcamento', 'reservar': 'orcamento',
        'atendente': 'atendente', 'humano': 'atendente', 'falar com': 'atendente',
        'oi': 'saudacao', 'ola': 'saudacao', 'bom dia': 'saudacao'
    }

    // Verifica palavras exatas ou com boundary (evita 'oi' dentro de 'coisas')
    for (const [key, val] of Object.entries(keywords)) {
        // Escapa caracteres especiais para regex se necessário (aqui são simples)
        // \b garante que 'oi' não dê match em 'coisas'
        const regex = new RegExp(`\\b${key}\\b`, 'i')
        if (regex.test(mensagem)) return val
    }

    // 2. Classificação via IA (Gemini) se heurística falhar
    if (msgLower.length < 5) return 'geral'

    try {
        return await classificarViaGemini(mensagem)
    } catch (error) {
        console.warn('Falha na classificação via IA, fallback para geral:', error)
        return 'geral'
    }
}

async function classificarViaGemini(mensagem: string): Promise<TipoIntencao> {
    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
            responseMimeType: 'application/json'
        }
    })

    const prompt = `Classifique a intenção desta mensagem de WhatsApp para uma locadora de festas.
Categorias possíveis: ${IntencaoSchema.options.map(o => `"${o}"`).join(', ')}.

Mensagem: "${mensagem}"

Responda APENAS JSON: { "intencao": "...", "confianca": number }`

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    try {
        const parsed = JSON.parse(text)
        const validated = ClassificacaoResponseSchema.safeParse(parsed)

        if (validated.success && validated.data.confianca > 0.6) {
            return validated.data.intencao
        }
    } catch (e) {
        // Ignorar
    }

    return 'geral'
}
