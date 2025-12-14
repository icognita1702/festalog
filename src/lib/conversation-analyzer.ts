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
 * Limpa e normaliza a conversa do WhatsApp
 * Formato esperado: [HH:MM, DD/MM/YYYY] Nome: Mensagem
 */
export function preprocessConversation(rawConversation: string): string {
    let cleaned = rawConversation

    // Normaliza quebras de linha
    cleaned = cleaned.replace(/\r\n/g, '\n')

    // Remove indicadores de mídia
    cleaned = cleaned.replace(/<Mídia oculta>/gi, '[MÍDIA]')
    cleaned = cleaned.replace(/imagem ocultada/gi, '[IMAGEM]')
    cleaned = cleaned.replace(/\[.*?(sticker|figurinha|imagem|foto|vídeo|video|áudio|audio).*?\]/gi, '[MÍDIA]')

    // Remove linhas vazias múltiplas
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

    // Remove espaços extras
    cleaned = cleaned.replace(/  +/g, ' ')

    // Trim
    cleaned = cleaned.trim()

    return cleaned
}

/**
 * Identifica quem é o cliente e quem é a loja baseado no contexto
 */
function identifyParticipants(conversation: string): { loja: string | null, cliente: string | null } {
    // Extrai todos os nomes de remetentes
    const senderPattern = /\[\d{2}:\d{2}, \d{2}\/\d{2}\/\d{4}\] ([^:]+):/g
    const senders = new Map<string, number>()

    let match
    while ((match = senderPattern.exec(conversation)) !== null) {
        const name = match[1].trim()
        senders.set(name, (senders.get(name) || 0) + 1)
    }

    // Se há apenas 2 participantes
    if (senders.size === 2) {
        const [first, second] = Array.from(senders.entries())
        // O cliente geralmente menciona "quero", "preciso", "alugar", etc.
        // A loja geralmente responde com preços, confirmações
        return { loja: null, cliente: null } // Deixa a IA decidir
    }

    return { loja: null, cliente: null }
}

/**
 * Estima quantidade de tokens (aproximação: 1 token ≈ 4 caracteres em PT)
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}

// ============ Prompt Engineering ============

const SYSTEM_PROMPT = `Você é um assistente especializado em extrair dados de conversas do WhatsApp entre uma empresa de aluguel de materiais para festas (Lu Festas/Filipe) e seus clientes.

## FORMATO DAS MENSAGENS:
As mensagens seguem o padrão: [HH:MM, DD/MM/YYYY] Nome do Remetente: Texto da mensagem

## IDENTIFICAÇÃO:
- A LOJA é identificada por nomes como: Filipe, Lu Festas, Lú, etc.
- O CLIENTE é a outra pessoa na conversa

## Regras IMPORTANTES:
1. Extraia APENAS informações EXPLICITAMENTE mencionadas
2. Use null para dados NÃO ENCONTRADOS (não invente)
3. Normalize telefones para formato: 5531XXXXXXXXX (sem espaços ou símbolos)
4. Datas no formato: YYYY-MM-DD
5. Valores monetários como números (sem R$)
6. O campo "confianca" deve ser 0.0 a 1.0 indicando sua certeza

## EXEMPLO 1:
Conversa:
[23:03, 13/12/2025] Felipe Nominato: Meu nome é Felipe
[23:03, 13/12/2025] Felipe Nominato: quero alugar 20 jogos de mesa e 4 toalhas
[23:04, 13/12/2025] Felipe Nominato: Para amanhã às 13 horas da tarde.
[23:04, 13/12/2025] Felipe Nominato: Pagarei no pix o valor de 50%
[23:08, 13/12/2025] Filipe Elienai Santos Souza: Olá, ok.
[00:09, 14/12/2025] Felipe Nominato: moro na rua ariramba 121, alipio de melo.
[00:09, 14/12/2025] Felipe Nominato: meu numero é 31982290789

Extração:
{
  "cliente": {
    "nome": "Felipe Nominato",
    "telefone": "5531982290789",
    "endereco": "Rua Ariramba 121, Alípio de Melo",
    "email": null
  },
  "pedido": {
    "data_evento": "2025-12-14",
    "hora_evento": "13:00",
    "itens": ["20 jogos de mesa", "4 toalhas"],
    "tipo_festa": null,
    "observacoes": "Pagamento 50% no PIX",
    "valor_estimado": null
  },
  "confianca": 0.95,
  "resumo": "Felipe quer alugar mesas e toalhas para 14/12 às 13h. Endereço: Alípio de Melo."
}

## EXEMPLO 2:
Conversa:
[10:30, 15/12/2025] Maria Clara: Oi bom dia! Vocês fazem entrega?
[10:32, 15/12/2025] Lu Festas: Olá Maria! Fazemos sim. Qual seria a data?
[10:33, 15/12/2025] Maria Clara: Dia 20/12, festa de aniversário da minha filha
[10:35, 15/12/2025] Maria Clara: Preciso de 10 mesas e 40 cadeiras
[10:40, 15/12/2025] Lu Festas: Perfeito! Qual o endereço?
[10:42, 15/12/2025] Maria Clara: Rua das Flores 456, bairro Centro

Extração:
{
  "cliente": {
    "nome": "Maria Clara",
    "telefone": null,
    "endereco": "Rua das Flores 456, Centro",
    "email": null
  },
  "pedido": {
    "data_evento": "2025-12-20",
    "hora_evento": null,
    "itens": ["10 mesas", "40 cadeiras"],
    "tipo_festa": "Aniversário infantil",
    "observacoes": null,
    "valor_estimado": null
  },
  "confianca": 0.9,
  "resumo": "Maria Clara quer mesas e cadeiras para aniversário dia 20/12 no Centro."
}`

function buildExtractionPrompt(conversation: string): string {
    return `${SYSTEM_PROMPT}

## CONVERSA PARA ANALISAR:
${conversation}

## INSTRUÇÕES:
1. Identifique quem é o CLIENTE (quem está pedindo orçamento/aluguel)
2. Extraia todos os dados disponíveis
3. Se a data mencionar "amanhã", calcule baseado na data das mensagens
4. Responda APENAS com JSON válido, sem texto antes ou depois
5. O resumo deve ter no máximo 120 caracteres`
}

// ============ Extraction ============

/**
 * Extrai dados da conversa usando Gemini 2.0
 */
