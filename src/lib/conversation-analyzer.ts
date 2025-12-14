import { GoogleGenerativeAI } from '@google/generative-ai'

// ============ Types ============

export interface ClienteExtraido {
    nome: string | null
    telefone: string | null
    endereco: string | null
    email: string | null
}

export interface PedidoExtraido {
    data_evento: string | null
    hora_evento: string | null
    itens: string[]
    tipo_festa: string | null
    observacoes: string | null
    valor_estimado: number | null
}

export interface ExtractionResult {
    cliente: ClienteExtraido
    pedido: PedidoExtraido
    confianca: number
    resumo: string
}

// ============ Preprocessing ============

/**
 * Limpa e comprime a conversa para economizar tokens
 */
export function preprocessConversation(rawConversation: string): string {
    let cleaned = rawConversation

    // Remove timestamps no formato [HH:MM] ou HH:MM -
    cleaned = cleaned.replace(/\[\d{1,2}:\d{2}\]/g, '')
    cleaned = cleaned.replace(/\d{1,2}:\d{2}\s*-\s*/g, '')

    // Remove datas no formato DD/MM/YYYY ou DD/MM/YY no início de linhas
    cleaned = cleaned.replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*/gm, '')

    // Remove indicadores de mídia
    cleaned = cleaned.replace(/<Mídia oculta>/gi, '[ÁUDIO/IMAGEM]')
    cleaned = cleaned.replace(/\[.*?(sticker|figurinha|imagem|foto|vídeo|video|áudio|audio).*?\]/gi, '')

    // Remove emojis decorativos repetidos (mantém um de cada)
    cleaned = cleaned.replace(/([\u{1F300}-\u{1F9FF}])\1+/gu, '$1')

    // Remove linhas vazias múltiplas
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

    // Remove espaços extras
    cleaned = cleaned.replace(/  +/g, ' ')

    // Trim
    cleaned = cleaned.trim()

    return cleaned
}

/**
 * Estima quantidade de tokens (aproximação: 1 token ≈ 4 caracteres em PT)
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}

/**
 * Divide conversa em chunks se muito longa
 */
