'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { ArrowLeft, Plus, Trash2, Loader2, ShoppingCart, Sparkles, CheckCircle2, Truck, Home, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Cliente, Produto, DisponibilidadeProduto } from '@/lib/database.types'
import { ConversationImportDialog } from '@/components/conversation-import-dialog'
import type { ExtractionResult } from '@/lib/conversation-analyzer'
import { calculateFreightForAddress, getDefaultFreightConfig, type FreightConfig } from '@/lib/freight-calculator'
import { AddressAutocomplete } from '@/components/address-autocomplete'

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
    const [freightConfig, setFreightConfig] = useState<FreightConfig>(getDefaultFreightConfig())
    const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeProduto[]>([])

    const [clienteId, setClienteId] = useState('')
    const [dataEvento, setDataEvento] = useState('')
    const [horaEntrega, setHoraEntrega] = useState('14:00')
    const [observacoes, setObservacoes] = useState('')
    const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
    const [produtoSelecionado, setProdutoSelecionado] = useState('')
    const [quantidadeSelecionada, setQuantidadeSelecionada] = useState(1)
    const [importedData, setImportedData] = useState<ExtractionResult | null>(null)
    const [creatingClient, setCreatingClient] = useState(false)

    // Freight calculation states
    const [frete, setFrete] = useState(0)
    const [distanciaKm, setDistanciaKm] = useState(0)
    const [calculandoFrete, setCalculandoFrete] = useState(false)
    const [erroFrete, setErroFrete] = useState('')
    const [incluirFrete, setIncluirFrete] = useState(true) // Toggle frete

    // Estados para endereço do evento
    const [usarEnderecoResidencial, setUsarEnderecoResidencial] = useState(true)
    const [enderecoEvento, setEnderecoEvento] = useState('')

    async function loadData() {
        setLoading(true)

        const [clientesRes, produtosRes, configRes] = await Promise.all([
            supabase.from('clientes').select('*').order('nome'),
            supabase.from('produtos').select('*').order('nome'),
            (supabase as any).from('configuracoes').select('endereco, preco_km, frete_minimo').single()
        ])

        if (clientesRes.data) setClientes(clientesRes.data)
        if (produtosRes.data) setProdutos(produtosRes.data)

        // Set freight config from database or use defaults
        if (configRes.data) {
            setFreightConfig({
                storeAddress: configRes.data.endereco || getDefaultFreightConfig().storeAddress,
                pricePerKm: configRes.data.preco_km ?? getDefaultFreightConfig().pricePerKm,
                minimumFreight: configRes.data.frete_minimo ?? getDefaultFreightConfig().minimumFreight
            })
        }

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

    // Calculate freight when client is selected or event address changes
    useEffect(() => {
        async function calcularFrete() {
            // Determina qual endereço usar para cálculo do frete
            let enderecoParaFrete = ''

            if (usarEnderecoResidencial) {
                if (!clienteId) {
                    setFrete(0)
                    setDistanciaKm(0)
                    setErroFrete('')
                    return
                }
                const cliente = clientes.find(c => c.id === clienteId)
                if (!cliente?.endereco_completo) {
                    setFrete(0)
                    setDistanciaKm(0)
                    setErroFrete('Cliente sem endereço cadastrado')
                    return
                }
                enderecoParaFrete = cliente.endereco_completo
            } else {
                if (!enderecoEvento) {
                    setFrete(0)
                    setDistanciaKm(0)
                    setErroFrete('Informe o endereço do evento')
                    return
                }
                enderecoParaFrete = enderecoEvento
            }

            setCalculandoFrete(true)
            setErroFrete('')

            const result = await calculateFreightForAddress(enderecoParaFrete, freightConfig)

            if (result) {
                setFrete(result.freight)
                setDistanciaKm(result.distanceKm)
            } else {
                setFrete(freightConfig.minimumFreight) // Minimum freight as fallback
                setDistanciaKm(0)
                setErroFrete('Não foi possível calcular a distância. Usando frete mínimo.')
            }

            setCalculandoFrete(false)
        }

        calcularFrete()
    }, [clienteId, clientes, usarEnderecoResidencial, enderecoEvento, freightConfig])

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

    const subtotal = carrinho.reduce((acc, item) => acc + (item.produto.preco_unitario * item.quantidade), 0)
    const total = subtotal + (incluirFrete ? frete : 0)

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
                    hora_entrega: horaEntrega,
                    observacoes,
                    total_pedido: total,
                    frete: incluirFrete ? frete : 0,
                    distancia_km: incluirFrete ? distanciaKm : 0,
                    usar_endereco_residencial: usarEnderecoResidencial,
                    endereco_evento: usarEnderecoResidencial ? null : enderecoEvento,
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

    // Handler para importar dados da conversa
    async function handleConversationImport(result: ExtractionResult) {
        setImportedData(result)

        // Preenche data do evento
        if (result.pedido.data_evento) {
            setDataEvento(result.pedido.data_evento)
        }

        // Preenche hora de entrega
        if (result.pedido.hora_evento) {
            setHoraEntrega(result.pedido.hora_evento)
        }

        // Preenche observações
        const obs: string[] = []
        if (result.pedido.tipo_festa) obs.push(`Festa: ${result.pedido.tipo_festa}`)
        if (result.pedido.itens.length > 0) obs.push(`Itens solicitados: ${result.pedido.itens.join(', ')}`)
        if (result.pedido.observacoes) obs.push(result.pedido.observacoes)
        if (obs.length > 0) setObservacoes(obs.join('\n'))

        // Verifica se cliente já existe pelo telefone
        if (result.cliente.telefone) {
            const { data: existingClient } = await supabase
                .from('clientes')
                .select('id')
                .eq('telefone', result.cliente.telefone)
                .single()

            if (existingClient) {
                setClienteId(existingClient.id)
                return
            }
        }

        // Verifica pelo nome
        if (result.cliente.nome) {
            const { data: existingClient } = await supabase
                .from('clientes')
                .select('id')
                .ilike('nome', result.cliente.nome)
                .single()

            if (existingClient) {
                setClienteId(existingClient.id)
                return
            }
        }
    }

    // Cria cliente a partir dos dados importados
    async function createClientFromImport() {
        if (!importedData?.cliente.nome) {
            alert('Nome do cliente não foi extraído da conversa')
            return
        }

        setCreatingClient(true)

        try {
            const clientData = {
                nome: importedData.cliente.nome!,
                telefone: importedData.cliente.telefone || undefined,
                endereco: importedData.cliente.endereco || undefined,
            }

            const { data: newClient, error } = await (supabase as any)
                .from('clientes')
                .insert(clientData)
                .select()
                .single()

            if (error) throw error

            // Atualiza lista de clientes e seleciona o novo
            setClientes([...clientes, newClient])
            setClienteId(newClient.id)
            setImportedData(null)

        } catch (error) {
            console.error('Erro ao criar cliente:', error)
            alert('Erro ao criar cliente')
        } finally {
            setCreatingClient(false)
        }
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
                        <h1 className="text-3xl font-bold tracking-tight">Novo Pedido</h1>
                        <p className="text-muted-foreground">
                            Crie um novo pedido de locação
                        </p>
                    </div>
                </div>
                <ConversationImportDialog onImport={handleConversationImport} />
            </div>

            {/* Alerta de dados importados */}
            {importedData && !clienteId && importedData.cliente.nome && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                    <Sparkles className="h-4 w-4 text-green-600" />
                    <AlertDescription className="flex items-center justify-between">
                        <span>
                            Cliente <strong>{importedData.cliente.nome}</strong> não encontrado.
                        </span>
                        <Button
                            size="sm"
                            onClick={createClientFromImport}
                            disabled={creatingClient}
                            className="gap-2"
                        >
                            {creatingClient ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                            Criar Cliente
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {importedData && clienteId && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                        ✅ Dados importados com sucesso! Confira as informações abaixo.
                    </AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-3">
                {/* Dados do Pedido */}
                <div className="space-y-6 lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dados do Pedido</CardTitle>
                            <CardDescription>Informações básicas do pedido</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-3">
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
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="hora">Horário de Entrega *</Label>
                                    <Input
                                        id="hora"
                                        type="time"
                                        value={horaEntrega}
                                        onChange={(e) => setHoraEntrega(e.target.value)}
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

                            {/* Toggle Endereço do Evento */}
                            {clienteId && (
                                <div className="border-t pt-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base flex items-center gap-2">
                                                <Home className="h-4 w-4" />
                                                Endereço do Evento
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                {usarEnderecoResidencial
                                                    ? 'Usando endereço residencial do cliente'
                                                    : 'Usando endereço customizado'}
                                            </p>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <span className={`text-sm ${usarEnderecoResidencial ? 'text-muted-foreground' : 'font-medium'}`}>
                                                Customizado
                                            </span>
                                            <div
                                                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${usarEnderecoResidencial ? 'bg-primary' : 'bg-gray-300'
                                                    }`}
                                                onClick={() => setUsarEnderecoResidencial(!usarEnderecoResidencial)}
                                            >
                                                <div
                                                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${usarEnderecoResidencial ? 'translate-x-5' : 'translate-x-0.5'
                                                        }`}
                                                />
                                            </div>
                                            <span className={`text-sm ${usarEnderecoResidencial ? 'font-medium' : 'text-muted-foreground'}`}>
                                                Residencial
                                            </span>
                                        </label>
                                    </div>

                                    {usarEnderecoResidencial ? (
                                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            {clientes.find(c => c.id === clienteId)?.endereco_completo ? (
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientes.find(c => c.id === clienteId)?.endereco_completo || '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm hover:text-primary hover:underline transition-colors"
                                                    title="Abrir no Google Maps"
                                                >
                                                    {clientes.find(c => c.id === clienteId)?.endereco_completo}
                                                </a>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">Cliente sem endereço</span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid gap-2">
                                            <Label htmlFor="endereco-evento">Endereço do Evento *</Label>
                                            <AddressAutocomplete
                                                id="endereco-evento"
                                                value={enderecoEvento}
                                                onChange={setEnderecoEvento}
                                                placeholder="Digite o endereço do evento..."
                                                required={!usarEnderecoResidencial}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
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

                                    {/* Subtotal */}
                                    <div className="border-t pt-4 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Subtotal</span>
                                            <span>
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal)}
                                            </span>
                                        </div>

                                        {/* Freight Toggle */}
                                        <div className="flex items-center justify-between text-sm">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={incluirFrete}
                                                    onChange={(e) => setIncluirFrete(e.target.checked)}
                                                    className="h-4 w-4 rounded border-gray-300"
                                                />
                                                <span className="flex items-center gap-1">
                                                    <Truck className="h-3 w-3" />
                                                    Incluir Frete
                                                    {incluirFrete && distanciaKm > 0 && (
                                                        <span className="text-xs text-muted-foreground">
                                                            ({distanciaKm} km)
                                                        </span>
                                                    )}
                                                </span>
                                            </label>
                                            <span className={`flex items-center gap-2 ${!incluirFrete ? 'line-through text-muted-foreground' : ''}`}>
                                                {calculandoFrete ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(frete)
                                                )}
                                            </span>
                                        </div>

                                        {erroFrete && (
                                            <p className="text-xs text-amber-600">{erroFrete}</p>
                                        )}

                                        {/* Total */}
                                        <div className="flex justify-between text-lg font-bold border-t pt-2">
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
