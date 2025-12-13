'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
    Truck,
    Package,
    Users,
    DollarSign,
    CalendarDays,
    Clock,
    ArrowRight
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
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

export default function DashboardPage() {
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [stats, setStats] = useState({
        entregasHoje: 0,
        pedidosPendentes: 0,
        totalClientes: 0,
        faturamentoMes: 0,
    })
    const [pedidosRecentes, setPedidosRecentes] = useState<PedidoComCliente[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            try {
                const hoje = format(new Date(), 'yyyy-MM-dd')
                const inicioMes = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')

                // Entregas de hoje
                const { count: entregasHoje } = await supabase
                    .from('pedidos')
                    .select('*', { count: 'exact', head: true })
                    .eq('data_evento', hoje)
                    .not('status', 'eq', 'orcamento')

                // Pedidos pendentes (não finalizados)
                const { count: pedidosPendentes } = await supabase
                    .from('pedidos')
                    .select('*', { count: 'exact', head: true })
                    .not('status', 'in', '("finalizado","orcamento")')

                // Total de clientes
                const { count: totalClientes } = await supabase
                    .from('clientes')
                    .select('*', { count: 'exact', head: true })

                // Faturamento do mês
                const { data: faturamento } = await supabase
                    .from('pedidos')
                    .select('total_pedido')
                    .gte('created_at', inicioMes)
                    .eq('status', 'finalizado')

                const faturamentoMes = faturamento?.reduce((acc, p) => acc + (p.total_pedido || 0), 0) || 0

                setStats({
                    entregasHoje: entregasHoje || 0,
                    pedidosPendentes: pedidosPendentes || 0,
                    totalClientes: totalClientes || 0,
                    faturamentoMes,
                })

                // Pedidos recentes
                const { data: pedidos } = await supabase
                    .from('pedidos')
                    .select('*, clientes(*)')
                    .order('created_at', { ascending: false })
                    .limit(5)

                setPedidosRecentes((pedidos as PedidoComCliente[]) || [])
            } catch (error) {
                console.error('Erro ao carregar dados:', error)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [])

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                    Bem-vindo ao FestaLog! Aqui está o resumo do seu negócio.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Entregas Hoje</CardTitle>
                        <Truck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.entregasHoje}</div>
                        <p className="text-xs text-muted-foreground">
                            {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pedidos Pendentes</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pedidosPendentes}</div>
                        <p className="text-xs text-muted-foreground">
                            Aguardando ação
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalClientes}</div>
                        <p className="text-xs text-muted-foreground">
                            Cadastrados no sistema
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Faturamento do Mês</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.faturamentoMes)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Pedidos finalizados
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <div className="grid gap-8 lg:grid-cols-3">
                {/* Pedidos Recentes */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Pedidos Recentes</CardTitle>
                            <CardDescription>Últimos pedidos cadastrados no sistema</CardDescription>
                        </div>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/pedidos">
                                Ver todos
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : pedidosRecentes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Package className="h-12 w-12 text-muted-foreground/50" />
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Nenhum pedido cadastrado ainda
                                </p>
                                <Button asChild className="mt-4" size="sm">
                                    <Link href="/pedidos/novo">Criar Primeiro Pedido</Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {pedidosRecentes.map((pedido) => (
                                    <div
                                        key={pedido.id}
                                        className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                                <CalendarDays className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{pedido.clientes?.nome || 'Cliente'}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {format(new Date(pedido.data_evento), "dd/MM/yyyy")}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="font-medium">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido)}
                                                </p>
                                            </div>
                                            <Badge className={statusColors[pedido.status]}>
                                                {statusLabels[pedido.status]}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Calendário */}
                <Card>
                    <CardHeader>
                        <CardTitle>Calendário</CardTitle>
                        <CardDescription>Selecione uma data para ver os eventos</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            className="rounded-md border"
                            locale={ptBR}
                        />
                        {date && (
                            <div className="mt-4">
                                <Button asChild className="w-full">
                                    <Link href={`/pedidos?data=${format(date, 'yyyy-MM-dd')}`}>
                                        Ver pedidos de {format(date, "dd/MM")}
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
