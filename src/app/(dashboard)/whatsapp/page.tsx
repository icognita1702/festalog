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
    Package
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { PedidoComCliente } from '@/lib/database.types'

type TemplateType = 'orcamento' | 'contrato' | 'cobranca' | 'entrega' | 'recolhimento' | 'avaliacao'

const templates: Record<TemplateType, { titulo: string; icone: React.ReactNode; mensagem: string }> = {
    orcamento: {
        titulo: 'Confirmar Orçamento',
        icone: <FileText className="h-5 w-5" />,
        mensagem: `Olá {nome}! 👋

Tudo bem? Aqui é da *Lu Festas*.

Segue o orçamento solicitado:
📅 Data do evento: {data_evento}
💰 Valor total: {total}

Deseja confirmar a locação? Assim podemos enviar o contrato! 📝`,
    },
    contrato: {
        titulo: 'Enviar Contrato',
        icone: <FileText className="h-5 w-5" />,
        mensagem: `Olá {nome}! 👋

Seu contrato de locação da *Lu Festas* está pronto!

📅 Data do evento: {data_evento}
💰 Valor total: {total}

Por favor, acesse o link abaixo para assinar digitalmente:
🔗 {link_contrato}

Em caso de dúvidas, estamos à disposição! ✨`,
    },
    cobranca: {
        titulo: 'Cobrar Sinal (50%)',
        icone: <DollarSign className="h-5 w-5" />,
        mensagem: `Olá {nome}! 👋

Passando para lembrar sobre o sinal do seu pedido na *Lu Festas*:

📅 Data do evento: {data_evento}
💰 Valor do sinal (50%): {valor_sinal}

*Dados para pagamento:*
PIX: (seu pix aqui)

Após o pagamento, envie o comprovante por aqui! ✅`,
    },
    entrega: {
        titulo: 'Aviso de Entrega',
        icone: <Truck className="h-5 w-5" />,
        mensagem: `Olá {nome}! 🚚

Aqui é da *Lu Festas*! Estamos a caminho com sua entrega!

📍 Endereço: {endereco}
⏰ Previsão: Em breve!

Por favor, certifique-se de que haverá alguém para receber.

Qualquer dúvida, é só chamar! 📲`,
    },
    recolhimento: {
        titulo: 'Agendamento de Recolhimento',
        icone: <Package className="h-5 w-5" />,
        mensagem: `Olá {nome}! 👋

Aqui é da *Lu Festas*! Passando para confirmar o *recolhimento* dos materiais amanhã!

📍 Endereço: {endereco}
⏰ Horário previsto: Manhã

Por favor, deixe os itens organizados para facilitar o recolhimento.

Agradecemos a preferência! 🎉`,
    },
    avaliacao: {
        titulo: 'Pedir Avaliação',
        icone: <Star className="h-5 w-5" />,
        mensagem: `Olá {nome}! 🎉

Obrigado por escolher a *Lu Festas* para seu evento!

Ficamos muito felizes em fazer parte desse momento especial. ✨

Se você gostou do nosso serviço, nos ajude com uma avaliação de 5 estrelas:
⭐ {link_google}

Sua opinião é muito importante para nós! 💙`,
    },
}

export default function WhatsAppPage() {
    const [pedidos, setPedidos] = useState<PedidoComCliente[]>([])
    const [loading, setLoading] = useState(true)
    const [pedidoSelecionado, setPedidoSelecionado] = useState<string>('')
    const [templateSelecionado, setTemplateSelecionado] = useState<TemplateType>('orcamento')
    const [mensagemFinal, setMensagemFinal] = useState('')
    const [copiado, setCopiado] = useState(false)

    const linkGoogle = 'https://g.page/r/SUA_AVALIACAO_AQUI'

    async function loadPedidos() {
        setLoading(true)
        const { data, error } = await supabase
            .from('pedidos')
            .select('*, clientes(*)')
            .not('status', 'eq', 'finalizado')
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
                msg = msg.replace(/{link_contrato}/g, `${window.location.origin}/contrato/${pedido.id}`)
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

    function enviarWhatsApp() {
        const pedido = pedidos.find(p => p.id === pedidoSelecionado)
        if (!pedido) return

        const number = pedido.clientes?.whatsapp.replace(/\D/g, '') || ''
        const message = encodeURIComponent(mensagemFinal)
        window.open(`https://wa.me/55${number}?text=${message}`, '_blank')
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
                {/* Seleção */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Selecionar Pedido</CardTitle>
                            <CardDescription>Escolha o pedido para enviar mensagem</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {loading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : (
                                <Select value={pedidoSelecionado} onValueChange={setPedidoSelecionado}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um pedido" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {pedidos.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.clientes?.nome} - {new Date(p.data_evento + 'T12:00:00').toLocaleDateString('pt-BR')}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {pedido && (
                                <div className="rounded-lg bg-muted p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{pedido.clientes?.nome}</span>
                                        <Badge>{pedido.status}</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {pedido.clientes?.whatsapp}
                                    </p>
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
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                onClick={enviarWhatsApp}
                                disabled={!mensagemFinal || !pedidoSelecionado}
                            >
                                <Send className="mr-2 h-4 w-4" />
                                Enviar via WhatsApp
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Dicas */}
            <Card>
                <CardHeader>
                    <CardTitle>💡 Dicas de Uso</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                        <li>As variáveis entre chaves <code>{'{nome}'}</code> são substituídas automaticamente</li>
                        <li>Você pode editar a mensagem antes de enviar</li>
                        <li>Use <code>*texto*</code> para negrito no WhatsApp</li>
                        <li>Configure o link do Google Meu Negócio no código para o template de avaliação</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    )
}