export function chunkConversation(conversation: string, maxTokens: number = 5000): string[] {
    const tokens = estimateTokens(conversation)

    if (tokens <= maxTokens) {
        return [conversation]
    }

    // Divide por quebras de linha duplas (mudanças de contexto)
    const paragraphs = conversation.split(/\n\n+/)
    const chunks: string[] = []
    let currentChunk = ''

    for (const para of paragraphs) {
        const testChunk = currentChunk + '\n\n' + para
        if (estimateTokens(testChunk) > maxTokens && currentChunk) {
            chunks.push(currentChunk.trim())
            currentChunk = para
        } else {
            currentChunk = testChunk
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
    }

    return chunks
}

// ============ Prompt Engineering ============

const SYSTEM_PROMPT = `Você é um assistente especializado em extrair dados de conversas entre uma empresa de aluguel de materiais para festas (Lu Festas) e seus clientes.

## Regras IMPORTANTES:
1. Extraia APENAS informações EXPLICITAMENTE mencionadas na conversa
2. Use null para dados NÃO ENCONTRADOS (não invente)
3. Normalize telefones para formato: 5531XXXXXXXXX (sem espaços ou símbolos)
4. Datas no formato: YYYY-MM-DD
5. Valores monetários como números (sem R$, sem vírgula)
6. O campo "confianca" deve ser um número de 0 a 1 indicando sua certeza

## Exemplo de Conversa:
Cliente: Oi, boa tarde! Vocês alugam mesa?
Loja: Olá! Sim, temos mesas redondas e retangulares.
Cliente: Preciso de 5 mesas redondas e 20 cadeiras para dia 20/01
Loja: Perfeito! Qual o endereço?
Cliente: Rua das Flores, 123 - Pampulha, BH. Meu nome é Maria Silva, telefone 31 98765-4321

## Extração Correta do Exemplo:
{
  "cliente": {
    "nome": "Maria Silva",
    "telefone": "5531987654321",
    "endereco": "Rua das Flores, 123 - Pampulha, BH",
    "email": null
  },
  "pedido": {
    "data_evento": "2025-01-20",
    "hora_evento": null,
    "itens": ["5 mesas redondas", "20 cadeiras"],
    "tipo_festa": null,
    "observacoes": null,
    "valor_estimado": null
  },
  "confianca": 0.9,
  "resumo": "Cliente Maria Silva solicita 5 mesas e 20 cadeiras para 20/01 na Pampulha."
}`

function buildExtractionPrompt(conversation: string): string {
    return `${SYSTEM_PROMPT}

## CONVERSA PARA ANALISAR:
${conversation}

## INSTRUÇÕES FINAIS:
- Analise cuidadosamente toda a conversa
- Extraia todos os dados relevantes
- Se houver múltiplas datas, use a data do EVENTO (não a data da conversa)
- Responda APENAS com JSON válido, sem texto adicional
- O resumo deve ter no máximo 100 caracteres`
}

// ============ Extraction ============

/**
 * Extrai dados da conversa usando Gemini AI
 */
export async function extractDataFromConversation(
    conversation: string,
    apiKey: string
): Promise<ExtractionResult> {
    // Preprocessa
    const cleaned = preprocessConversation(conversation)

    // Verifica tamanho
    const tokens = estimateTokens(cleaned)
    if (tokens > 6000) {
        // Usa apenas a parte mais recente (geralmente tem mais dados)
        const chunks = chunkConversation(cleaned, 5000)
        // Pega os últimos 2 chunks (mais recentes)
        const relevantPart = chunks.slice(-2).join('\n\n---\n\n')
        return await callGemini(relevantPart, apiKey)
    }

    return await callGemini(cleaned, apiKey)
}

async function callGemini(conversation: string, apiKey: string): Promise<ExtractionResult> {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
            temperature: 0.1, // Baixa temperatura = mais determinístico
            maxOutputTokens: 1000,
        }
    })

    const prompt = buildExtractionPrompt(conversation)

    try {
        const result = await model.generateContent(prompt)
        const response = result.response.text()

        // Extrai JSON da resposta (pode vir com markdown)
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            throw new Error('Resposta não contém JSON válido')
        }

        const parsed = JSON.parse(jsonMatch[0]) as ExtractionResult

        // Validação básica
        if (!parsed.cliente || !parsed.pedido) {
            throw new Error('Estrutura de resposta inválida')
        }

        // Normaliza dados
        return normalizeExtraction(parsed)

    } catch (error) {
        console.error('Erro ao chamar Gemini:', error)

        // Retorna estrutura vazia em caso de erro
        return {
            cliente: { nome: null, telefone: null, endereco: null, email: null },
            pedido: {
                data_evento: null,
                hora_evento: null,
                itens: [],
                tipo_festa: null,
                observacoes: null,
                valor_estimado: null
            },
            confianca: 0,
            resumo: 'Erro ao analisar conversa'
        }
    }
}

/**
 * Normaliza e valida dados extraídos
 */
function normalizeExtraction(data: ExtractionResult): ExtractionResult {
    // Normaliza telefone
    if (data.cliente.telefone) {
        let phone = data.cliente.telefone.replace(/\D/g, '')
        if (phone.length === 11) {
            phone = '55' + phone
        } else if (phone.length === 10) {
            phone = '55' + phone
        }
        data.cliente.telefone = phone
    }

    // Valida data (deve ser futura ou próxima)
    if (data.pedido.data_evento) {
        const eventDate = new Date(data.pedido.data_evento)
        const today = new Date()
        const oneYearFromNow = new Date()
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)

        if (eventDate < today || eventDate > oneYearFromNow) {
            // Data suspeita - pode ser erro de ano
            const correctedDate = new Date(data.pedido.data_evento)
            correctedDate.setFullYear(today.getFullYear())
            if (correctedDate < today) {
                correctedDate.setFullYear(today.getFullYear() + 1)
            }
            data.pedido.data_evento = correctedDate.toISOString().split('T')[0]
        }
    }

    // Garante que itens é array
    if (!Array.isArray(data.pedido.itens)) {
        data.pedido.itens = []
    }

    // Limita confiança entre 0 e 1
    data.confianca = Math.max(0, Math.min(1, data.confianca || 0))

    return data
}

/**
 * Formata telefone para exibição
 */
export function formatPhoneDisplay(phone: string | null): string {
    if (!phone) return ''
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
        // 55 31 99999-9999
        return `(${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`
    }
    return phone
}