export async function extractDataFromConversation(
    conversation: string,
    apiKey: string
): Promise<ExtractionResult> {
    // Preprocessa
    const cleaned = preprocessConversation(conversation)

    // Verifica se há conteúdo
    if (cleaned.length < 30) {
        return emptyResult('Conversa muito curta')
    }

    return await callGemini(cleaned, apiKey)
}

async function callGemini(conversation: string, apiKey: string): Promise<ExtractionResult> {
    const genAI = new GoogleGenerativeAI(apiKey)

    // Lista de modelos para tentar em ordem de prioridade
    // Alguns nomes podem mudar ou ser descontinuados, o loop garante resiliência
    const modelsToTry = [
        'gemini-1.5-flash-latest', // Tenta versão mais recente
        'gemini-1.5-flash',        // Tenta nome padrão
        'gemini-1.5-flash-002',    // Tenta versão específica recente
        'gemini-1.5-flash-001',    // Tenta versão estável anterior
        'gemini-1.5-flash-8b',     // Tenta versão leve
        'gemini-1.5-pro-latest'    // Fallback para Pro se Flash falhar
    ]

    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            console.log(`[Gemini] Tentando modelo: ${modelName}...`)
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 1500,
                }
            })

            const prompt = buildExtractionPrompt(conversation)

            const result = await model.generateContent(prompt)
            const response = result.response.text()

            console.log(`[Gemini] Sucesso com modelo: ${modelName}`)
            console.log('[Gemini] Resposta bruta:', response.substring(0, 200) + '...')

            // Parse e retorno
            return parseGeminiResponse(response)

        } catch (error: any) {
            console.warn(`[Gemini] Falha com modelo ${modelName}:`, error.message)
            lastError = error
            // Continua para o próximo modelo...
        }
    }

    console.error('[Gemini] Todos os modelos falharam. Último erro:', lastError)
    return emptyResult('Erro de conexão com IA (verifique quota ou chave)')
}

/**
 * Helper para parsear resposta JSON do Gemini
 */
function parseGeminiResponse(response: string): ExtractionResult {
    try {
        // Extrai JSON da resposta (pode vir com markdown)
        let jsonStr = response

        // Remove markdown code blocks se presentes
        const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonBlockMatch) {
            jsonStr = jsonBlockMatch[1]
        } else {
            // Tenta encontrar o objeto JSON diretamente
            const jsonMatch = response.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                jsonStr = jsonMatch[0]
            }
        }

        const parsed = JSON.parse(jsonStr.trim()) as ExtractionResult

        // Validação básica
        if (!parsed.cliente || !parsed.pedido) {
            return emptyResult('Estrutura de resposta inválida')
        }

        return normalizeExtraction(parsed)
    } catch (e) {
        console.error('Erro de parse JSON:', e)
        return emptyResult('Erro ao processar resposta da IA')
    }
}

function emptyResult(resumo: string): ExtractionResult {
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
        resumo
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
        // Se vier no formato DD/MM/YYYY, converte
        if (data.pedido.data_evento.includes('/')) {
            const [dia, mes, ano] = data.pedido.data_evento.split('/')
            data.pedido.data_evento = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
        }

        const eventDate = new Date(data.pedido.data_evento + 'T12:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Se a data é do passado (provavelmente ano errado), ajusta para o próximo ano
        if (eventDate < today) {
            eventDate.setFullYear(eventDate.getFullYear() + 1)
            data.pedido.data_evento = eventDate.toISOString().split('T')[0]
        }
    }

    // Garante que itens é array
    if (!Array.isArray(data.pedido.itens)) {
        data.pedido.itens = []
    }

    // Limita confiança entre 0 e 1
    data.confianca = Math.max(0, Math.min(1, data.confianca || 0))

    // Garante que resumo existe
    if (!data.resumo) {
        data.resumo = 'Dados extraídos com sucesso'
    }

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
