'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    ArrowLeft,
    Loader2,
    FileText,
    Phone,
    MapPin,
    Calendar,
    Send,
    Download,
    Trash2,
    User
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import type { PedidoCompleto, StatusPedido, ItemPedido, Produto } from '@/lib/database.types'

const statusColors: Record<StatusPedido, string> = {
    orcamento: 'bg-gray-500',
    contrato_enviado: 'bg-blue-500',
    assinado: 'bg-purple-500',
    pago_50: 'bg-yellow-500',
    entregue: 'bg-orange-500',
    recolhido: 'bg-teal-500',
    finalizado: 'bg-green-500',
}

const statusLabels: Record<StatusPedido, string> = {
    orcamento: 'Orçamento',
    contrato_enviado: 'Contrato Enviado',
    assinado: 'Assinado',
    pago_50: 'Pago 50%',
    entregue: 'Entregue',
    recolhido: 'Recolhido',
    finalizado: 'Finalizado',
}

const allStatus: StatusPedido[] = [
    'orcamento',
    'contrato_enviado',
    'assinado',
    'pago_50',
    'entregue',
    'recolhido',
    'finalizado',
]

type ItemPedidoComProduto = ItemPedido & { produtos: Produto }

export default function PedidoDetalhesPage() {
    const params = useParams()
    const router = useRouter()
    const pedidoId = params.id as string

    const [pedido, setPedido] = useState<PedidoCompleto | null>(null)
    const [loading, setLoading] = useState(true)
    const [gerando, setGerando] = useState(false)

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
        }
        setLoading(false)
    }

    useEffect(() => {
        loadPedido()
    }, [pedidoId])

    async function updateStatus(newStatus: StatusPedido) {
        const { error } = await supabase
            .from('pedidos')
            .update({ status: newStatus })
            .eq('id', pedidoId)

        if (error) {
            console.error('Erro ao atualizar status:', error)
        } else {
            loadPedido()

            // Notificação de pós-venda quando finalizado
            if (newStatus === 'finalizado' && pedido?.clientes) {
                const enviarAvaliacao = confirm(
                    `🎉 Pedido finalizado com sucesso!\n\n` +
                    `Deseja enviar uma mensagem de agradecimento para ${pedido.clientes.nome} ` +
                    `solicitando uma avaliação no Google?`
                )

                if (enviarAvaliacao) {
                    const googleReviewLink = 'https://search.google.com/local/writereview?placeid=ChIJxwcjc99RpgARMzNtT0lyZTE'
                    const mensagem = encodeURIComponent(
                        `Olá ${pedido.clientes.nome}! 🎉\n\n` +
                        `Aqui é da *Lu Festas*! Queremos agradecer por escolher nossos serviços.\n\n` +
                        `Esperamos que sua festa tenha sido um sucesso! ✨\n\n` +
                        `Se puder, ficaríamos muito felizes com uma avaliação no Google. ` +
                        `Seu feedback é muito importante para nós! ⭐\n\n` +
                        `${googleReviewLink}\n\n` +
                        `Obrigado e até a próxima! 🙏`
                    )
                    const number = pedido.clientes.whatsapp.replace(/\D/g, '')
                    window.open(`https://wa.me/55${number}?text=${mensagem}`, '_blank')
                }
            }
        }
    }

    async function deletePedido() {
        if (!confirm('Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.')) {
            return
        }

        const { error } = await supabase
            .from('pedidos')
            .delete()
            .eq('id', pedidoId)

        if (error) {
            console.error('Erro ao excluir pedido:', error)
            alert('Erro ao excluir pedido')
        } else {
            router.push('/pedidos')
        }
    }

    async function gerarContratoPDF() {
        if (!pedido) return
        setGerando(true)

        try {
            const pdfDoc = await PDFDocument.create()
            let page = pdfDoc.addPage([595, 842]) // A4
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
            const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

            const { height } = page.getSize()
            let y = height - 50
            const margin = 50
            const lineHeight = 14
            const smallLineHeight = 12

            const nomeLoja = 'LU FESTAS'
            const cnpjLoja = '46.446.131/0001-06'
            const enderecoLoja = 'Rua Ariramba, 121 - Alípio de Melo, Belo Horizonte, MG'

            // Função para adicionar nova página se necessário
            const checkNewPage = (neededSpace = 30) => {
                if (y < 50 + neededSpace) {
                    page = pdfDoc.addPage([595, 842])
                    y = height - 50
                }
            }

            // Função helper para escrever texto com quebra de linha
            const drawWrappedText = (text: string, size: number = 10, isBold: boolean = false) => {
                const words = text.split(' ')
                let line = ''
                words.forEach(word => {
                    const testLine = line + word + ' '
                    const width = isBold ? fontBold.widthOfTextAtSize(testLine, size) : font.widthOfTextAtSize(testLine, size)
                    if (width > 495) { // Margem direita aprox
                        checkNewPage(size + 2)
                        page.drawText(line, { x: margin, y, size, font: isBold ? fontBold : font })
                        y -= size + 4
                        line = word + ' '
                    } else {
                        line = testLine
                    }
                })
                if (line) {
                    checkNewPage(size + 2)
                    page.drawText(line, { x: margin, y, size, font: isBold ? fontBold : font })
                    y -= size + 2
                }
            }

            // ===== CABEÇALHO =====
            page.drawText('CONTRATO DE LOCAÇÃO', {
                x: 200,
                y,
                size: 16,
                font: fontBold,
                color: rgb(0, 0, 0),
            })
            y -= 30

            // ===== IDENTIFICAÇÃO DAS PARTES =====
            // LOCADOR
            page.drawText('LOCADOR:', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            page.drawText(`Nome: ${nomeLoja}`, { x: margin, y, size: 10, font })
            y -= lineHeight
            page.drawText(`CNPJ: ${cnpjLoja}`, { x: margin, y, size: 10, font })
            y -= lineHeight
            page.drawText(`Endereço: ${enderecoLoja}`, { x: margin, y, size: 10, font })
            y -= 25

            // LOCATÁRIO
            page.drawText('LOCATÁRIO:', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            page.drawText(`Nome: ${pedido.clientes?.nome || ''}`, { x: margin, y, size: 10, font })
            y -= lineHeight
            page.drawText(`CPF: ${pedido.clientes?.cpf || 'Não informado'}`, { x: margin, y, size: 10, font })
            y -= lineHeight
            page.drawText(`Telefone: ${pedido.clientes?.whatsapp || ''}`, { x: margin, y, size: 10, font })
            y -= lineHeight
            page.drawText(`Endereço: ${pedido.clientes?.endereco_completo || ''}`, { x: margin, y, size: 10, font })
            y -= 25

            // ===== CLÁUSULA 1: OBJETO =====
            checkNewPage()
            page.drawText('Cláusula 1ª: Objeto da Locação', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            page.drawText('1.1. O presente contrato tem como objeto a locação dos seguintes itens:', { x: margin, y, size: 10, font })
            y -= lineHeight + 5

            // Tabela de Itens
            page.drawText('Qtd', { x: margin, y, size: 9, font: fontBold })
            page.drawText('Descrição', { x: 90, y, size: 9, font: fontBold })
            y -= 5
            page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5 })
            y -= 15

            pedido.itens_pedido?.forEach((item: ItemPedidoComProduto) => {
                checkNewPage()
                page.drawText(item.quantidade.toString(), { x: margin, y, size: 9, font })
                page.drawText(item.produtos?.nome || '', { x: 90, y, size: 9, font })
                y -= 15
            })
            y -= 5

            checkNewPage()
            drawWrappedText('Todos os itens encontram-se em bom estado de conservação e limpeza, sendo de propriedade do LOCADOR e destinados à locação ao LOCATÁRIO.', 10)
            y -= 15

            // ===== CLÁUSULA 2: TRANSFERÊNCIA =====
            checkNewPage()
            page.drawText('Cláusula 2ª: Proibição de Transferência', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            drawWrappedText('2.1. Fica expressamente proibido ao LOCATÁRIO transferir, sub-locar, ceder ou emprestar os bens objeto deste contrato a terceiros, sem prévia autorização por escrito do LOCADOR.', 10)
            y -= 15

            // ===== CLÁUSULA 3: DURAÇÃO =====
            checkNewPage()
            page.drawText('Cláusula 3ª: Duração da Locação e Local de Entrega', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            const dataEvento = format(new Date(pedido.data_evento + 'T12:00:00'), 'dd/MM/yyyy')
            // Assumindo devolução no dia seguinte para simplificar
            drawWrappedText(`3.1. A locação terá duração de 1 (um) dia, compreendendo o período de utilização dos itens a partir do dia ${dataEvento}, correspondente ao evento do LOCATÁRIO.`, 10)
            y -= 5
            drawWrappedText(`3.2. O material será entregue no endereço do evento: ${pedido.clientes?.endereco_completo || ''}.`, 10)
            y -= 15

            // ===== CLÁUSULA 4: VALOR E PAGAMENTO =====
            checkNewPage()
            page.drawText('Cláusula 4ª: Valor do Aluguel e Forma de Pagamento', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            const valorTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido)
            drawWrappedText(`4.1. O valor total da locação, incluindo o frete, será de ${valorTotal}.`, 10)
            y -= 5
            drawWrappedText('4.2. Forma de Pagamento:', 10, true)
            y -= 5
            drawWrappedText('Para pessoas físicas ou empresas sem necessidade de NFS-e: Sinal de 50% no ato da reserva e o restante no ato da entrega.', 10)
            y -= 5
            drawWrappedText('Para empresas com necessidade de NFS-e: Pagamento no ato da entrega, após emissão e aprovação da NFS-e.', 10)
            y -= 5
            drawWrappedText('4.3. Dados para pagamento via PIX:', 10, true)
            y -= 5
            page.drawText('CHAVE PIX CNPJ: 46.446.131/0001-06', { x: margin + 10, y, size: 10, font })
            y -= lineHeight
            page.drawText('NOME: GABRIEL LUCAS', { x: margin + 10, y, size: 10, font })
            y -= lineHeight
            page.drawText('BANCO: CORA SCD', { x: margin + 10, y, size: 10, font })
            y -= 15

            // ===== CLÁUSULAS 5 a 12 =====
            const clausulasExtras = [
                { t: 'Cláusula 5ª: Pagamento e Rescisão Contratual', c: '5.1. Em caso de rescisão sem pagamento na data da entrega, o contrato será automaticamente rescindido. Reservas antecipadas exigem aviso prévio de uma semana para empresas ou 7 dias para outros. Pagamentos antecipados não serão devolvidos em caso de desistência após prazos.' },
                { t: 'Cláusula 6ª: Devolução dos Bens', c: '6.1. Os bens devem ser devolvidos nas mesmas condições. Danos serão avaliados na entrega/devolução.' },
                { t: 'Cláusula 7ª: Multa por Atraso', c: '7.1. Multa de R$ 30,00 (trinta reais) por dia de atraso na devolução.' },
                { t: 'Cláusula 8ª: Responsabilidade por Danos', c: '8.1. O LOCATÁRIO é responsável por quaisquer danos ou quebras. Valores de reposição serão aplicados.' },
                { t: 'Cláusula 9ª: Cuidados e Limpeza', c: '9.1. O LOCATÁRIO deve zelar pela limpeza. A LOCADORA fará a limpeza regular, mas manchas permanentes são responsabilidade do LOCATÁRIO.' },
                { t: 'Cláusula 10ª: Alteração de Horário', c: '10.1. Alterações de horário exigem aviso prévio de 3 horas e estão sujeitas à disponibilidade.' },
                { t: 'Cláusula 11ª: Sucessores', c: '11.1. Herdeiros e sucessores se obrigam ao teor deste contrato.' },
                { t: 'Cláusula 12ª: Foro', c: '12.1. Fica eleito o foro da comarca de BELO HORIZONTE – MG.' }
            ]

            clausulasExtras.forEach(cl => {
                checkNewPage()
                page.drawText(cl.t, { x: margin, y, size: 10, font: fontBold })
                y -= lineHeight
                drawWrappedText(cl.c, 10)
                y -= 10
            })

            y -= 10
            checkNewPage()

            // ===== DECLARAÇÃO =====
            page.drawText('DECLARAÇÃO:', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            drawWrappedText('Declaro estar ciente e de acordo com todas as cláusulas e condições estabelecidas neste contrato, comprometendo-me a cumpri-las integralmente.', 10)
            y -= 30

            // ===== ASSINATURAS =====
            checkNewPage(120) // Garantir espaço para assinaturas

            page.drawText(`Belo Horizonte, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, {
                x: margin, y, size: 10, font
            })
            y -= 50

            page.drawLine({ start: { x: margin, y }, end: { x: 250, y }, thickness: 0.5 })
            page.drawLine({ start: { x: 300, y }, end: { x: 545, y }, thickness: 0.5 })
            y -= 15

            // Locador
            page.drawText('LOCADOR', { x: margin, y, size: 9, font: fontBold })
            y -= 10
            page.drawText('GABRIEL L. S. SOUZA', { x: margin, y, size: 8, font })
            y -= 10
            page.drawText('CNPJ: 46.446.131/0001-06', { x: margin, y, size: 8, font })

            // Locatário
            y += 20 // volta para linha da assinatura
            page.drawText('LOCATÁRIO', { x: 300, y, size: 9, font: fontBold })
            y -= 10
            drawWrappedText(pedido.clientes?.nome?.toUpperCase() || '', 8)

            // Download
            const pdfBytes = await pdfDoc.save()
            const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `contrato_${pedido.clientes?.nome.replace(/\s/g, '_')}_${format(new Date(pedido.data_evento), 'ddMMyyyy')}.pdf`
            link.click()
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Erro ao gerar PDF:', error)
            alert('Erro ao gerar PDF')
        } finally {
            setGerando(false)
        }
    }


    function openWhatsApp() {
        if (!pedido) return
        const number = pedido.clientes?.whatsapp.replace(/\D/g, '') || ''
        const message = encodeURIComponent(`Olá ${pedido.clientes?.nome}! Aqui é da locadora.`)
        window.open(`https://wa.me/55${number}?text=${message}`, '_blank')
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!pedido) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg">Pedido não encontrado</p>
                <Button asChild className="mt-4">
                    <Link href="/pedidos">Voltar para Pedidos</Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button asChild variant="ghost" size="icon">
                        <Link href="/pedidos">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Pedido</h1>
                        <p className="text-muted-foreground">
                            #{pedido.id.slice(0, 8)}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={openWhatsApp}>
                        <Send className="mr-2 h-4 w-4" />
                        WhatsApp
                    </Button>
                    <Button onClick={gerarContratoPDF} disabled={gerando}>
                        {gerando ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        Gerar Contrato PDF
                    </Button>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Informações Principais */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Status do Pedido</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Select value={pedido.status} onValueChange={(v) => updateStatus(v as StatusPedido)}>
                                <SelectTrigger className="w-[250px]">
                                    <div className="flex items-center gap-2">
                                        <div className={`h-3 w-3 rounded-full ${statusColors[pedido.status]}`} />
                                        {statusLabels[pedido.status]}
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {allStatus.map((status) => (
                                        <SelectItem key={status} value={status}>
                                            <div className="flex items-center gap-2">
                                                <div className={`h-2 w-2 rounded-full ${statusColors[status]}`} />
                                                {statusLabels[status]}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    {/* Itens */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Itens do Pedido</CardTitle>
                            <CardDescription>
                                {pedido.itens_pedido?.length || 0} itens
                            </CardDescription>
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
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario)}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantidade * item.preco_unitario)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="mt-4 flex justify-end border-t pt-4">
                                <div className="text-lg">
                                    <span className="text-muted-foreground">Total: </span>
                                    <span className="font-bold">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Observações */}
                    {pedido.observacoes && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Observações</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">{pedido.observacoes}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Cliente */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Cliente
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="font-medium text-lg">{pedido.clientes?.nome}</p>
                                {pedido.clientes?.cpf && (
                                    <p className="text-sm text-muted-foreground">CPF: {pedido.clientes.cpf}</p>
                                )}
                            </div>
                            <div className="flex items-start gap-2">
                                <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                <Button
                                    variant="link"
                                    className="h-auto p-0 text-green-600"
                                    onClick={openWhatsApp}
                                >
                                    {pedido.clientes?.whatsapp}
                                </Button>
                            </div>
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                <p className="text-sm">{pedido.clientes?.endereco_completo}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Data do Evento */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Data do Evento
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">
                                {format(new Date(pedido.data_evento + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                            </p>
                            <p className="text-muted-foreground">
                                {format(new Date(pedido.data_evento + 'T12:00:00'), 'yyyy')}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Ações */}
                    <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="destructive"
                                className="w-full"
                                onClick={deletePedido}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir Pedido
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
