'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Plus,
    FileText,
    Loader2,
    Eye,
    Pencil,
    Phone,
    Calendar,
    Filter,
    ChevronDown,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import type { PedidoComCliente, StatusPedido } from '@/lib/database.types'

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

function PedidosContent() {
    const searchParams = useSearchParams()
    const dataParam = searchParams.get('data')

    const [pedidos, setPedidos] = useState<PedidoComCliente[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusPedido | 'todos'>('todos')
    const [dataFilter, setDataFilter] = useState(dataParam || '')
    const [visibleCount, setVisibleCount] = useState(8)

    async function loadPedidos() {
        setLoading(true)

        let query = supabase
            .from('pedidos')
            .select('*, clientes(*)')
            .order('created_at', { ascending: false })
            .order('data_evento', { ascending: false })

        if (statusFilter !== 'todos') {
            query = query.eq('status', statusFilter)
        }

        if (dataFilter) {
            query = query.eq('data_evento', dataFilter)
        }

        const { data, error } = await query

        if (error) {
            console.error('Erro ao carregar pedidos:', error)
        } else {
            setPedidos((data as PedidoComCliente[]) || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        loadPedidos()
    }, [statusFilter, dataFilter])

    const filteredPedidos = pedidos.filter((pedido) =>
        pedido.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const visiblePedidos = filteredPedidos.slice(0, visibleCount)
    const hasMorePedidos = visibleCount < filteredPedidos.length

    useEffect(() => {
        setVisibleCount(8)
    }, [searchTerm, statusFilter, dataFilter])

    async function updateStatus(pedidoId: string, newStatus: StatusPedido) {
        const { error } = await supabase
            .from('pedidos')
            .update({ status: newStatus })
            .eq('id', pedidoId)

        if (error) {
            console.error('Erro ao atualizar status:', error)
        } else {
            loadPedidos()
        }
    }

    function openWhatsApp(whatsapp: string, nome: string) {
        const number = whatsapp.replace(/\D/g, '')
        const message = `👋 Olá ${nome}! Aqui é da *Lu Festas* 🎉\n\nComo posso ajudar?`
        window.open(`https://api.whatsapp.com/send?phone=55${number}&text=${encodeURIComponent(message)}`, '_blank')
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
                    <p className="text-muted-foreground">
                        Gerencie os pedidos de locação, com os mais recentes primeiro
                    </p>
                </div>
                <Button asChild>
                    <Link href="/pedidos/novo">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Pedido
                    </Link>
                </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto_auto]">
                <Input
                    placeholder="Buscar por cliente..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                />
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusPedido | 'todos')}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filtrar por status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos os status</SelectItem>
                            {allStatus.map((status) => (
                                <SelectItem key={status} value={status}>
                                    {statusLabels[status]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                        type="date"
                        value={dataFilter}
                        onChange={(event) => setDataFilter(event.target.value)}
                        className="w-full sm:w-[180px]"
                    />
                    {dataFilter && (
                        <Button variant="ghost" size="sm" onClick={() => setDataFilter('')}>
                            Limpar
                        </Button>
                    )}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Pedidos recentes</CardTitle>
                            <CardDescription>
                                {filteredPedidos.length} pedido{filteredPedidos.length !== 1 ? 's' : ''} encontrado{filteredPedidos.length !== 1 ? 's' : ''}
                                {dataFilter && ` para ${format(new Date(dataFilter + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}`}
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="w-fit">
                            Novos primeiro
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredPedidos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <FileText className="h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                Nenhum pedido encontrado
                            </p>
                            <Button asChild className="mt-4" size="sm">
                                <Link href="/pedidos/novo">Criar Novo Pedido</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid gap-3 xl:grid-cols-2">
                                {visiblePedidos.map((pedido) => (
                                    <div
                                        key={pedido.id}
                                        className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0 space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="truncate text-base font-semibold">
                                                        {pedido.clientes?.nome || 'Cliente'}
                                                    </p>
                                                    <Badge className={statusColors[pedido.status]}>
                                                        {statusLabels[pedido.status]}
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {format(new Date(pedido.data_evento + 'T12:00:00'), 'dd/MM/yyyy')}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-1 text-green-600 transition-colors hover:text-green-700"
                                                        onClick={() => openWhatsApp(pedido.clientes?.whatsapp || '', pedido.clientes?.nome || '')}
                                                    >
                                                        <Phone className="h-3.5 w-3.5" />
                                                        {pedido.clientes?.whatsapp || 'Sem telefone'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right">
                                                <p className="text-lg font-bold">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                                            <Select
                                                value={pedido.status}
                                                onValueChange={(value: StatusPedido) => updateStatus(pedido.id, value)}
                                            >
                                                <SelectTrigger className="w-full sm:w-[180px]">
                                                    <SelectValue placeholder="Alterar status" />
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

                                            <div className="grid grid-cols-2 gap-2 sm:flex">
                                                <Button asChild variant="outline" size="sm">
                                                    <Link href={`/pedidos/${pedido.id}?editar=true`}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Editar
                                                    </Link>
                                                </Button>
                                                <Button asChild size="sm">
                                                    <Link href={`/pedidos/${pedido.id}`}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        Ver
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {hasMorePedidos && (
                                <div className="flex justify-center pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setVisibleCount((count) => count + 8)}
                                    >
                                        Ver mais pedidos
                                        <ChevronDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function PedidosPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <PedidosContent />
        </Suspense>
    )
}
