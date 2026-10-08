'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AddressAutocomplete } from '@/components/address-autocomplete'
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
import { ArrowLeft, FileText, Download, Send, Trash2, Loader2, Pencil, Plus, X, Save, Home, MapPin, Phone, Calendar, User } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import type { PedidoCompleto, StatusPedido, ItemPedido, Produto, DisponibilidadeProduto } from '@/lib/database.types'
import { PaymentSection } from '@/components/payment-section'
import { QuickPaymentModal } from '@/components/quick-payment-modal'
import { ContractAttachmentCard } from '@/components/contract-attachment-card'

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

type ItemPedidoComProduto = ItemPedido & { produtos: Produto | null }

interface ItemCarrinhoEdit {
    id?: string // ID do item existente, undefined para novos
    produto: Produto
    quantidade: number
    preco_unitario: number
    disponivel: number
    isNew?: boolean // marca se é um item novo
}

export default function PedidoDetalhesPage() {
    const params = useParams()
    const router = useRouter()
    const pedidoId = params.id as string

    // Verifica se deve abrir em modo edição (via query param)
    const [searchParamsReady, setSearchParamsReady] = useState(false)
    const [abrirEmEdicao, setAbrirEmEdicao] = useState(false)

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        setAbrirEmEdicao(urlParams.get('editar') === 'true')
        setSearchParamsReady(true)
    }, [])

    const [pedido, setPedido] = useState<PedidoCompleto | null>(null)
    const [loading, setLoading] = useState(true)
    const [gerando, setGerando] = useState(false)
    const [quickPaymentOpen, setQuickPaymentOpen] = useState(false)
    const [sugestaoValor, setSugestaoValor] = useState<number | undefined>(undefined)
    const [sugestaoObs, setSugestaoObs] = useState<string | undefined>(undefined)
    const [attachedContractUrl, setAttachedContractUrl] = useState<string | null>(null)

    // Estados de edição
    const [modoEdicao, setModoEdicao] = useState(false)
    const [salvando, setSalvando] = useState(false)
    const [dataEventoEdit, setDataEventoEdit] = useState('')
    const [horaEntregaEdit, setHoraEntregaEdit] = useState('')
    const [observacoesEdit, setObservacoesEdit] = useState('')
    const [carrinhoEdit, setCarrinhoEdit] = useState<ItemCarrinhoEdit[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeProduto[]>([])
    const [produtoSelecionado, setProdutoSelecionado] = useState('')
    const [quantidadeSelecionada, setQuantidadeSelecionada] = useState(1)

    // Estados para endereço do evento na edição
    const [usarEnderecoResidencialEdit, setUsarEnderecoResidencialEdit] = useState(true)
    const [enderecoEventoEdit, setEnderecoEventoEdit] = useState('')

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

    // Ativar modo de edição automaticamente se parâmetro ?editar=true
    useEffect(() => {
        if (searchParamsReady && abrirEmEdicao && pedido && !modoEdicao) {
            iniciarEdicao()
        }
    }, [searchParamsReady, abrirEmEdicao, pedido])

    // Carregar produtos para edição
    async function loadProdutos() {
        const { data, error } = await supabase
            .from('produtos')
            .select('*')
            .order('nome')

        if (data) setProdutos(data)
    }

    // Verificar disponibilidade para uma data
    async function checkDisponibilidade(data: string) {
        if (!data) return

        const { data: disp, error } = await supabase
            .rpc('calcular_disponibilidade', { data_consulta: data })

        if (error) {
            console.error('Erro ao verificar disponibilidade:', error)
        } else {
            setDisponibilidade(disp || [])
        }
    }

    // Iniciar modo de edição
    async function iniciarEdicao() {
        if (!pedido) return

        // Carrega produtos
        await loadProdutos()

        // Carrega disponibilidade para a data do evento
        await checkDisponibilidade(pedido.data_evento)

        // Preenche campos editáveis
        setDataEventoEdit(pedido.data_evento)
        setHoraEntregaEdit((pedido as any).hora_entrega || '14:00')
        setObservacoesEdit(pedido.observacoes || '')

        // Preenche campos de endereço do evento
        setUsarEnderecoResidencialEdit((pedido as any).usar_endereco_residencial !== false)
        setEnderecoEventoEdit((pedido as any).endereco_evento || '')

        // Converte itens do pedido para carrinho editável
        const itensEdit: ItemCarrinhoEdit[] = (pedido.itens_pedido || [])
            .filter((item: ItemPedidoComProduto): item is ItemPedidoComProduto & { produtos: Produto } => Boolean(item.produtos))
            .map((item) => ({
                id: item.id,
                produto: item.produtos,
                quantidade: item.quantidade,
                preco_unitario: item.preco_unitario,
                disponivel: item.quantidade + getDisponivel(item.produtos.id),
                isNew: false
            }))
        setCarrinhoEdit(itensEdit)

        setModoEdicao(true)
    }

    // Cancelar edição
    function cancelarEdicao() {
        setModoEdicao(false)
        setCarrinhoEdit([])
        setProdutoSelecionado('')
        setQuantidadeSelecionada(1)
    }

    // Obter quantidade disponível de um produto
    function getDisponivel(produtoId: string): number {
        const item = disponibilidade.find(d => d.produto_id === produtoId)
        return item ? Number(item.quantidade_disponivel) : 0
    }

    // Adicionar produto ao carrinho de edição
    function addToCarrinhoEdit() {
        if (!produtoSelecionado || quantidadeSelecionada < 1) return

        const produto = produtos.find(p => p.id === produtoSelecionado)
        if (!produto) return

        const disponivel = getDisponivel(produtoSelecionado)

        // Verifica se já está no carrinho
        const existingIndex = carrinhoEdit.findIndex(item => item.produto.id === produtoSelecionado)

        if (existingIndex >= 0) {
            const newQtd = carrinhoEdit[existingIndex].quantidade + quantidadeSelecionada
            if (newQtd > carrinhoEdit[existingIndex].disponivel) {
                alert(`Quantidade indisponível. Máximo disponível: ${carrinhoEdit[existingIndex].disponivel}`)
                return
            }
            const newCarrinho = [...carrinhoEdit]
            newCarrinho[existingIndex].quantidade = newQtd
            setCarrinhoEdit(newCarrinho)
        } else {
            if (quantidadeSelecionada > disponivel) {
                alert(`Quantidade indisponível. Máximo disponível: ${disponivel}`)
                return
            }
            setCarrinhoEdit([...carrinhoEdit, {
                produto,
                quantidade: quantidadeSelecionada,
                preco_unitario: produto.preco_unitario,
                disponivel,
                isNew: true
            }])
        }

        setProdutoSelecionado('')
        setQuantidadeSelecionada(1)
    }

    // Remover item do carrinho de edição
    function removeFromCarrinhoEdit(index: number) {
        setCarrinhoEdit(carrinhoEdit.filter((_, i) => i !== index))
    }

    // Atualizar quantidade de um item no carrinho
    function updateQuantidadeEdit(index: number, novaQuantidade: number) {
        if (novaQuantidade < 1) return
        if (novaQuantidade > carrinhoEdit[index].disponivel) {
            alert(`Quantidade indisponível. Máximo disponível: ${carrinhoEdit[index].disponivel}`)
            return
        }
        const newCarrinho = [...carrinhoEdit]
        newCarrinho[index].quantidade = novaQuantidade
        setCarrinhoEdit(newCarrinho)
    }

    // Calcular total do carrinho de edição
    const totalEdit = carrinhoEdit.reduce((acc, item) => acc + (item.preco_unitario * item.quantidade), 0) + ((pedido as any)?.frete || 0)

    // Salvar alterações do pedido
    async function salvarEdicao() {
        if (!pedido || carrinhoEdit.length === 0) {
            alert('Adicione pelo menos um produto ao pedido')
            return
        }

        setSalvando(true)

        try {
            // 1. Atualizar dados do pedido
            const { error: pedidoError } = await supabase
                .from('pedidos')
                .update({
                    data_evento: dataEventoEdit,
                    hora_entrega: horaEntregaEdit,
                    observacoes: observacoesEdit,
                    total_pedido: totalEdit,
                    usar_endereco_residencial: usarEnderecoResidencialEdit,
                    endereco_evento: usarEnderecoResidencialEdit ? null : enderecoEventoEdit,
                })
                .eq('id', pedidoId)

            if (pedidoError) throw pedidoError

            // 2. Identificar itens para deletar, inserir e atualizar
            const itensOriginais = new Set((pedido.itens_pedido || []).map((item: ItemPedidoComProduto) => item.id))
            const itensAtuais = new Set(carrinhoEdit.filter(item => item.id).map(item => item.id))

            // Itens para deletar (estavam no original mas não estão mais)
            const itensDeletar = [...itensOriginais].filter(id => !itensAtuais.has(id))

            // 3. Deletar itens removidos
            if (itensDeletar.length > 0) {
                const { error: deleteError } = await supabase
                    .from('itens_pedido')
                    .delete()
                    .in('id', itensDeletar)

                if (deleteError) throw deleteError
            }

            // 4. Atualizar itens existentes
            for (const item of carrinhoEdit.filter(i => i.id && !i.isNew)) {
                const { error: updateError } = await supabase
                    .from('itens_pedido')
                    .update({
                        quantidade: item.quantidade,
                        preco_unitario: item.preco_unitario
                    })
                    .eq('id', item.id!)

                if (updateError) throw updateError
            }

            // 5. Inserir novos itens
            const novosItens = carrinhoEdit.filter(i => i.isNew).map(item => ({
                pedido_id: pedidoId,
                produto_id: item.produto.id,
                quantidade: item.quantidade,
                preco_unitario: item.preco_unitario
            }))

            if (novosItens.length > 0) {
                const { error: insertError } = await supabase
                    .from('itens_pedido')
                    .insert(novosItens)

                if (insertError) throw insertError
            }

            // Recarregar pedido e sair do modo edição
            await loadPedido()
            setModoEdicao(false)
            setCarrinhoEdit([])

        } catch (error) {
            console.error('Erro ao salvar edição:', error)
            alert('Erro ao salvar alterações. Tente novamente.')
        } finally {
            setSalvando(false)
        }
    }

    // Atualizar disponibilidade quando a data de edição muda
    useEffect(() => {
        if (modoEdicao && dataEventoEdit && dataEventoEdit !== pedido?.data_evento) {
            checkDisponibilidade(dataEventoEdit)
        }
    }, [dataEventoEdit, modoEdicao])

    async function updateStatus(newStatus: StatusPedido) {
        const { error } = await supabase
            .from('pedidos')
            .update({ status: newStatus })
            .eq('id', pedidoId)

        if (error) {
            console.error('Erro ao atualizar status:', error)
        } else {
            loadPedido()

            // Auto-trigger quick payment modal if setting to pago_50 or finalizado and has pending balance
            if (pedido) {
                const total = Number(pedido.total_pedido || 0)
                const pago = Number((pedido as any).valor_pago || 0)
                const saldoDevedor = Math.max(0, total - pago)
                if (saldoDevedor > 0.01) {
                    if (newStatus === 'pago_50') {
                        const metade = Number((total * 0.5).toFixed(2))
                        const sugestao = pago < metade ? Number((metade - pago).toFixed(2)) : metade
                        setSugestaoValor(sugestao)
                        setSugestaoObs('Sinal 50%')
                        setQuickPaymentOpen(true)
                    } else if (newStatus === 'finalizado') {
                        setSugestaoValor(saldoDevedor)
                        setSugestaoObs('Quitação final')
                        setQuickPaymentOpen(true)
                    }
                }
            }

            // Notificação de pós-venda quando finalizado
            if (newStatus === 'finalizado' && pedido?.clientes) {
                const enviarAvaliacao = confirm(
                    `🎉 Pedido finalizado com sucesso!\n\n` +
                    `Deseja enviar uma mensagem de agradecimento para ${pedido.clientes.nome} ` +
                    `solicitando uma avaliação no Google?`
                )

                if (enviarAvaliacao) {
                    const googleReviewLink = 'https://search.google.com/local/writereview?placeid=ChIJxyFz3xGXpgAR8jNtT0lyZTE'
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
                    window.open(`https://api.whatsapp.com/send?phone=55${number}&text=${mensagem}`, '_blank')
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
            page.drawText('CONTRATO DE LOCAÇÃO DE MATERIAIS PARA FESTAS', {
                x: 120,
                y,
                size: 14,
                font: fontBold,
                color: rgb(0, 0, 0),
            })
            y -= 25

            // ===== INTRODUÇÃO =====
            drawWrappedText('Pelo presente instrumento particular de contrato de locação, de um lado, denominado LOCADOR:', 10)
            y -= 10

            // LOCADOR
            page.drawText(`${nomeLoja}`, { x: margin, y, size: 11, font: fontBold })
            y -= lineHeight
            page.drawText(`CNPJ: ${cnpjLoja}`, { x: margin, y, size: 10, font })
            y -= lineHeight
            page.drawText(`Endereço: ${enderecoLoja}`, { x: margin, y, size: 10, font })
            y -= 20

            // LOCATÁRIO
            drawWrappedText('E, de outro lado, denominado LOCATÁRIO:', 10)
            y -= 10
            page.drawText(`${pedido.clientes?.nome?.toUpperCase() || ''}`, { x: margin, y, size: 11, font: fontBold })
            y -= lineHeight
            page.drawText(`CPF: ${pedido.clientes?.cpf || 'Não informado'}`, { x: margin, y, size: 10, font })
            y -= lineHeight
            page.drawText(`Endereço: ${pedido.clientes?.endereco_completo || ''}`, { x: margin, y, size: 10, font })
            y -= 20

            drawWrappedText('Têm entre si justo e acordado o que segue:', 10)
            y -= 15

            // ===== CLÁUSULA 1: OBJETO =====
            checkNewPage()
            page.drawText('Cláusula 1ª: Objeto da Locação', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            drawWrappedText('1.1. O presente contrato tem como objeto a locação dos seguintes itens:', 10)
            y -= lineHeight

            // TABELA DE ITENS COM VALORES
            page.drawText('Qtd', { x: margin, y, size: 9, font: fontBold })
            page.drawText('Descrição', { x: 85, y, size: 9, font: fontBold })
            page.drawText('Valor Unit.', { x: 350, y, size: 9, font: fontBold })
            page.drawText('Subtotal', { x: 450, y, size: 9, font: fontBold })
            y -= 5
            page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5 })
            y -= 15

            let subtotalItens = 0
            pedido.itens_pedido?.forEach((item: ItemPedidoComProduto) => {
                checkNewPage()
                const subtotalItem = item.quantidade * item.preco_unitario
                subtotalItens += subtotalItem
                page.drawText(item.quantidade.toString(), { x: margin, y, size: 9, font })
                page.drawText(item.produtos?.nome || '', { x: 85, y, size: 9, font })
                page.drawText(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario), { x: 350, y, size: 9, font })
                page.drawText(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotalItem), { x: 450, y, size: 9, font })
                y -= 15
            })

            page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5 })
            y -= 15
            page.drawText('TOTAL:', { x: 350, y, size: 10, font: fontBold })
            page.drawText(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido), { x: 450, y, size: 10, font: fontBold })
            y -= 15

            checkNewPage()
            drawWrappedText('1.2. Todos os itens encontram-se em bom estado de conservação e limpeza, sendo de propriedade do LOCADOR e destinados à locação ao LOCATÁRIO.', 10)
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
            const horaEntrega = (pedido as any).hora_entrega || '14:00'
            const [horaH, horaM] = horaEntrega.split(':').map(Number)
            const horaInicio = `${String(Math.max(0, horaH - 1)).padStart(2, '0')}:${String(horaM).padStart(2, '0')}`
            const horaFim = `${String(Math.min(23, horaH + 1)).padStart(2, '0')}:${String(horaM).padStart(2, '0')}`
            drawWrappedText(`3.1. A locação terá duração de 1 (um) dia, compreendendo o período de utilização dos itens a partir do dia ${dataEvento}, com horário de entrega previsto entre ${horaInicio} e ${horaFim}, até o recolhimento no dia seguinte.`, 10)
            y -= 5
            drawWrappedText(`3.2. O material será entregue no endereço do evento, localizado em: ${pedido.clientes?.endereco_completo || ''}.`, 10)
            y -= 10

            page.drawText('IMPORTANTE: NÃO SUBIMOS ESCADAS/ELEVADORES.', { x: margin, y, size: 10, font: fontBold, color: rgb(0.8, 0, 0) })
            y -= 15

            // ===== CLÁUSULA 4: VALOR E PAGAMENTO =====
            checkNewPage()
            page.drawText('Cláusula 4ª: Valor do Aluguel e Forma de Pagamento', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            const valorTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido)
            const valorExtenso = valorTotal // Simplificado
            const valorSinal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido * 0.5)

            drawWrappedText(`4.1. O valor do material alugado será de ${valorTotal}.`, 10)
            y -= 5
            drawWrappedText('4.2. Adicionalmente, será cobrado o valor do frete conforme região de entrega.', 10)
            y -= 5
            drawWrappedText(`4.3. O valor total da locação, incluindo o frete, será de ${valorTotal}.`, 10)
            y -= 5
            drawWrappedText(`4.4. Para pessoas físicas ou empresas que não necessitam de nota fiscal de serviço (NFS-e), o LOCATÁRIO deverá efetuar um sinal de 50% do valor total, equivalente a ${valorSinal}. O restante do pagamento deverá ser feito no ato da entrega dos itens ao cliente.`, 10)
            y -= 5
            drawWrappedText('4.4.1. Para empresas que necessitam de nota fiscal de serviço (NFS-e), o pagamento será efetuado no dia da entrega, após emissão e aprovação da análise fiscal.', 10)
            y -= 10

            checkNewPage()
            page.drawText('4.5. Dados para pagamento via PIX:', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            page.drawText('CHAVE PIX CNPJ: 46.446.131/0001-06', { x: margin + 20, y, size: 10, font })
            y -= lineHeight
            page.drawText('NOME: GABRIEL LUCAS', { x: margin + 20, y, size: 10, font })
            y -= lineHeight
            page.drawText('BANCO: CORA SCD', { x: margin + 20, y, size: 10, font })
            y -= 20

            // ===== CLÁUSULA 5: RESCISÃO =====
            checkNewPage()
            page.drawText('Cláusula 5ª: Pagamento e Rescisão Contratual', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            drawWrappedText('5.1. Caso não ocorra o pagamento na data da entrega, este contrato será automaticamente rescindido.', 10)
            y -= 5
            drawWrappedText('5.2. Em casos de reserva antecipada, o LOCATÁRIO poderá rescindir o contrato sem incorrer em multa, desde que o faça com, no mínimo, uma semana de antecedência em relação à data do evento.', 10)
            y -= 5
            drawWrappedText('5.3. No caso de desistência após os prazos mencionados, o valor referente ao pagamento antecipado não será devolvido e será considerado como multa pela rescisão do contrato.', 10)
            y -= 15

            // ===== CLÁUSULA 6: DEVOLUÇÃO =====
            checkNewPage()
            page.drawText('Cláusula 6ª: Devolução dos Bens', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            drawWrappedText('6.1. Ao final da locação, os bens deverão ser devolvidos pelo LOCATÁRIO nas mesmas condições de conservação em que foram recebidos, considerando desgastes normais aceitáveis. Danos significativos serão avaliados e, em caso de discordância, uma inspeção conjunta no momento da entrega/devolução será realizada.', 10)
            y -= 15

            // ===== CLÁUSULA 7: MULTA =====
            checkNewPage()
            page.drawText('Cláusula 7ª: Multa por Atraso na Devolução', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            drawWrappedText('7.1. Caso o prazo para devolução dos bens não seja respeitado, o LOCATÁRIO incorrerá em multa de R$ 30,00 (trinta reais) por dia de atraso.', 10)
            y -= 15

            // ===== CLÁUSULA 8: DANOS =====
            checkNewPage()
            page.drawText('Cláusula 8ª: Responsabilidade por Danos e Quebras', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight

            drawWrappedText('8.1. O LOCATÁRIO será responsável por quaisquer danos ou quebras nos materiais locados. Em caso de danos aos itens, serão aplicados os seguintes valores de reposição por unidade:', 10)
            y -= 10
            page.drawText('- Mesa: R$ 80,00 (oitenta reais)', { x: margin + 20, y, size: 9, font })
            y -= 12
            page.drawText('- Cadeira: R$ 60,00 (sessenta reais)', { x: margin + 20, y, size: 9, font })
            y -= 12
            page.drawText('- Toalhas: R$ 30,00 (trinta reais)', { x: margin + 20, y, size: 9, font })
            y -= 12
            page.drawText('- Isopor Térmico 100L: R$ 120,00 (cento e vinte reais)', { x: margin + 20, y, size: 9, font })
            y -= 15

            // ===== CLÁUSULA 9: LIMPEZA =====
            checkNewPage()
            page.drawText('Cláusula 9ª: Cuidados com a Mesa/Cadeiras, Toalhas e Serviço de Limpeza', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            drawWrappedText('9.1. O LOCATÁRIO deverá zelar pela limpeza e conservação da mesa, cadeira, isopor ou toalha locada. Em caso de derramamento de produtos, alimentos ou qualquer outra substância que possa danificar ou manchar significativamente a mesa, cadeira ou toalha, o LOCATÁRIO será responsável por sua reposição. Entretanto, esclarecemos que a empresa LOCADORA realizará a limpeza regular dos itens, assegurando que estejam em condições ideais para uso durante a locação. Recomenda-se que, em caso de manchas permanentes significativas, o LOCATÁRIO comunique imediatamente o LOCADOR para avaliação e providências adequadas.', 10)
            y -= 15

            // ===== CLÁUSULA 10: HORÁRIO =====
            checkNewPage()
            page.drawText('Cláusula 10ª: Alteração do Horário do Evento', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            drawWrappedText('10.1. O LOCATÁRIO poderá solicitar a alteração do horário do evento com um aviso prévio de no máximo 3 (três) horas para frente ou para trás. Qualquer alteração além desse período estará sujeita à disponibilidade e aprovação do LOCADOR.', 10)
            y -= 15

            // ===== CLÁUSULA 11: SUCESSORES =====
            checkNewPage()
            page.drawText('Cláusula 11ª: Responsabilidade dos Herdeiros e Sucessores', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            drawWrappedText('11.1. Os herdeiros e sucessores das partes contratantes se obrigam desde já ao inteiro teor deste contrato.', 10)
            y -= 15

            // ===== CLÁUSULA 12: FORO =====
            checkNewPage()
            page.drawText('Cláusula 12ª: Foro Competente', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            drawWrappedText('12.1. Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de BELO HORIZONTE – MG.', 10)
            y -= 20

            // ===== DECLARAÇÃO FINAL =====
            checkNewPage(80)
            drawWrappedText('Por estarem assim justos e contratados, firmam o presente instrumento em duas vias de igual teor.', 10)
            y -= 20

            page.drawText(`Belo Horizonte, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, {
                x: margin, y, size: 10, font
            })
            y -= 40

            // ===== ASSINATURAS =====
            checkNewPage(100)

            // Linha do Locador
            page.drawLine({ start: { x: margin, y }, end: { x: 250, y }, thickness: 0.5 })
            // Linha do Locatário
            page.drawLine({ start: { x: 300, y }, end: { x: 545, y }, thickness: 0.5 })
            y -= 15

            // Locador
            page.drawText('LOCADOR:', { x: margin, y, size: 9, font: fontBold })
            y -= 12
            page.drawText('GABRIEL L. S. SOUZA', { x: margin, y, size: 9, font })
            y -= 10
            page.drawText('CNPJ: 46.446.131/0001-06', { x: margin, y, size: 8, font })
            y -= 10
            page.drawText('End: Rua Ariramba, 121 - Alípio de Melo, BH/MG', { x: margin, y, size: 8, font })

            // Locatário
            let yLoc = y + 32
            page.drawText('LOCATÁRIO:', { x: 300, y: yLoc, size: 9, font: fontBold })
            yLoc -= 12
            page.drawText(pedido.clientes?.nome?.toUpperCase() || '', { x: 300, y: yLoc, size: 9, font })
            yLoc -= 10
            page.drawText(`CPF: ${pedido.clientes?.cpf || 'Não informado'}`, { x: 300, y: yLoc, size: 8, font })
            yLoc -= 10
            // Truncar endereço se muito longo
            const endLocatario = (pedido.clientes?.endereco_completo || '').substring(0, 40)
            page.drawText(`End: ${endLocatario}`, { x: 300, y: yLoc, size: 8, font })

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
        const message = `👋 Olá ${pedido.clientes?.nome}!\n\nAqui é da *Lu Festas* 🎉\n\nComo posso ajudar?`
        window.open(`https://api.whatsapp.com/send?phone=55${number}&text=${encodeURIComponent(message)}`, '_blank')
    }

    async function enviarContratoWhatsApp() {
        if (!pedido) return
        setGerando(true)

        try {
            // Gerar o PDF COMPLETO (mesmo código do gerarContratoPDF)
            const pdfDoc = await PDFDocument.create()
            let page = pdfDoc.addPage([595, 842])
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
            const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

            const { height } = page.getSize()
            let y = height - 50
            const margin = 50
            const lineHeight = 14

            const nomeLoja = 'LU FESTAS'
            const cnpjLoja = '46.446.131/0001-06'
            const enderecoLoja = 'Rua Ariramba, 121 - Alípio de Melo, Belo Horizonte, MG'

            const checkNewPage = (neededSpace = 30) => {
                if (y < 50 + neededSpace) {
                    page = pdfDoc.addPage([595, 842])
                    y = height - 50
                }
            }

            const drawWrappedText = (text: string, size: number = 10, isBold: boolean = false) => {
                const words = text.split(' ')
                let line = ''
                words.forEach(word => {
                    const testLine = line + word + ' '
                    const width = isBold ? fontBold.widthOfTextAtSize(testLine, size) : font.widthOfTextAtSize(testLine, size)
                    if (width > 495) {
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

            // CABEÇALHO
            page.drawText('CONTRATO DE LOCAÇÃO DE MATERIAIS PARA FESTAS', { x: 120, y, size: 14, font: fontBold, color: rgb(0, 0, 0) })
            y -= 25
            drawWrappedText('Pelo presente instrumento particular de contrato de locação, de um lado, denominado LOCADOR:', 10)
            y -= 10

            // LOCADOR
            page.drawText(`${nomeLoja}`, { x: margin, y, size: 11, font: fontBold })
            y -= lineHeight
            page.drawText(`CNPJ: ${cnpjLoja}`, { x: margin, y, size: 10, font })
            y -= lineHeight
            page.drawText(`Endereço: ${enderecoLoja}`, { x: margin, y, size: 10, font })
            y -= 20

            // LOCATÁRIO
            drawWrappedText('E, de outro lado, denominado LOCATÁRIO:', 10)
            y -= 10
            page.drawText(`${pedido.clientes?.nome?.toUpperCase() || ''}`, { x: margin, y, size: 11, font: fontBold })
            y -= lineHeight
            page.drawText(`CPF: ${pedido.clientes?.cpf || 'Não informado'}`, { x: margin, y, size: 10, font })
            y -= lineHeight
            page.drawText(`Endereço: ${pedido.clientes?.endereco_completo || ''}`, { x: margin, y, size: 10, font })
            y -= 20
            drawWrappedText('Têm entre si justo e acordado o que segue:', 10)
            y -= 15

            // CLÁUSULA 1
            checkNewPage()
            page.drawText('Cláusula 1ª: Objeto da Locação', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            drawWrappedText('1.1. O presente contrato tem como objeto a locação dos seguintes itens:', 10)
            y -= lineHeight

            // Tabela de itens
            page.drawText('Qtd', { x: margin, y, size: 9, font: fontBold })
            page.drawText('Descrição', { x: 85, y, size: 9, font: fontBold })
            page.drawText('Valor Unit.', { x: 350, y, size: 9, font: fontBold })
            page.drawText('Subtotal', { x: 450, y, size: 9, font: fontBold })
            y -= 5
            page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5 })
            y -= 15

            pedido.itens_pedido?.forEach((item: ItemPedidoComProduto) => {
                checkNewPage()
                const subtotalItem = item.quantidade * item.preco_unitario
                page.drawText(item.quantidade.toString(), { x: margin, y, size: 9, font })
                page.drawText(item.produtos?.nome || '', { x: 85, y, size: 9, font })
                page.drawText(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario), { x: 350, y, size: 9, font })
                page.drawText(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotalItem), { x: 450, y, size: 9, font })
                y -= 15
            })

            page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5 })
            y -= 15
            page.drawText('TOTAL:', { x: 350, y, size: 10, font: fontBold })
            page.drawText(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido), { x: 450, y, size: 10, font: fontBold })
            y -= 15

            checkNewPage()
            drawWrappedText('1.2. Todos os itens encontram-se em bom estado de conservação e limpeza.', 10)
            y -= 15

            // CLÁUSULA 2
            checkNewPage()
            page.drawText('Cláusula 2ª: Proibição de Transferência', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            drawWrappedText('2.1. Fica expressamente proibido ao LOCATÁRIO transferir, sub-locar, ceder ou emprestar os bens objeto deste contrato a terceiros.', 10)
            y -= 15

            // CLÁUSULA 3
            checkNewPage()
            page.drawText('Cláusula 3ª: Duração da Locação e Local de Entrega', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            const dataEvento = format(new Date(pedido.data_evento + 'T12:00:00'), 'dd/MM/yyyy')
            const horaEntrega2 = (pedido as any).hora_entrega || '14:00'
            const [h2, m2] = horaEntrega2.split(':').map(Number)
            const horaIni2 = `${String(Math.max(0, h2 - 1)).padStart(2, '0')}:${String(m2).padStart(2, '0')}`
            const horaFim2 = `${String(Math.min(23, h2 + 1)).padStart(2, '0')}:${String(m2).padStart(2, '0')}`
            drawWrappedText(`3.1. Entrega prevista entre ${horaIni2} e ${horaFim2} do dia ${dataEvento}.`, 10)
            y -= 5
            drawWrappedText(`3.2. Endereço: ${pedido.clientes?.endereco_completo || ''}.`, 10)
            y -= 10
            page.drawText('IMPORTANTE: NÃO SUBIMOS ESCADAS/ELEVADORES.', { x: margin, y, size: 10, font: fontBold, color: rgb(0.8, 0, 0) })
            y -= 15

            // CLÁUSULA 4
            checkNewPage()
            page.drawText('Cláusula 4ª: Valor do Aluguel e Forma de Pagamento', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            const valorTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido)
            const valorSinal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido * 0.5)
            drawWrappedText(`4.1. O valor do material alugado será de ${valorTotal}. Sinal de 50%: ${valorSinal}.`, 10)
            y -= 10
            page.drawText('Dados para pagamento via PIX:', { x: margin, y, size: 10, font: fontBold })
            y -= lineHeight
            page.drawText('CHAVE PIX CNPJ: 46.446.131/0001-06 | GABRIEL LUCAS | BANCO: CORA SCD', { x: margin, y, size: 9, font })
            y -= 20

            // CLÁUSULAS 5-12
            const clausulas = [
                { t: 'Cláusula 5ª: Rescisão Contratual', c: '5.1. Caso não ocorra o pagamento na data da entrega, este contrato será automaticamente rescindido.' },
                { t: 'Cláusula 6ª: Devolução dos Bens', c: '6.1. Os bens deverão ser devolvidos nas mesmas condições de conservação em que foram recebidos.' },
                { t: 'Cláusula 7ª: Multa por Atraso', c: '7.1. Multa de R$ 30,00 por dia de atraso na devolução.' },
                { t: 'Cláusula 8ª: Responsabilidade por Danos', c: '8.1. Danos e quebras: Mesa R$80, Cadeira R$60, Toalhas R$30, Isopor 100L R$120.' },
                { t: 'Cláusula 9ª: Cuidados e Limpeza', c: '9.1. O LOCATÁRIO deverá zelar pela limpeza e conservação. Em caso de manchas permanentes, comunicar imediatamente.' },
                { t: 'Cláusula 10ª: Alteração de Horário', c: '10.1. Alterações com aviso prévio de 3 horas.' },
                { t: 'Cláusula 11ª: Responsabilidade dos Sucessores', c: '11.1. Herdeiros e sucessores se obrigam ao inteiro teor deste contrato.' },
                { t: 'Cláusula 12ª: Foro Competente', c: '12.1. Fica eleito o foro da comarca de BELO HORIZONTE - MG.' }
            ]

            clausulas.forEach(cl => {
                checkNewPage()
                page.drawText(cl.t, { x: margin, y, size: 10, font: fontBold })
                y -= lineHeight
                drawWrappedText(cl.c, 10)
                y -= 10
            })

            // ASSINATURAS
            checkNewPage(80)
            drawWrappedText('Por estarem assim justos e contratados, firmam o presente instrumento em duas vias de igual teor.', 10)
            y -= 20
            page.drawText(`Belo Horizonte, ${format(new Date(), "dd/MM/yyyy")}`, { x: margin, y, size: 10, font })
            y -= 40
            page.drawLine({ start: { x: margin, y }, end: { x: 250, y }, thickness: 0.5 })
            page.drawLine({ start: { x: 300, y }, end: { x: 545, y }, thickness: 0.5 })
            y -= 15
            page.drawText('LOCADOR: GABRIEL L. S. SOUZA', { x: margin, y, size: 9, font })
            page.drawText('LOCATARIO: ' + (pedido.clientes?.nome?.toUpperCase() || ''), { x: 300, y, size: 9, font })

            const pdfBytes = await pdfDoc.save()

            // Upload para Supabase Storage
            const fileName = `contrato_${pedido.id.slice(0, 8)}_${Date.now()}.pdf`
            const { error: uploadError } = await supabase.storage
                .from('contratos')
                .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

            let pdfUrl = ''
            if (uploadError) {
                console.error('Erro no upload:', uploadError)
                alert('Aviso: Erro ao fazer upload do PDF. Mensagem será enviada sem o link.')
            } else {
                const { data: urlData } = supabase.storage.from('contratos').getPublicUrl(fileName)
                pdfUrl = urlData?.publicUrl || ''
                console.log('PDF URL:', pdfUrl)
            }

            // Enviar via WhatsApp
            const number = pedido.clientes?.whatsapp.replace(/\D/g, '') || ''

            const message =
                `📋 *CONTRATO - LU FESTAS*\n\n` +
                `Olá *${pedido.clientes?.nome}*! 👋\n\n` +
                `Seu contrato está pronto para assinatura. ✅\n\n` +
                (pdfUrl ? `📄 *BAIXAR CONTRATO:*\n${pdfUrl}\n\n` : '⚠️ *Erro ao gerar link do contrato*\n\n') +
                `📅 Data do Evento: ${dataEvento}\n` +
                `💰 Valor Total: ${valorTotal}\n` +
                `💳 Sinal (50%): ${valorSinal}\n\n` +
                `🏦 *PIX para pagamento:*\n` +
                `Chave CNPJ: 46.446.131/0001-06\n` +
                `Nome: GABRIEL LUCAS\n` +
                `Banco: CORA SCD\n\n` +
                `🎉 *Lu Festas* - Tornando seus momentos especiais!`

            window.open(`https://api.whatsapp.com/send?phone=55${number}&text=${encodeURIComponent(message)}`, '_blank')

            // Atualizar status
            await supabase.from('pedidos').update({ status: 'contrato_enviado' }).eq('id', pedido.id)
            loadPedido()

        } catch (error) {
            console.error('Erro ao enviar contrato:', error)
            alert('Erro ao enviar contrato.')
        } finally {
            setGerando(false)
        }
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
                <div className="flex gap-2 flex-wrap">
                    {modoEdicao ? (
                        <>
                            <Button variant="outline" onClick={cancelarEdicao} disabled={salvando}>
                                <X className="mr-2 h-4 w-4" />
                                Cancelar
                            </Button>
                            <Button onClick={salvarEdicao} disabled={salvando}>
                                {salvando ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="mr-2 h-4 w-4" />
                                )}
                                Salvar Alterações
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={iniciarEdicao}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                            </Button>
                            <Button variant="outline" onClick={openWhatsApp}>
                                <Send className="mr-2 h-4 w-4" />
                                WhatsApp
                            </Button>
                            <Button variant="secondary" onClick={enviarContratoWhatsApp}>
                                <FileText className="mr-2 h-4 w-4" />
                                Enviar Contrato
                            </Button>
                            <Button onClick={gerarContratoPDF} disabled={gerando}>
                                {gerando ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                )}
                                Gerar PDF
                            </Button>
                            {attachedContractUrl && (
                                <Button
                                    variant="outline"
                                    onClick={() => window.open(attachedContractUrl, '_blank')}
                                    className="border-blue-500/40 text-blue-700 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300"
                                    title="Visualizar contrato em PDF anexado"
                                >
                                    <FileText className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    Ver Contrato Anexado
                                </Button>
                            )}
                        </>
                    )}
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
                                <SelectTrigger className="w-full sm:w-[250px]">
                                    <div className="flex items-center gap-2">
                                        <div className={`h-3 w-3 rounded-full ${statusColors[pedido.status]}`} />
                                        {statusLabels[pedido.status]}
                                    </div>
                                </SelectTrigger>
                                <SelectContent position="popper" sideOffset={5}>
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
                                {modoEdicao ? carrinhoEdit.length : (pedido.itens_pedido?.length || 0)} itens
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {modoEdicao ? (
                                /* Modo Edição */
                                <>
                                    {/* Adicionar novo produto */}
                                    <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                                        <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Adicionar produto..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {produtos.map((produto) => {
                                                    const disp = getDisponivel(produto.id)
                                                    const jaNoCarrinho = carrinhoEdit.some(item => item.produto.id === produto.id)
                                                    return (
                                                        <SelectItem
                                                            key={produto.id}
                                                            value={produto.id}
                                                            disabled={disp === 0 && !jaNoCarrinho}
                                                        >
                                                            {produto.nome} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco_unitario)}
                                                            {' '}({disp} disponíveis)
                                                        </SelectItem>
                                                    )
                                                })}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={quantidadeSelecionada}
                                            onChange={(e) => setQuantidadeSelecionada(parseInt(e.target.value) || 1)}
                                            className="w-24"
                                        />
                                        <Button type="button" onClick={addToCarrinhoEdit}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Tabela de itens editável */}
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Produto</TableHead>
                                                <TableHead className="text-center">Qtd</TableHead>
                                                <TableHead className="text-right">Preço Unit.</TableHead>
                                                <TableHead className="text-right">Subtotal</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {carrinhoEdit.map((item, index) => (
                                                <TableRow key={item.produto.id}>
                                                    <TableCell className="font-medium">
                                                        {item.produto.nome}
                                                        {item.isNew && <Badge className="ml-2 bg-green-500">Novo</Badge>}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            max={item.disponivel}
                                                            value={item.quantidade}
                                                            onChange={(e) => updateQuantidadeEdit(index, parseInt(e.target.value) || 1)}
                                                            className="w-20 text-center"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantidade * item.preco_unitario)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => removeFromCarrinhoEdit(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <div className="mt-4 flex justify-end border-t pt-4">
                                        <div className="text-lg">
                                            <span className="text-muted-foreground">Total: </span>
                                            <span className="font-bold">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalEdit)}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* Modo Visualização */
                                <>
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
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Observações - Modo Edição ou Visualização */}
                    {modoEdicao ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Dados do Pedido</CardTitle>
                                <CardDescription>Edite as informações do pedido</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="data">Data do Evento</Label>
                                        <Input
                                            id="data"
                                            type="date"
                                            value={dataEventoEdit}
                                            onChange={(e) => setDataEventoEdit(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="hora">Horário de Entrega</Label>
                                        <Input
                                            id="hora"
                                            type="time"
                                            value={horaEntregaEdit}
                                            onChange={(e) => setHoraEntregaEdit(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="observacoes">Observações</Label>
                                    <Textarea
                                        id="observacoes"
                                        value={observacoesEdit}
                                        onChange={(e) => setObservacoesEdit(e.target.value)}
                                        placeholder="Informações adicionais sobre o pedido..."
                                        rows={3}
                                    />
                                </div>

                                {/* Toggle Endereço do Evento */}
                                <div className="border-t pt-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base flex items-center gap-2">
                                                <Home className="h-4 w-4" />
                                                Endereço do Evento
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                {usarEnderecoResidencialEdit
                                                    ? 'Usando endereço residencial do cliente'
                                                    : 'Usando endereço customizado'}
                                            </p>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <span className={`text-sm ${usarEnderecoResidencialEdit ? 'text-muted-foreground' : 'font-medium'}`}>
                                                Customizado
                                            </span>
                                            <div
                                                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${usarEnderecoResidencialEdit ? 'bg-primary' : 'bg-gray-300'
                                                    }`}
                                                onClick={() => setUsarEnderecoResidencialEdit(!usarEnderecoResidencialEdit)}
                                            >
                                                <div
                                                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${usarEnderecoResidencialEdit ? 'translate-x-5' : 'translate-x-0.5'
                                                        }`}
                                                />
                                            </div>
                                            <span className={`text-sm ${usarEnderecoResidencialEdit ? 'font-medium' : 'text-muted-foreground'}`}>
                                                Residencial
                                            </span>
                                        </label>
                                    </div>

                                    {usarEnderecoResidencialEdit ? (
                                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            {pedido.clientes?.endereco_completo ? (
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.clientes.endereco_completo)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm hover:text-primary hover:underline transition-colors"
                                                    title="Abrir no Google Maps"
                                                >
                                                    {pedido.clientes.endereco_completo}
                                                </a>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">Cliente sem endereço</span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid gap-2">
                                            <Label htmlFor="endereco-evento-edit">Endereço do Evento</Label>
                                            <AddressAutocomplete
                                                id="endereco-evento-edit"
                                                value={enderecoEventoEdit}
                                                onChange={setEnderecoEventoEdit}
                                                placeholder="Digite o endereço do evento..."
                                            />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ) : pedido.observacoes && (
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
                                {pedido.clientes?.endereco_completo ? (
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.clientes.endereco_completo)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm hover:text-primary hover:underline transition-colors"
                                        title="Abrir no Google Maps"
                                    >
                                        {pedido.clientes.endereco_completo}
                                    </a>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Endereço não informado</p>
                                )}
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

                    {/* Contrato Anexado */}
                    <ContractAttachmentCard
                        pedidoId={pedidoId}
                        onContractChange={(_, url) => setAttachedContractUrl(url || null)}
                    />

                    {/* Pagamentos */}
                    <PaymentSection
                        pedidoId={pedidoId}
                        totalPedido={pedido.total_pedido}
                        onPaymentChange={loadPedido}
                    />

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

            {/* Quick Payment POS Modal */}
            <QuickPaymentModal
                open={quickPaymentOpen}
                onOpenChange={setQuickPaymentOpen}
                pedido={pedido ? {
                    id: pedido.id,
                    total_pedido: pedido.total_pedido,
                    status: pedido.status,
                    clientes: pedido.clientes,
                    data_evento: pedido.data_evento,
                    valor_pago: (pedido as any).valor_pago,
                } : null}
                valorPagoAtual={Number((pedido as any)?.valor_pago || 0)}
                valorSugeridoInicial={sugestaoValor}
                observacaoInicial={sugestaoObs}
                onSuccess={() => {
                    loadPedido()
                }}
            />
        </div>
    )
}

