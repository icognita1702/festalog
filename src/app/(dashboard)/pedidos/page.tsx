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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Plus,
    FileText,
    Loader2,
    Eye,
    Phone,
    Calendar,
    Filter
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

    async function loadPedidos() {
        setLoading(true)

        let query = supabase
            .from('pedidos')
            .select('*, clientes(*)')
            .order('data_evento', { ascending: true })

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

    const filteredPedidos = pedidos.filter(pedido =>
        pedido.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase())
    )

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
        window.open(`https://wa.me/55${number}?text=${encodeURIComponent(message)}`, '_blank')
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
                    <p className="text-muted-foreground">
                        Gerencie os pedidos de locação
                    </p>
                </div>
                <Button asChild>
                    <Link href="/pedidos/novo">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Pedido
                    </Link>
                </Button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-4">
                <Input
                    placeholder="Buscar por cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-xs"
                />
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusPedido | 'todos')}>
                        <SelectTrigger className="w-[180px]">
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
                        onChange={(e) => setDataFilter(e.target.value)}
                        className="w-[180px]"
                    />
                    {dataFilter && (
                        <Button variant="ghost" size="sm" onClick={() => setDataFilter('')}>
                            Limpar
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabela */}
            <Card>
                <CardHeader>
                    <CardTitle>Lista de Pedidos</CardTitle>
                    <CardDescription>
                        {filteredPedidos.length} pedido{filteredPedidos.length !== 1 ? 's' : ''} encontrado{filteredPedidos.length !== 1 ? 's' : ''}
                        {dataFilter && ` para ${format(new Date(dataFilter + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}`}
                    </CardDescription>
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
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Data Evento</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPedidos.map((pedido) => (
                                    <TableRow key={pedido.id}>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{pedido.clientes?.nome}</p>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto p-0 text-xs text-green-600 hover:text-green-700"
                                                    onClick={() => openWhatsApp(pedido.clientes?.whatsapp || '', pedido.clientes?.nome || '')}
                                                >
                                                    <Phone className="mr-1 h-3 w-3" />
                                                    {pedido.clientes?.whatsapp}
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(pedido.data_evento + 'T12:00:00'), "dd/MM/yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={pedido.status}
                                                onValueChange={(value: StatusPedido) => updateStatus(pedido.id, value)}
                                            >
                                                <SelectTrigger className="w-[160px]">
                                                    <Badge className={statusColors[pedido.status]}>
                                                        {statusLabels[pedido.status]}
                                                    </Badge>
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
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild variant="ghost" size="icon">
                                                <Link href={`/pedidos/${pedido.id}`}>
                                                    <Eye className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
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
