import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '')

const systemPrompt = `Você é o assistente virtual da Lu Festas, uma locadora de materiais para festas em Belo Horizonte.

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

REGRAS DE ATENDIMENTO:
1. Seja simpático, objetivo e profissional
2. Use emojis com moderação para deixar a conversa amigável
3. Para orçamentos, sempre peça: data do evento, endereço e lista de itens
4. Para verificar disponibilidade, pergunte a data
5. NÃO invente preços - diga que vai verificar e retornar
6. Se a pergunta for muito complexa ou precisar de intervenção humana, diga educadamente que um atendente vai entrar em contato
7. Sempre ofereça opções quando possível
8. Responda sempre em português brasileiro

FLUXO TÍPICO:
1. Saudação → Oferecer menu de opções
2. Disponibilidade → Pedir data → Consultar sistema
3. Orçamento → Pedir data, endereço e itens → Calcular
4. Dúvidas → Responder ou encaminhar para atendente

IMPORTANTE:
- Nunca compartilhe informações falsas
- Se não souber algo, admita e ofereça ajuda de um atendente
- Mantenha respostas concisas (WhatsApp não é e-mail)
`

export async function gerarRespostaIA(mensagemUsuario: string, historicoConversa?: string): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        const prompt = `${systemPrompt}

${historicoConversa ? `HISTÓRICO DA CONVERSA:\n${historicoConversa}\n\n` : ''}
MENSAGEM DO CLIENTE:
${mensagemUsuario}

Responda de forma natural e útil:`

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        return text || 'Desculpe, não consegui processar sua mensagem. Um atendente entrará em contato.'
    } catch (error) {
        console.error('Erro ao gerar resposta com Gemini:', error)
        return 'Desculpe, estou com dificuldades técnicas. Um atendente entrará em contato em breve. 🙏'
    }
}

export async function classificarIntencao(mensagem: string): Promise<'disponibilidade' | 'preco' | 'orcamento' | 'atendente' | 'saudacao' | 'geral'> {
    const msgLower = mensagem.toLowerCase()

    // Palavras-chave para classificação rápida (sem usar IA)
    const intencoes = {
        saudacao: ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'opa', 'eai', 'e ai', 'hey', 'hi'],
        disponibilidade: ['disponível', 'disponivel', 'tem', 'livre', 'data', 'dia', 'agenda', 'vago'],
        preco: ['preço', 'preco', 'valor', 'quanto', 'custa', 'tabela', 'valores'],
        orcamento: ['orçamento', 'orcamento', 'alugar', 'reservar', 'quero', 'preciso', 'festa'],
        atendente: ['atendente', 'humano', 'pessoa', 'falar', 'ligar', 'ajuda'],
    }

    for (const [intencao, palavras] of Object.entries(intencoes)) {
        if (palavras.some(p => msgLower.includes(p))) {
            return intencao as 'disponibilidade' | 'preco' | 'orcamento' | 'atendente' | 'saudacao'
        }
    }

    // Verifica números (menu interativo)
    if (/^[1-4]$/.test(mensagem.trim())) {
        const opcoes: Record<string, 'disponibilidade' | 'preco' | 'orcamento' | 'atendente'> = {
            '1': 'disponibilidade',
            '2': 'preco',
            '3': 'orcamento',
            '4': 'atendente',
        }
        return opcoes[mensagem.trim()]
    }

    return 'geral'
}
