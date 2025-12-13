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
import { ArrowLeft, Plus, Trash2, Loader2, ShoppingCart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Cliente, Produto, DisponibilidadeProduto } from '@/lib/database.types'

interface ItemCarrinho {
    produto: Produto
    quantidade: number
    disponivel: number
}

export default function NovoPedidoPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeProduto[]>([])

    const [clienteId, setClienteId] = useState('')
    const [dataEvento, setDataEvento] = useState('')
    const [observacoes, setObservacoes] = useState('')
    const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
    const [produtoSelecionado, setProdutoSelecionado] = useState('')
    const [quantidadeSelecionada, setQuantidadeSelecionada] = useState(1)

    async function loadData() {
        setLoading(true)

        const [clientesRes, produtosRes] = await Promise.all([
            supabase.from('clientes').select('*').order('nome'),
            supabase.from('produtos').select('*').order('nome'),
        ])

        if (clientesRes.data) setClientes(clientesRes.data)
        if (produtosRes.data) setProdutos(produtosRes.data)

        setLoading(false)
    }

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

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        if (dataEvento) {
            checkDisponibilidade(dataEvento)
            // Limpa carrinho ao mudar data
            setCarrinho([])
        }
    }, [dataEvento])

    function getDisponivel(produtoId: string): number {
        const item = disponibilidade.find(d => d.produto_id === produtoId)
        return item ? Number(item.quantidade_disponivel) : 0
    }

    function addToCarrinho() {
        if (!produtoSelecionado || quantidadeSelecionada < 1) return

        const produto = produtos.find(p => p.id === produtoSelecionado)
        if (!produto) return

        const disponivel = getDisponivel(produtoSelecionado)

        // Verifica se já está no carrinho
        const existingIndex = carrinho.findIndex(item => item.produto.id === produtoSelecionado)

        if (existingIndex >= 0) {
            const newQtd = carrinho[existingIndex].quantidade + quantidadeSelecionada
            if (newQtd > disponivel) {
                alert(`Quantidade indisponível. Máximo disponível: ${disponivel}`)
                return
            }
            const newCarrinho = [...carrinho]
            newCarrinho[existingIndex].quantidade = newQtd
            setCarrinho(newCarrinho)
        } else {
            if (quantidadeSelecionada > disponivel) {
                alert(`Quantidade indisponível. Máximo disponível: ${disponivel}`)
                return
            }
            setCarrinho([...carrinho, { produto, quantidade: quantidadeSelecionada, disponivel }])
        }

        setProdutoSelecionado('')
        setQuantidadeSelecionada(1)
    }

    function removeFromCarrinho(index: number) {
        setCarrinho(carrinho.filter((_, i) => i !== index))
    }

    function updateQuantidade(index: number, novaQuantidade: number) {
        if (novaQuantidade < 1) return
        if (novaQuantidade > carrinho[index].disponivel) {
            alert(`Quantidade indisponível. Máximo disponível: ${carrinho[index].disponivel}`)
            return
        }
        const newCarrinho = [...carrinho]
        newCarrinho[index].quantidade = novaQuantidade
        setCarrinho(newCarrinho)
    }

    const total = carrinho.reduce((acc, item) => acc + (item.produto.preco_unitario * item.quantidade), 0)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if (!clienteId || !dataEvento || carrinho.length === 0) {
            alert('Preencha todos os campos e adicione pelo menos um produto')
            return
        }

        setSaving(true)

        try {
            // Criar pedido
            const { data: pedido, error: pedidoError } = await supabase
                .from('pedidos')
                .insert({
                    cliente_id: clienteId,
                    data_evento: dataEvento,
                    observacoes,
                    total_pedido: total,
                })
                .select()
                .single()

            if (pedidoError) throw pedidoError

            // Criar itens do pedido
            const itens = carrinho.map(item => ({
                pedido_id: pedido.id,
                produto_id: item.produto.id,
                quantidade: item.quantidade,
                preco_unitario: item.produto.preco_unitario,
            }))

            const { error: itensError } = await supabase
                .from('itens_pedido')
                .insert(itens)

            if (itensError) throw itensError

            router.push('/pedidos')
        } catch (error) {
            console.error('Erro ao criar pedido:', error)
            alert('Erro ao criar pedido. Tente novamente.')
        } finally {
            setSaving(false)
        }
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
                    <Link href="/pedidos">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Novo Pedido</h1>
                    <p className="text-muted-foreground">
                        Crie um novo pedido de locação
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-3">
                {/* Dados do Pedido */}
                <div className="space-y-6 lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dados do Pedido</CardTitle>
                            <CardDescription>Informações básicas do pedido</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="cliente">Cliente *</Label>
                                    <Select value={clienteId} onValueChange={setClienteId} required>
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
                                    {clientes.length === 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            <Link href="/clientes" className="text-primary hover:underline">
                                                Cadastre um cliente primeiro
                                            </Link>
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="data">Data do Evento *</Label>
                                    <Input
                                        id="data"
                                        type="date"
                                        value={dataEvento}
                                        onChange={(e) => setDataEvento(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="observacoes">Observações</Label>
                                <Textarea
                                    id="observacoes"
                                    value={observacoes}
                                    onChange={(e) => setObservacoes(e.target.value)}
                                    placeholder="Informações adicionais sobre o pedido..."
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Adicionar Produtos */}
                    {dataEvento && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Adicionar Produtos</CardTitle>
                                <CardDescription>
                                    Selecione os produtos para o pedido (disponibilidade verificada para {dataEvento})
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-4">
                                    <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Selecione um produto" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {produtos.map((produto) => {
                                                const disp = getDisponivel(produto.id)
                                                return (
                                                    <SelectItem
                                                        key={produto.id}
                                                        value={produto.id}
                                                        disabled={disp === 0}
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
                                    <Button type="button" onClick={addToCarrinho}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Carrinho */}
                                {carrinho.length > 0 && (
                                    <div className="mt-6">
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
                                                {carrinho.map((item, index) => (
                                                    <TableRow key={item.produto.id}>
                                                        <TableCell className="font-medium">{item.produto.nome}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                max={item.disponivel}
                                                                value={item.quantidade}
                                                                onChange={(e) => updateQuantidade(index, parseInt(e.target.value) || 1)}
                                                                className="w-20 text-center"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.produto.preco_unitario)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.produto.preco_unitario * item.quantidade)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-destructive hover:text-destructive"
                                                                onClick={() => removeFromCarrinho(index)}
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
                    )}
                </div>

                {/* Resumo */}
                <div>
                    <Card className="sticky top-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5" />
                                Resumo do Pedido
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {carrinho.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {dataEvento
                                        ? 'Adicione produtos ao pedido'
                                        : 'Selecione a data do evento primeiro'}
                                </p>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        {carrinho.map((item) => (
                                            <div key={item.produto.id} className="flex justify-between text-sm">
                                                <span>{item.quantidade}x {item.produto.nome}</span>
                                                <span className="font-medium">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.produto.preco_unitario * item.quantidade)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t pt-4">
                                        <div className="flex justify-between text-lg font-bold">
                                            <span>Total</span>
                                            <span className="text-primary">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}

                            <Button
                                type="submit"
                                className="w-full"
                                size="lg"
                                disabled={saving || carrinho.length === 0}
                            >
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Criar Pedido
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </form>
        </div>
    )
}
