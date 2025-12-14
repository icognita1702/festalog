'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    MessageCircle,
    Send,
    Copy,
    Check,
    Phone,
    Loader2,
    Star,
    FileText,
    DollarSign,
    Truck,
    Package,
    CheckCircle2,
    XCircle,
    ExternalLink
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { EmojiText } from '@/components/ui/emoji-text'
import type { PedidoComCliente } from '@/lib/database.types'

type TemplateType = 'orcamento' | 'contrato' | 'cobranca' | 'entrega' | 'recolhimento' | 'avaliacao'
type SendStatus = 'idle' | 'sending' | 'success' | 'error'


// Emojis como constantes para garantir encoding correto
const EMOJI = {
    wave: '\u{1F44B}',
    calendar: '\u{1F4C5}',
    money: '\u{1F4B0}',
    card: '\u{1F4B3}',
    memo: '\u{1F4DD}',
    check: '\u{2705}',
    party: '\u{1F389}',
    bank: '\u{1F3E6}',
    truck: '\u{1F69A}',
    pin: '\u{1F4CD}',
    clock: '\u{23F0}',
    phone: '\u{1F4F2}',
    star: '\u{2B50}',
    sparkles: '\u{2728}',
    heart: '\u{1F499}',
    package: '\u{1F4E6}',
}

const templates: Record<TemplateType, { titulo: string; icone: React.ReactNode; mensagem: string }> = {
    orcamento: {
        titulo: 'Confirmar Orçamento',
        icone: <FileText className="h-5 w-5" />,
        mensagem: `Olá {nome}! ${EMOJI.wave}

Tudo bem? Aqui é da *Lu Festas*.

Segue o orçamento solicitado:
${EMOJI.calendar} Data do evento: {data_evento}
${EMOJI.money} Valor total: {total}

Deseja confirmar a locação? Assim podemos enviar o contrato! ${EMOJI.memo}`,
    },
    contrato: {
        titulo: 'Lembrete de Contrato',
        icone: <FileText className="h-5 w-5" />,
        mensagem: `Olá {nome}! ${EMOJI.wave}

Aqui é da *Lu Festas*! ${EMOJI.party}

Passando para lembrar sobre o contrato do seu evento:

${EMOJI.calendar} Data do evento: {data_evento}
${EMOJI.money} Valor total: {total}
${EMOJI.card} Sinal (50%): {valor_sinal}

Você já pode assinar o contrato e garantir sua reserva! ${EMOJI.memo}

Confirma que posso enviar o contrato para assinatura? ${EMOJI.check}`,
    },
    cobranca: {
        titulo: 'Cobrar Sinal (50%)',
        icone: <DollarSign className="h-5 w-5" />,
        mensagem: `Olá {nome}! ${EMOJI.wave}

Passando para lembrar sobre o sinal do seu pedido na *Lu Festas*:

${EMOJI.calendar} Data do evento: {data_evento}
${EMOJI.money} Valor do sinal (50%): {valor_sinal}

${EMOJI.bank} *Dados para pagamento:*
Chave PIX CNPJ: 46.446.131/0001-06
Nome: GABRIEL LUCAS
Banco: CORA SCD

Após o pagamento, envie o comprovante por aqui! ${EMOJI.check}`,
    },
    entrega: {
        titulo: 'Aviso de Entrega',
        icone: <Truck className="h-5 w-5" />,
        mensagem: `Olá {nome}! ${EMOJI.truck}

Aqui é da *Lu Festas*! Estamos a caminho com sua entrega!

${EMOJI.pin} Endereço: {endereco}
${EMOJI.clock} Previsão: Em breve!

Por favor, certifique-se de que haverá alguém para receber.

Qualquer dúvida, é só chamar! ${EMOJI.phone}`,
    },
    recolhimento: {
        titulo: 'Agendamento de Recolhimento',
        icone: <Package className="h-5 w-5" />,
        mensagem: `Olá {nome}! ${EMOJI.wave}

Aqui é da *Lu Festas*! Passando para confirmar o *recolhimento* dos materiais amanhã!

${EMOJI.pin} Endereço: {endereco}
${EMOJI.clock} Horário previsto: Manhã

Por favor, deixe os itens organizados para facilitar o recolhimento.

Agradecemos a preferência! ${EMOJI.party}`,
    },
    avaliacao: {
        titulo: 'Pedir Avaliação',
        icone: <Star className="h-5 w-5" />,
        mensagem: `Olá {nome}! ${EMOJI.party}

Obrigado por escolher a *Lu Festas* para seu evento!

Ficamos muito felizes em fazer parte desse momento especial. ${EMOJI.sparkles}

Se você gostou do nosso serviço, nos ajude com uma avaliação de 5 estrelas:
${EMOJI.star} {link_google}

Sua opinião é muito importante para nós! ${EMOJI.heart}`,
    },
}

