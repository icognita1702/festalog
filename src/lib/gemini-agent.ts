import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '')

const IntencaoSchema = z.enum([
  'disponibilidade',
  'preco',
  'orcamento',
  'atendente',
  'saudacao',
  'geral',
])

const ClassificacaoResponseSchema = z.object({
  intencao: IntencaoSchema,
  confianca: z.number().min(0).max(1),
  razao: z.string().optional(),
})

export type TipoIntencao = z.infer<typeof IntencaoSchema>

const CHAT_SYSTEM_PROMPT = `Voce e o assistente virtual de uma locadora de materiais para festas.

REGRAS:
1. Nao invente dados comerciais.
2. Se o nome da empresa, endereco, PIX ou cidade nao forem fornecidos, omita esses dados.
3. Seja simpatico, objetivo e profissional.
4. Use emojis com moderacao.
5. Para orcamentos: peca data, endereco e itens quando faltarem.
6. Para disponibilidade: pergunte a data do evento.
7. Se o caso fugir do padrao, encaminhe para atendente humano.
8. Responda de forma curta, apropriada para WhatsApp.`

export async function gerarRespostaIA(mensagemUsuario: string, historicoConversa?: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `${CHAT_SYSTEM_PROMPT}

${historicoConversa ? `HISTORICO DA CONVERSA:\n${historicoConversa}\n\n` : ''}MENSAGEM DO CLIENTE:
${mensagemUsuario}

Responda de forma natural e util:`

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    return text || 'Desculpe, nao consegui processar sua mensagem. Um atendente entrara em contato.'
  } catch (error) {
    console.error('Erro ao gerar resposta com Gemini:', error)
    return 'Desculpe, estou com dificuldades tecnicas. Um atendente entrara em contato em breve.'
  }
}

export async function classificarIntencao(mensagem: string): Promise<TipoIntencao> {
  const msgLower = mensagem.toLowerCase().trim()

  if (/^[1-4]$/.test(msgLower)) {
    const map: Record<string, TipoIntencao> = {
      '1': 'disponibilidade',
      '2': 'preco',
      '3': 'orcamento',
      '4': 'atendente',
    }

    return map[msgLower] || 'geral'
  }

  const keywords: Record<string, TipoIntencao> = {
    disponibilidade: 'disponibilidade',
    disponivel: 'disponibilidade',
    agenda: 'disponibilidade',
    'preço': 'preco',
    preco: 'preco',
    valor: 'preco',
    custa: 'preco',
    orcamento: 'orcamento',
    alugar: 'orcamento',
    reservar: 'orcamento',
    atendente: 'atendente',
    humano: 'atendente',
    oi: 'saudacao',
    ola: 'saudacao',
    'bom dia': 'saudacao',
  }

  for (const [key, value] of Object.entries(keywords)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i')
    if (regex.test(mensagem)) {
      return value
    }
  }

  if (msgLower.length < 5) {
    return 'geral'
  }

  try {
    return await classificarViaGemini(mensagem)
  } catch (error) {
    console.warn('Falha na classificacao via IA, usando fallback geral:', error)
    return 'geral'
  }
}

async function classificarViaGemini(mensagem: string): Promise<TipoIntencao> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })

  const prompt = `Classifique a intencao desta mensagem de WhatsApp para uma locadora de festas.
Categorias possiveis: ${IntencaoSchema.options.map((option) => `"${option}"`).join(', ')}.

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
  } catch {
    // Ignore malformed JSON and fall through to "geral".
  }

  return 'geral'
}
