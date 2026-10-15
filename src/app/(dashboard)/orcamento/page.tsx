'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { ArrowLeft, Plus, Trash2, Loader2, Calculator, Share2, FileText, Truck, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Cliente, Produto, DisponibilidadeProduto } from '@/lib/database.types'
import { calculateFreightForAddress, getDefaultFreightConfig, type FreightConfig } from '@/lib/freight-calculator'
import { getInclusiveRentalDays } from '@/lib/rental-period'

interface ItemOrcamento {
    produto: Produto
    quantidade: number
    disponivel: number
}

export default function OrcamentoPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [freightConfig, setFreightConfig] = useState<FreightConfig>(getDefaultFreightConfig())
    const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeProduto[]>([])

    // Form states
    const [clienteId, setClienteId] = useState('')
    const [novoClienteNome, setNovoClienteNome] = useState('')
    const [novoClienteWhatsapp, setNovoClienteWhatsapp] = useState('')
    const [novoClienteEndereco, setNovoClienteEndereco] = useState('')
    const [modoNovoCliente, setModoNovoCliente] = useState(false)
    const [dataEvento, setDataEvento] = useState('')
    const [dataFimEvento, setDataFimEvento] = useState('')
    const [observacoes, setObservacoes] = useState('')
    const [itens, setItens] = useState<ItemOrcamento[]>([])
    const [produtoSelecionado, setProdutoSelecionado] = useState('')
    const [quantidadeSelecionada, setQuantidadeSelecionada] = useState(1)

    // Freight states
    const [frete, setFrete] = useState(0)
    const [distanciaKm, setDistanciaKm] = useState(0)
    const [calculandoFrete, setCalculandoFrete] = useState(false)

    async function loadData() {
        setLoading(true)

        const [clientesRes, produtosRes, configRes] = await Promise.all([
            supabase.from('clientes').select('*').order('nome'),
            supabase.from('produtos').select('*').order('nome'),
            (supabase as any).from('configuracoes').select('endereco, preco_km, frete_minimo').single()
        ])

        if (clientesRes.data) setClientes(clientesRes.data)
        if (produtosRes.data) setProdutos(produtosRes.data)

        if (configRes.data) {
            setFreightConfig({
                storeAddress: configRes.data.endereco || getDefaultFreightConfig().storeAddress,
                pricePerKm: configRes.data.preco_km ?? getDefaultFreightConfig().pricePerKm,
                minimumFreight: configRes.data.frete_minimo ?? getDefaultFreightConfig().minimumFreight
            })
        }

        setLoading(false)
    }

    async function checkDisponibilidade(inicio: string, fim: string) {
        if (!inicio || !fim || fim < inicio) return

        const { data: disp } = await supabase
            .rpc('calcular_disponibilidade_periodo', { p_data_inicio: inicio, p_data_fim: fim })

        if (disp) setDisponibilidade(disp)
    }

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        if (dataEvento && dataFimEvento && dataFimEvento >= dataEvento) {
            checkDisponibilidade(dataEvento, dataFimEvento)
        }
    }, [dataEvento, dataFimEvento])

    // Calculate freight when client is selected
    useEffect(() => {
        async function calcularFrete() {
            if (!clienteId && !novoClienteEndereco) {
                setFrete(0)
                setDistanciaKm(0)
                return
            }

            const endereco = modoNovoCliente
                ? novoClienteEndereco
                : clientes.find(c => c.id === clienteId)?.endereco_completo

            if (!endereco) {
                setFrete(freightConfig.minimumFreight)
                return
            }

            setCalculandoFrete(true)
            const result = await calculateFreightForAddress(endereco, freightConfig)

            if (result) {
                setFrete(result.freight)
                setDistanciaKm(result.distanceKm)
            } else {
                setFrete(freightConfig.minimumFreight)
            }
            setCalculandoFrete(false)
        }

        calcularFrete()
    }, [clienteId, novoClienteEndereco, modoNovoCliente, clientes, freightConfig])

    function getDisponivel(produtoId: string, quantidadeTotalFallback?: number): number {
        const item = disponibilidade.find(d => d.produto_id === produtoId)
        if (item) {
            return Number(item.quantidade_disponivel)
        }
        if (typeof quantidadeTotalFallback === 'number') {
            return quantidadeTotalFallback
        }
        const produto = produtos.find(p => p.id === produtoId)
        return produto ? produto.quantidade_total : 0
    }

    function addItem() {
        if (!produtoSelecionado || quantidadeSelecionada < 1) return

        const produto = produtos.find(p => p.id === produtoSelecionado)
        if (!produto) return

        const disponivel = getDisponivel(produtoSelecionado, produto.quantidade_total)
        const existingIndex = itens.findIndex(item => item.produto.id === produtoSelecionado)

        if (existingIndex >= 0) {
            const newQtd = itens[existingIndex].quantidade + quantidadeSelecionada
            if (newQtd > disponivel) {
                alert(`Quantidade indisponível. Máximo: ${disponivel}`)
                return
            }
            const newItens = [...itens]
            newItens[existingIndex].quantidade = newQtd
            setItens(newItens)
        } else {
            if (quantidadeSelecionada > disponivel && disponivel > 0) {
                alert(`Quantidade indisponível. Máximo: ${disponivel}`)
                return
            }
            setItens([...itens, { produto, quantidade: quantidadeSelecionada, disponivel }])
        }

        setProdutoSelecionado('')
        setQuantidadeSelecionada(1)
    }

    function removeItem(index: number) {
        setItens(itens.filter((_, i) => i !== index))
    }

    function updateQuantidade(index: number, novaQuantidade: number) {
        if (novaQuantidade < 1) return
        if (novaQuantidade > itens[index].disponivel && itens[index].disponivel > 0) {
            alert(`Quantidade indisponível. Máximo: ${itens[index].disponivel}`)
            return
        }
        const newItens = [...itens]
        newItens[index].quantidade = novaQuantidade
        setItens(newItens)
    }

    const diasLocacao = getInclusiveRentalDays(dataEvento, dataFimEvento)
    const subtotalDiario = itens.reduce((acc, item) => acc + (item.produto.preco_unitario * item.quantidade), 0)
    const subtotal = subtotalDiario * diasLocacao
    const total = subtotal + frete

    async function handleSaveOrcamento() {
        if (dataEvento && (!dataFimEvento || dataFimEvento < dataEvento)) {
            alert('A data final não pode ser anterior à data inicial.')
            return
        }
        if (itens.length === 0) {
            alert('Adicione pelo menos um produto')
            return
        }

        setSaving(true)

        try {
            let finalClienteId = clienteId

            // Create new client if needed
            if (modoNovoCliente && novoClienteNome) {
                const { data: newClient, error: clientError } = await supabase
                    .from('clientes')
                    .insert({
                        nome: novoClienteNome,
                        whatsapp: novoClienteWhatsapp || '',
                        endereco_completo: novoClienteEndereco || ''
                    })
                    .select()
                    .single()

                if (clientError) throw clientError
                finalClienteId = newClient.id
            }

            if (!finalClienteId) {
                alert('Selecione ou cadastre um cliente')
                setSaving(false)
                return
            }

            const { data: pedidoId, error } = await supabase.rpc('criar_pedido_periodo_transacional', {
                p_cliente_id: finalClienteId,
                p_data_evento: dataEvento || new Date().toISOString().split('T')[0],
                p_data_fim_evento: dataFimEvento || dataEvento || new Date().toISOString().split('T')[0],
                p_hora_entrega: null,
                p_observacoes: observacoes || null,
                p_frete: frete,
                p_distancia_km: distanciaKm,
                p_usar_endereco_residencial: true,
                p_endereco_evento: null,
                p_itens: itens.map((item) => ({
                    produto_id: item.produto.id,
                    quantidade: item.quantidade,
                    preco_unitario: item.produto.preco_unitario,
                })),
                p_pagamento_valor: 0,
                p_pagamento_metodo: null,
            })
            if (error) throw error
            if (!pedidoId) throw new Error('O banco não retornou o identificador do orçamento.')

            // Redirect to budget template
            router.push(`/templates/orcamento/${pedidoId}`)
        } catch (error) {
            console.error('Erro ao salvar orçamento:', error)
            const message = error instanceof Error ? error.message : 'Falha inesperada ao salvar.'
            alert(`Não foi possível salvar o orçamento: ${message}`)
        } finally {
            setSaving(false)
        }
    }

    function shareWhatsApp() {
        const cliente = clientes.find(c => c.id === clienteId)
        const nomeCliente = modoNovoCliente ? novoClienteNome : (cliente?.nome || 'Cliente')

        let msg = `🎉 *Orçamento - Lu Festas*\n\n`
        msg += `Olá ${nomeCliente}!\n\n`
        msg += `📋 *Itens:*\n`

        itens.forEach(item => {
            msg += `• ${item.quantidade}x ${item.produto.nome} - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.produto.preco_unitario * item.quantidade * diasLocacao)}\n`
        })

        msg += `\n📦 Subtotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal)}`
        msg += `\n🚚 Frete: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(frete)}`
        msg += `\n\n💰 *Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}*`

        if (dataEvento) {
            msg += `\n\n📅 Período: ${new Date(dataEvento + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date((dataFimEvento || dataEvento) + 'T12:00:00').toLocaleDateString('pt-BR')} (${diasLocacao} ${diasLocacao === 1 ? 'diária' : 'diárias'})`
        }

        msg += `\n\n_Orçamento válido por 7 dias_`

        const whatsappNumber = modoNovoCliente ? novoClienteWhatsapp : (cliente?.whatsapp || '')
        const url = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
        window.open(url, '_blank')
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button asChild variant="ghost" size="icon">
                    <Link href="/dashboard">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Calculator className="h-8 w-8 text-primary" />
                        Calculadora de Orçamento
                    </h1>
                    <p className="text-muted-foreground">
                        Monte seu orçamento e compartilhe com o cliente
                    </p>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Left Column - Form */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Client Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Cliente</CardTitle>
                            <CardDescription>Selecione um cliente existente ou cadastre um novo</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    variant={!modoNovoCliente ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setModoNovoCliente(false)}
                                >
                                    Cliente Existente
                                </Button>
                                <Button
                                    variant={modoNovoCliente ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setModoNovoCliente(true)}
                                    className="gap-1"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    Novo Cliente
                                </Button>
                            </div>

                            {!modoNovoCliente ? (
                                <Select value={clienteId} onValueChange={setClienteId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o cliente" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clientes.map((cliente) => (
                                            <SelectItem key={cliente.id} value={cliente.id}>
                                                {cliente.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div className="grid gap-2">
                                        <Label>Nome *</Label>
                                        <Input
                                            value={novoClienteNome}
                                            onChange={(e) => setNovoClienteNome(e.target.value)}
                                            placeholder="Nome do cliente"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>WhatsApp</Label>
                                        <Input
                                            value={novoClienteWhatsapp}
                                            onChange={(e) => setNovoClienteWhatsapp(e.target.value)}
                                            placeholder="31999999999"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Endereço</Label>
                                        <Input
                                            value={novoClienteEndereco}
                                            onChange={(e) => setNovoClienteEndereco(e.target.value)}
                                            placeholder="Rua, número - Bairro"
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Event Date */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Período da Locação</CardTitle>
                            <CardDescription>Opcional - as datas inicial e final são inclusivas</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="data-inicio">Data inicial</Label>
                                    <Input id="data-inicio" type="date" value={dataEvento} onChange={(e) => {
                                        const inicio = e.target.value
                                        setDataEvento(inicio)
                                        if (!inicio) setDataFimEvento('')
                                        else if (!dataFimEvento || dataFimEvento < inicio) setDataFimEvento(inicio)
                                    }} min={new Date().toISOString().split('T')[0]} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="data-fim">Data final</Label>
                                    <Input id="data-fim" type="date" value={dataFimEvento} onChange={(e) => setDataFimEvento(e.target.value)} min={dataEvento || new Date().toISOString().split('T')[0]} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Products */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Produtos</CardTitle>
                            <CardDescription>
                                Adicione produtos ao orçamento
                                {dataEvento && ` (disponibilidade para todo o período · ${diasLocacao} ${diasLocacao === 1 ? 'diária' : 'diárias'})`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione um produto" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {produtos.map((produto) => {
                                            const disp = getDisponivel(produto.id, produto.quantidade_total)
                                            const dispLabel = dataEvento ? ` (${disp} disp.)` : ''
                                            return (
                                                <SelectItem
                                                    key={produto.id}
                                                    value={produto.id}
                                                    disabled={dataEvento ? disp === 0 : false}
                                                >
                                                    {produto.nome} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco_unitario)}
                                                    {dispLabel}
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
                                    placeholder="Qtd"
                                />
                                <Button type="button" onClick={addItem}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Items Table */}
                            {itens.length > 0 && (
                                <div className="mt-6">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Produto</TableHead>
                                                <TableHead className="text-center">Qtd</TableHead>
                                                <TableHead className="text-right">Preço Unit.</TableHead>
                                                    <TableHead className="text-right">Subtotal ({diasLocacao} {diasLocacao === 1 ? 'diária' : 'diárias'})</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {itens.map((item, index) => (
                                                <TableRow key={item.produto.id}>
                                                    <TableCell className="font-medium">{item.produto.nome}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantidade}
                                                            onChange={(e) => updateQuantidade(index, parseInt(e.target.value) || 1)}
                                                            className="w-20 text-center"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.produto.preco_unitario)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.produto.preco_unitario * item.quantidade * diasLocacao)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => removeItem(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Notes */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Observações</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                placeholder="Informações adicionais sobre o orçamento..."
                                rows={3}
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Summary */}
                <div>
                    <Card className="sticky top-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calculator className="h-5 w-5" />
                                Resumo do Orçamento
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {itens.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Adicione produtos para ver o orçamento
                                </p>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        {itens.map((item) => (
                                            <div key={item.produto.id} className="flex justify-between text-sm">
                                                <span>{item.quantidade}x {item.produto.nome}</span>
                                                <span className="font-medium">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.produto.preco_unitario * item.quantidade * diasLocacao)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="border-t pt-4 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Subtotal ({diasLocacao} {diasLocacao === 1 ? 'diária' : 'diárias'})</span>
                                            <span>
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between text-sm">
                                            <span className="flex items-center gap-1">
                                                <Truck className="h-3 w-3" />
                                                Frete
                                                {distanciaKm > 0 && (
                                                    <span className="text-xs text-muted-foreground">
                                                        ({distanciaKm} km)
                                                    </span>
                                                )}
                                            </span>
                                            <span className="flex items-center gap-2">
                                                {calculandoFrete ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(frete)
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex justify-between text-lg font-bold border-t pt-2">
                                            <span>Total</span>
                                            <span className="text-primary">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="space-y-2 pt-4">
                                <Button
                                    className="w-full gap-2"
                                    size="lg"
                                    disabled={saving || itens.length === 0}
                                    onClick={handleSaveOrcamento}
                                >
                                    {saving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <FileText className="h-4 w-4" />
                                    )}
                                    Gerar Orçamento
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full gap-2"
                                    disabled={itens.length === 0}
                                    onClick={shareWhatsApp}
                                >
                                    <Share2 className="h-4 w-4" />
                                    Compartilhar WhatsApp
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