const linkGoogle = 'https://search.google.com/local/writereview?placeid=ChIJxyFz3xGXpgAR8jNtT0lyZTE'

export default function WhatsAppPage() {
    const [pedidos, setPedidos] = useState<PedidoComCliente[]>([])
    const [loading, setLoading] = useState(true)
    const [pedidoSelecionado, setPedidoSelecionado] = useState<string>('')
    const [templateSelecionado, setTemplateSelecionado] = useState<TemplateType | null>(null)
    const [mensagemFinal, setMensagemFinal] = useState('')
    const [copiado, setCopiado] = useState(false)
    const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
    const [errorMessage, setErrorMessage] = useState('')

    async function loadPedidos() {
        const { data, error } = await supabase
            .from('pedidos')
            .select(`
                *,
                clientes (*)
            `)
            .order('data_evento', { ascending: true })

        if (error) {
            console.error('Erro ao carregar pedidos:', error)
        } else {
            setPedidos((data as PedidoComCliente[]) || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        loadPedidos()
    }, [])

    useEffect(() => {
        if (pedidoSelecionado && templateSelecionado) {
            const pedido = pedidos.find(p => p.id === pedidoSelecionado)
            if (pedido) {
                let msg = templates[templateSelecionado].mensagem
                msg = msg.replace(/{nome}/g, pedido.clientes?.nome || '')
                msg = msg.replace(/{data_evento}/g, new Date(pedido.data_evento + 'T12:00:00').toLocaleDateString('pt-BR'))
                msg = msg.replace(/{total}/g, new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido))
                msg = msg.replace(/{valor_sinal}/g, new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido / 2))
                msg = msg.replace(/{endereco}/g, pedido.clientes?.endereco_completo || '')
                msg = msg.replace(/{link_google}/g, linkGoogle)
                setMensagemFinal(msg)
            }
        }
    }, [pedidoSelecionado, templateSelecionado, pedidos])

    function copiarMensagem() {
        navigator.clipboard.writeText(mensagemFinal)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
    }

    async function enviarDireto() {
        const pedido = pedidos.find(p => p.id === pedidoSelecionado)
        if (!pedido || !mensagemFinal) return

        setSendStatus('sending')
        setErrorMessage('')

        try {
            const number = '55' + (pedido.clientes?.whatsapp.replace(/\D/g, '') || '')

            const response = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    number,
                    text: mensagemFinal
                })
            })

            const result = await response.json()

            if (response.ok && result.success) {
                setSendStatus('success')
                setTimeout(() => setSendStatus('idle'), 3000)
            } else {
                setSendStatus('error')
                setErrorMessage(result.error || 'Erro ao enviar mensagem')
                setTimeout(() => setSendStatus('idle'), 5000)
            }
        } catch (error) {
            setSendStatus('error')
            setErrorMessage('Erro de conexão. Verifique se o WhatsApp está conectado.')
            setTimeout(() => setSendStatus('idle'), 5000)
        }
    }

    function enviarWhatsAppWeb() {
        const pedido = pedidos.find(p => p.id === pedidoSelecionado)
        if (!pedido) return

        const number = pedido.clientes?.whatsapp.replace(/\D/g, '') || ''
        const message = encodeURIComponent(mensagemFinal)
        window.open(`https://api.whatsapp.com/send?phone=55${number}&text=${message}`, '_blank')
    }

    const pedido = pedidos.find(p => p.id === pedidoSelecionado)

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">WhatsApp</h1>
                <p className="text-muted-foreground">
                    Envie mensagens padronizadas para seus clientes
                </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
                {/* Selecao */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Selecione o Pedido</CardTitle>
                            <CardDescription>Escolha o cliente para enviar a mensagem</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <Select value={pedidoSelecionado} onValueChange={setPedidoSelecionado}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecionar pedido..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {pedidos.map((pedido) => (
                                            <SelectItem key={pedido.id} value={pedido.id}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{pedido.clientes?.nome}</span>
                                                    <span className="text-muted-foreground">-</span>
                                                    <span className="text-sm text-muted-foreground">
                                                        {new Date(pedido.data_evento + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {pedido && (
                                <div className="mt-4 rounded-lg bg-muted p-4">
                                    <div className="flex items-center gap-3">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{pedido.clientes?.whatsapp}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Templates de Mensagem</CardTitle>
                            <CardDescription>Escolha o tipo de mensagem a enviar</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3">
                                {(Object.entries(templates) as [TemplateType, typeof templates[TemplateType]][]).map(([key, template]) => (
                                    <Button
                                        key={key}
                                        variant={templateSelecionado === key ? 'default' : 'outline'}
                                        className="h-auto flex-col gap-2 p-4"
                                        onClick={() => setTemplateSelecionado(key)}
                                    >
                                        {template.icone}
                                        <span className="text-xs">{template.titulo}</span>
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Preview e Envio */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageCircle className="h-5 w-5 text-green-500" />
                            Mensagem
                        </CardTitle>
                        <CardDescription>
                            Edite a mensagem antes de enviar
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Mensagem</Label>
                            <Textarea
                                value={mensagemFinal}
                                onChange={(e) => setMensagemFinal(e.target.value)}
                                rows={12}
                                className="font-mono text-sm"
                                placeholder="Selecione um pedido e um template..."
                            />
                        </div>

                        {/* Preview com emojis renderizados */}
                        {mensagemFinal && (
                            <div className="grid gap-2">
                                <Label>Preview (como aparece no WhatsApp)</Label>
                                <div className="rounded-lg bg-[#e5ded8] p-4 text-sm text-gray-800">
                                    <div className="rounded-lg bg-white p-3 shadow-sm">
                                        <EmojiText text={mensagemFinal} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Status de envio */}
                        {sendStatus === 'success' && (
                            <div className="flex items-center gap-2 rounded-lg bg-green-100 p-3 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="font-medium">Mensagem enviada com sucesso!</span>
                            </div>
                        )}

                        {sendStatus === 'error' && (
                            <div className="flex items-center gap-2 rounded-lg bg-red-100 p-3 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                <XCircle className="h-5 w-5" />
                                <span className="font-medium">{errorMessage}</span>
                            </div>
                        )}

                        <div className="space-y-3">
                            {/* Botão principal - Envio direto */}
                            <Button
                                className="w-full bg-green-600 hover:bg-green-700"
                                onClick={enviarDireto}
                                disabled={!mensagemFinal || !pedidoSelecionado || sendStatus === 'sending'}
                            >
                                {sendStatus === 'sending' ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : sendStatus === 'success' ? (
                                    <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Enviado!
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Enviar Direto (Bot)
                                    </>
                                )}
                            </Button>

                            {/* Botões secundários */}
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={copiarMensagem}
                                    disabled={!mensagemFinal}
                                >
                                    {copiado ? (
                                        <>
                                            <Check className="mr-2 h-4 w-4" />
                                            Copiado!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copiar
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={enviarWhatsAppWeb}
                                    disabled={!mensagemFinal || !pedidoSelecionado}
                                >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    WhatsApp Web
                                </Button>
                            </div>

                            <p className="text-xs text-muted-foreground text-center">
                                💡 "Enviar Direto" usa o bot conectado. "WhatsApp Web" abre no navegador.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
