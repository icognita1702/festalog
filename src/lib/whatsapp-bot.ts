import { supabase } from './supabase'
import { enviarMensagem } from './evolution-api'
import { gerarRespostaIA, classificarIntencao } from './gemini-agent'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Respostas pré-definidas
const respostas = {
    saudacao: `Olá! 👋 Bem-vindo(a) à *Lu Festas*!

Como posso ajudar?

1️⃣ Ver disponibilidade
2️⃣ Lista de preços
3️⃣ Fazer orçamento
4️⃣ Falar com atendente

_Digite o número da opção desejada_`,

    disponibilidade: `📅 *Consulta de Disponibilidade*

Para qual data você precisa dos materiais?

_Responda no formato: DD/MM/AAAA_
_Exemplo: 25/12/2024_`,

    precos: `💰 *Tabela de Preços - Lu Festas*

🪑 *Cadeiras*
• Cadeira plástica: R$ 3,00/un

🍽️ *Mesas*
• Mesa redonda 1,20m: R$ 15,00/un
• Mesa retangular: R$ 12,00/un

🎨 *Toalhas*
• Toalha redonda: R$ 8,00/un
• Toalha retangular: R$ 6,00/un

🧊 *Caixa Térmica*
• 26L: R$ 20,00/un
• 45L: R$ 30,00/un

📦 *Frete*: A combinar (depende da região)

_Digite *orçamento* para fazer um pedido!_`,

    orcamento: `📝 *Vamos fazer seu orçamento!*

Por favor, me informe:

1. Data do evento (DD/MM/AAAA)
2. Endereço completo
3. Lista de itens e quantidades

_Exemplo:_
_20/12/2024_
_Rua das Flores, 123 - Bairro_
_30 cadeiras, 3 mesas redondas_`,

    atendente: `👤 *Encaminhando para atendimento humano*

Um de nossos atendentes entrará em contato em breve!

⏰ Horário de atendimento:
• Seg a Sex: 8h às 18h
• Sábado: 8h às 12h

_Aguarde, por favor!_ 🙏`,

    erro: `Desculpe, não entendi sua mensagem. 😅

Digite *menu* para ver as opções disponíveis.`,
}

// Cache simples de estado de conversa
const estadoConversa: Map<string, { etapa: string; dados: Record<string, string> }> = new Map()

export async function processarMensagem(numero: string, mensagem: string, nomeContato?: string): Promise<string> {
    const msgLower = mensagem.toLowerCase().trim()

    // Verifica se é comando de menu
    if (msgLower === 'menu' || msgLower === 'inicio' || msgLower === 'voltar') {
        estadoConversa.delete(numero)
        return respostas.saudacao
    }

    // Verifica estado atual da conversa
    const estado = estadoConversa.get(numero)

    // Se está esperando data para disponibilidade
    if (estado?.etapa === 'aguardando_data') {
        const dataMatch = mensagem.match(/(\d{2})\/(\d{2})\/(\d{4})/)
        if (dataMatch) {
            const [, dia, mes, ano] = dataMatch
            const dataFormatada = `${ano}-${mes}-${dia}`

            try {
                const disponibilidade = await consultarDisponibilidade(dataFormatada)
                estadoConversa.delete(numero)
                return disponibilidade
            } catch (error) {
                return 'Erro ao consultar disponibilidade. Tente novamente ou digite *menu*.'
            }
        } else {
            return 'Por favor, informe a data no formato DD/MM/AAAA (ex: 25/12/2024)'
        }
    }

    // Classifica a intenção da mensagem
    const intencao = await classificarIntencao(mensagem)

    switch (intencao) {
        case 'saudacao':
            return respostas.saudacao

        case 'disponibilidade':
            estadoConversa.set(numero, { etapa: 'aguardando_data', dados: {} })
            return respostas.disponibilidade

        case 'preco':
            return respostas.precos

        case 'orcamento':
            return respostas.orcamento

        case 'atendente':
            // Aqui poderia notificar o dashboard que precisa de atendimento
            await marcarPrecisaAtendente(numero, nomeContato || 'Cliente')
            return respostas.atendente

        case 'geral':
        default:
            // Usa IA para responder
            const respostaIA = await gerarRespostaIA(mensagem)
            return respostaIA
    }
}

async function consultarDisponibilidade(data: string): Promise<string> {
    const { data: disponibilidade, error } = await supabase
        .rpc('calcular_disponibilidade', { data_consulta: data })

    if (error) {
        console.error('Erro ao consultar disponibilidade:', error)
        throw error
    }

    if (!disponibilidade || disponibilidade.length === 0) {
        return `📅 Nenhum produto cadastrado no sistema.

Entre em contato com um atendente para mais informações.`
    }

    const dataFormatada = format(new Date(data + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })

    let resposta = `📅 *Disponibilidade para ${dataFormatada}:*\n\n`

    for (const item of disponibilidade) {
        const emoji = item.quantidade_disponivel > 0 ? '✅' : '❌'
        resposta += `${emoji} *${item.nome}*: ${item.quantidade_disponivel} disponíveis\n`
    }

    resposta += `\n_Digite *orçamento* para fazer um pedido!_`

    return resposta
}

async function marcarPrecisaAtendente(numero: string, nome: string): Promise<void> {
    // Aqui você poderia salvar no banco de dados para o dashboard mostrar
    console.log(`[BOT] Cliente ${nome} (${numero}) precisa de atendente humano`)

    // Opcional: criar uma tabela de pendências no Supabase
    // await supabase.from('atendimentos_pendentes').insert({ numero, nome, created_at: new Date() })
}

export async function enviarMensagemBot(numero: string, texto: string): Promise<boolean> {
    return await enviarMensagem({ number: numero, text: texto })
}
