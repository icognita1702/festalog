'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Loader2,
    FileText,
    Share2,
    PartyPopper,
    Truck,
    Calendar,
    MapPin,
    Phone,
    Download,
    CheckCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import type { PedidoCompleto, ItemPedido, Produto } from '@/lib/database.types'

type ItemPedidoComProduto = ItemPedido & { produtos: Produto }

export default function OrcamentoTemplatePage() {
    const params = useParams()
    const pedidoId = params.id as string

    const [pedido, setPedido] = useState<PedidoCompleto | null>(null)
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)

    async function loadPedido() {
        setLoading(true)
        const { data, error } = await supabase
            .from('pedidos')
            .select('*, clientes(*), itens_pedido(*, produtos(*))')
            .eq('id', pedidoId)
            .single()

        if (error) {
            console.error('Erro ao carregar orçamento:', error)
        } else {
            setPedido(data as PedidoCompleto)
        }
        setLoading(false)
    }

    useEffect(() => {
        loadPedido()
    }, [pedidoId])

    function shareWhatsApp() {
        if (!pedido) return

        let msg = `🎉 *Orçamento - Lu Festas*\n\n`
        msg += `Olá ${pedido.clientes?.nome}!\n\n`
        msg += `📋 *Itens:*\n`

        pedido.itens_pedido?.forEach((item: ItemPedidoComProduto) => {
            const subtotal = item.quantidade * item.preco_unitario
            msg += `• ${item.quantidade}x ${item.produtos?.nome} - ${formatCurrency(subtotal)}\n`
        })

        const subtotal = pedido.itens_pedido?.reduce((acc: number, item: ItemPedidoComProduto) =>
            acc + (item.quantidade * item.preco_unitario), 0) || 0
        const frete = (pedido as any).frete || 0

        msg += `\n📦 Subtotal: ${formatCurrency(subtotal)}`
        msg += `\n🚚 Frete: ${formatCurrency(frete)}`
        msg += `\n\n💰 *Total: ${formatCurrency(pedido.total_pedido)}*`

        if (pedido.data_evento) {
            msg += `\n\n📅 Data do evento: ${format(new Date(pedido.data_evento + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}`
        }

        msg += `\n\n🔗 Veja o orçamento completo:`
        msg += `\n${window.location.href}`
        msg += `\n\n_Orçamento válido por 7 dias_`

        const whatsappNumber = pedido.clientes?.whatsapp?.replace(/\D/g, '') || ''
        const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`
        window.open(url, '_blank')
    }

    function copyLink() {
        navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    function formatCurrency(value: number) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!pedido) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg">Orçamento não encontrado</p>
            </div>
        )
    }

    const subtotal = pedido.itens_pedido?.reduce((acc: number, item: ItemPedidoComProduto) =>
        acc + (item.quantidade * item.preco_unitario), 0) || 0
    const frete = (pedido as any).frete || 0

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 md:p-8">
            <div className="mx-auto max-w-3xl space-y-6">
                {/* Header */}
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <PartyPopper className="h-8 w-8 text-primary" />
                        <span className="text-2xl font-bold">Lu Festas</span>
                    </div>
                    <h1 className="text-3xl font-bold">Orçamento</h1>
                    <p className="text-muted-foreground mt-2">
                        Proposta personalizada para {pedido.clientes?.nome}
                    </p>
                    <Badge variant="secondary" className="mt-2">
                        Válido por 7 dias
                    </Badge>
                </div>

                {/* Client Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Dados do Cliente</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-lg font-bold text-primary">
                                    {pedido.clientes?.nome?.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <p className="font-medium">{pedido.clientes?.nome}</p>
                                {pedido.clientes?.whatsapp && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {pedido.clientes.whatsapp}
                                    </p>
                                )}
                            </div>
                        </div>
                        {pedido.clientes?.endereco_completo && (
                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4 mt-0.5" />
                                <span>{pedido.clientes.endereco_completo}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Event Date */}
                {pedido.data_evento && (
                    <Card>
                        <CardContent className="flex items-center justify-between py-4">
                            <div className="flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-primary" />
                                <span className="font-medium">Data do Evento</span>
                            </div>
                            <Badge variant="outline" className="text-lg px-4 py-1">
                                {format(new Date(pedido.data_evento + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </Badge>
                        </CardContent>
                    </Card>
                )}

                {/* Items */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Itens do Orçamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="text-center">Qtd</TableHead>
                                    <TableHead className="text-right">Preço Unit.</TableHead>
                                    <TableHead className="text-right">Subtotal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pedido.itens_pedido?.map((item: ItemPedidoComProduto) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.produtos?.nome}</TableCell>
                                        <TableCell className="text-center">{item.quantidade}</TableCell>
                                        <TableCell className="text-right">
                                            {formatCurrency(item.preco_unitario)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatCurrency(item.quantidade * item.preco_unitario)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {/* Totals */}
                        <div className="mt-6 space-y-2 border-t pt-4">
                            <div className="flex justify-between text-sm">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="flex items-center gap-1">
                                    <Truck className="h-3 w-3" />
                                    Frete (entrega + recolhimento)
                                </span>
                                <span>{formatCurrency(frete)}</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold border-t pt-4">
                                <span>Total</span>
                                <span className="text-primary">{formatCurrency(pedido.total_pedido)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Terms */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Condições</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                            <li>Pagamento de 50% na confirmação do pedido</li>
                            <li>Restante (50%) no momento da entrega</li>
                            <li>Entrega e recolhimento inclusos no valor do frete</li>
                            <li>Cancelamento até 48h antes sem cobrança de multa</li>
                            <li>Danos aos materiais serão cobrados pelo valor de reposição</li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Observations */}
                {pedido.observacoes && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Observações</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {pedido.observacoes}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Button className="flex-1 gap-2" size="lg" onClick={shareWhatsApp}>
                        <Share2 className="h-4 w-4" />
                        Enviar via WhatsApp
                    </Button>
                    <Button variant="outline" className="flex-1 gap-2" size="lg" onClick={copyLink}>
                        {copied ? (
                            <>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                Link Copiado!
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                Copiar Link
                            </>
                        )}
                    </Button>
                </div>

                {/* Accept Button */}
                <Button
                    asChild
                    className="w-full gap-2"
                    size="lg"
                    variant="default"
                >
                    <Link href={`/contrato/${pedido.id}`}>
                        <CheckCircle className="h-4 w-4" />
                        Aceitar Orçamento e Assinar Contrato
                    </Link>
                </Button>

                {/* Footer */}
                <div className="text-center text-sm text-muted-foreground pt-4">
                    <div className="flex items-center justify-center gap-2">
                        <PartyPopper className="h-4 w-4" />
                        <span>Lu Festas - Aluguel de materiais para festas</span>
                    </div>
                    <p className="mt-1">Belo Horizonte - MG</p>
                </div>
            </div>
        </div>
    )
}
