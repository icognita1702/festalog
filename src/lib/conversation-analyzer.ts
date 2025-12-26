import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'

// ============ Schemas Zod ============

export const ClienteSchema = z.object({
    nome: z.string().nullable().describe("Nome completo do cliente"),
    telefone: z.string().nullable().describe("Telefone formatado (ex: 55319XXXXXXXX)"),
    endereco: z.string().nullable().describe("Endereço completo com rua, número e bairro"),
    email: z.string().nullable().describe("Email do cliente se disponível"),
})

export const PedidoSchema = z.object({
    data_evento: z.string().nullable().describe("Data do evento no formato YYYY-MM-DD"),
    hora_evento: z.string().nullable().describe("Horário do evento (HH:MM)"),
    itens: z.array(z.string()).describe("Lista de itens solicitados"),
    tipo_festa: z.string().nullable().describe("Tipo de evento (ex: Aniversário, Casamento)"),
    observacoes: z.string().nullable().describe("Observações adicionais ou forma de pagamento"),
    valor_estimado: z.number().nullable().describe("Valor estimado do pedido se mencionado"),
})

export const ExtractionResultSchema = z.object({
    cliente: ClienteSchema,
    pedido: PedidoSchema,
    confianca: z.number().min(0).max(1).describe("Nível de confiança na extração (0.0 a 1.0)"),
    resumo: z.string().describe("Resumo curto da solicitação (max 120 chars)"),
})

// Tipos inferidos
export type ClienteExtraido = z.infer<typeof ClienteSchema>
export type PedidoExtraido = z.infer<typeof PedidoSchema>
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>

// ============ Preprocessing ============

/**
 * Limpa e normaliza a conversa do WhatsApp
 */
export function preprocessConversation(rawConversation: string): string {
    let cleaned = rawConversation
    cleaned = cleaned.replace(/\r\n/g, '\n')
    cleaned = cleaned.replace(/<Mídia oculta>/gi, '[MÍDIA]')
    cleaned = cleaned.replace(/imagem ocultada/gi, '[IMAGEM]')
    cleaned = cleaned.replace(/\[.*?(sticker|figurinha|imagem|foto|vídeo|video|áudio|audio).*?\]/gi, '[MÍDIA]')
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
    cleaned = cleaned.replace(/  +/g, ' ')
    return cleaned.trim()
}

// ============ Prompt Engineering ============

const SYSTEM_PROMPT = `Você é um assistente especializado em extrair dados de conversas do WhatsApp.
A LOJA se chama "Lu Festas" ou "Filipe". O CLIENTE é a outra pessoa.

REGRAS:
1. Extraia APENAS dados EXPLICITAMENTE mencionados. Use null se não encontrar.
2. Normalize telefone para 5531XXXXXXXXX.
3. Se a data for relativa ("amanhã", "sábado que vem"), calcule baseando-se na data das mensagens.
4. Data formato YYYY-MM-DD.
5. Responda ESTRITAMENTE com JSON válido seguindo o schema.`

function buildExtractionPrompt(conversation: string): string {
    return `${SYSTEM_PROMPT}

CONVERSA:
${conversation}

Responda com o JSON extraído:`
}

// ============ Extraction ============

export async function extractDataFromConversation(
    conversation: string,
    apiKey: string
): Promise<ExtractionResult> {
    const cleaned = preprocessConversation(conversation)

    if (cleaned.length < 30) {
        return emptyResult('Conversa muito curta')
    }

    return await callGemini(cleaned, apiKey)
}

async function callGemini(conversation: string, apiKey: string): Promise<ExtractionResult> {
    const genAI = new GoogleGenerativeAI(apiKey)
    const modelsToTry = [
        'gemini-2.0-flash',        // Recomendado
        'gemini-1.5-flash',        // Fallback
    ]

    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json", // Força JSON
                }
            })

            const updatedPrompt = buildExtractionPrompt(conversation)

            const result = await model.generateContent(updatedPrompt)
            const responseText = result.response.text()

            // Parse com Zod
            const parsed = JSON.parse(responseText)
            const validated = ExtractionResultSchema.safeParse(parsed)

            if (validated.success) {
                return normalizeExtraction(validated.data)
            } else {
                console.warn(`[Gemini] Falha de validação Zod no modelo ${modelName}:`, validated.error)
                // Se falhar validação, tenta o próximo modelo
            }

        } catch (error: any) {
            console.warn(`[Gemini] Erro no modelo ${modelName}:`, error.message)
            lastError = error
        }
    }

    console.error('[Gemini] Todos os modelos falharam.', lastError)
    return emptyResult('Erro processar conversa. Tente novamente.')
}

function emptyResult(resumo: string): ExtractionResult {
    return {
        cliente: { nome: null, telefone: null, endereco: null, email: null },
        pedido: { data_evento: null, hora_evento: null, itens: [], tipo_festa: null, observacoes: null, valor_estimado: null },
        confianca: 0,
        resumo
    }
}

function normalizeExtraction(data: ExtractionResult): ExtractionResult {
    // Normalizações adicionais pós-IA (se necessário)
    // Ex: Garantir +55 no telefone se o modelo esqueceu
    if (data.cliente.telefone) {
        const digits = data.cliente.telefone.replace(/\D/g, '')
        if (digits.length === 11) data.cliente.telefone = `55${digits}`
    }

    // Normaliza data para evitar datas passadas (assumindo próximo ano)
    if (data.pedido.data_evento) {
        const eventDate = new Date(data.pedido.data_evento + 'T12:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        if (eventDate < today && eventDate.getFullYear() === today.getFullYear()) {
            // Lógica simplificada: Se data ja passou neste ano, talvez seja erro ou ano que vem.
            // Manter o que a IA decidiu por enquanto, ou implementar lógica complexa de datas relativas aqui.
        }
    }

    return data
}

// ============ Utils ============

export function formatPhoneDisplay(phone: string | null): string {
    if (!phone) return ''
    const cleaned = phone.replace(/\D/g, '')
    // ... lógica de formatação de telefone existente ...
    if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const ddd = cleaned.slice(2, 4)
        const num = cleaned.slice(4)
        return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`
    }
    return phone
}
