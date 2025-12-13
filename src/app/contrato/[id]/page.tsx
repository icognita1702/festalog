'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    CheckCircle,
    Eraser,
    PartyPopper
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import type { PedidoCompleto, ItemPedido, Produto } from '@/lib/database.types'

type ItemPedidoComProduto = ItemPedido & { produtos: Produto }

export default function ContratoAssinaturaPage() {
    const params = useParams()
    const pedidoId = params.id as string
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const [pedido, setPedido] = useState<PedidoCompleto | null>(null)
    const [loading, setLoading] = useState(true)
    const [salvando, setSalvando] = useState(false)
    const [assinado, setAssinado] = useState(false)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasSignature, setHasSignature] = useState(false)

    async function loadPedido() {
        setLoading(true)
        const { data, error } = await supabase
            .from('pedidos')
            .select('*, clientes(*), itens_pedido(*, produtos(*))')
            .eq('id', pedidoId)
            .single()

        if (error) {
            console.error('Erro ao carregar pedido:', error)
        } else {
            setPedido(data as PedidoCompleto)
            if (data.status === 'assinado' || data.assinatura_url) {
                setAssinado(true)
            }
        }
        setLoading(false)
    }

    useEffect(() => {
        loadPedido()
    }, [pedidoId])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Configurar canvas
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        // Fundo branco
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
    }, [loading])

    function startDrawing(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
        setIsDrawing(true)
        setHasSignature(true)
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        let x, y

        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left
            y = e.touches[0].clientY - rect.top
        } else {
            x = e.clientX - rect.left
            y = e.clientY - rect.top
        }

        ctx.beginPath()
        ctx.moveTo(x, y)
    }

    function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
        if (!isDrawing) return
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        let x, y

        if ('touches' in e) {
            e.preventDefault()
            x = e.touches[0].clientX - rect.left
            y = e.touches[0].clientY - rect.top
        } else {
            x = e.clientX - rect.left
            y = e.clientY - rect.top
        }

        ctx.lineTo(x, y)
        ctx.stroke()
    }

    function stopDrawing() {
        setIsDrawing(false)
    }

    function limparAssinatura() {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        setHasSignature(false)
    }

    async function salvarAssinatura() {
        if (!hasSignature || !canvasRef.current || !pedido) return

        setSalvando(true)

        try {
            // Converter canvas para blob
            const canvas = canvasRef.current
            const blob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((blob) => resolve(blob!), 'image/png')
            })

            // Upload para Supabase Storage
            const fileName = `assinaturas/${pedido.id}_${Date.now()}.png`
            const { error: uploadError } = await supabase.storage
                .from('contratos')
                .upload(fileName, blob, { contentType: 'image/png' })

            if (uploadError) {
                console.error('Erro ao fazer upload:', uploadError)
                // Continuar mesmo sem upload (salvar como base64)
            }

            // Atualizar pedido
            const { error: updateError } = await supabase
                .from('pedidos')
                .update({
                    status: 'assinado',
                    assinatura_url: fileName
                })
                .eq('id', pedido.id)

            if (updateError) throw updateError

            setAssinado(true)
        } catch (error) {
            console.error('Erro ao salvar assinatura:', error)
            alert('Erro ao salvar assinatura. Tente novamente.')
        } finally {
            setSalvando(false)
        }
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
                <p className="mt-4 text-lg">Contrato não encontrado</p>
            </div>
        )
    }

    if (assinado) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-green-50 p-4 dark:bg-green-950">
                <CheckCircle className="h-20 w-20 text-green-500" />
                <h1 className="mt-6 text-3xl font-bold text-green-700 dark:text-green-400">
                    Contrato Assinado!
                </h1>
                <p className="mt-2 text-center text-muted-foreground">
                    Obrigado, {pedido.clientes?.nome}! Seu contrato foi assinado com sucesso.
                </p>
                <p className="mt-1 text-center text-muted-foreground">
                    Entraremos em contato para confirmar os próximos passos.
                </p>
                <div className="mt-8 flex items-center gap-2 text-muted-foreground">
                    <PartyPopper className="h-5 w-5" />
                    <span>FestaLog</span>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="mx-auto max-w-3xl space-y-6">
                {/* Header */}
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <PartyPopper className="h-8 w-8 text-primary" />
                        <span className="text-2xl font-bold">FestaLog</span>
                    </div>
                    <h1 className="text-2xl font-bold">Contrato de Locação</h1>
                    <p className="text-muted-foreground">
                        Por favor, revise os dados e assine abaixo
                    </p>
                </div>

                {/* Dados do Cliente */}
                <Card>
                    <CardHeader>
                        <CardTitle>Seus Dados</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Nome:</span>
                            <span className="font-medium">{pedido.clientes?.nome}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">CPF:</span>
                            <span className="font-medium">{pedido.clientes?.cpf || 'Não informado'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Endereço:</span>
                            <span className="font-medium text-right">{pedido.clientes?.endereco_completo}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Dados do Evento */}
                <Card>
                    <CardHeader>
                        <CardTitle>Dados do Evento</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Data:</span>
                            <Badge variant="secondary" className="text-lg">
                                {format(new Date(pedido.data_evento + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Itens */}
                <Card>
                    <CardHeader>
                        <CardTitle>Itens Locados</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="text-center">Qtd</TableHead>
                                    <TableHead className="text-right">Subtotal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pedido.itens_pedido?.map((item: ItemPedidoComProduto) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.produtos?.nome}</TableCell>
                                        <TableCell className="text-center">{item.quantidade}</TableCell>
                                        <TableCell className="text-right">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantidade * item.preco_unitario)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="mt-4 flex justify-between border-t pt-4">
                            <span className="text-lg font-medium">Total</span>
                            <span className="text-xl font-bold text-primary">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido)}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Termos */}
                <Card>
                    <CardHeader>
                        <CardTitle>Termos e Condições</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                        <ol className="list-decimal list-inside space-y-2">
                            <li>O LOCATÁRIO se compromete a devolver todos os materiais em perfeito estado de conservação.</li>
                            <li>Qualquer dano causado aos materiais será cobrado com base no valor de reposição integral.</li>
                            <li>O pagamento de 50% (cinquenta por cento) do valor total deve ser efetuado no ato da confirmação do pedido.</li>
                            <li>Os 50% (cinquenta por cento) restantes devem ser pagos no momento da entrega dos materiais.</li>
                            <li>A entrega e o recolhimento dos materiais serão agendados previamente entre as partes.</li>
                            <li>O cancelamento com menos de 48 horas de antecedência resultará em retenção do sinal.</li>
                        </ol>
                    </CardContent>
                </Card>

                {/* Assinatura */}
                <Card>
                    <CardHeader>
                        <CardTitle>Sua Assinatura</CardTitle>
                        <CardDescription>
                            Desenhe sua assinatura no campo abaixo usando o dedo ou mouse
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg border-2 border-dashed p-1">
                            <canvas
                                ref={canvasRef}
                                width={600}
                                height={200}
                                className="w-full cursor-crosshair touch-none rounded bg-white"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                        </div>
                        <div className="flex gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={limparAssinatura}
                                className="flex-1"
                            >
                                <Eraser className="mr-2 h-4 w-4" />
                                Limpar
                            </Button>
                            <Button
                                onClick={salvarAssinatura}
                                disabled={!hasSignature || salvando}
                                className="flex-1"
                            >
                                {salvando ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                )}
                                Assinar Contrato
                            </Button>
                        </div>
                        <p className="text-center text-xs text-muted-foreground">
                            Ao clicar em &quot;Assinar Contrato&quot;, você concorda com todos os termos e condições acima.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
