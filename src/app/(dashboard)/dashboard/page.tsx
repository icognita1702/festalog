'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Truck,
    Package,
    Users,
    DollarSign,
    CalendarDays,
    Clock,
    ArrowRight,
    MapPin,
    Phone,
    Loader2,
    ExternalLink
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
    const [showPopup, setShowPopup] = useState(false)
    const [pedidosData, setPedidosData] = useState<PedidoComCliente[]>([])
    const [loadingPedidos, setLoadingPedidos] = useState(false)
    const [stats, setStats] = useState({
        entregasHoje: 0,
        pedidosPendentes: 0,
        totalClientes: 0,
        faturamentoMes: 0,
    })
    const [pedidosRecentes, setPedidosRecentes] = useState<PedidoComCliente[]>([])
    const [loading, setLoading] = useState(true)
    const [pedidosPorData, setPedidosPorData] = useState<Record<string, number>>({})

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

                // Carregar contagem de pedidos por data para o calendário
                const { data: todasDatas } = await supabase
                    .from('pedidos')
                    .select('data_evento')
                    .not('status', 'eq', 'orcamento')

                if (todasDatas) {
                    const contagem: Record<string, number> = {}
                    todasDatas.forEach(p => {
                        contagem[p.data_evento] = (contagem[p.data_evento] || 0) + 1
                    })
                    setPedidosPorData(contagem)
                }
            } catch (error) {
                console.error('Erro ao carregar dados:', error)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [])

    async function handleDateSelect(selectedDate: Date | undefined) {
        setDate(selectedDate)
        if (selectedDate) {
            setShowPopup(true)
            setLoadingPedidos(true)

            const dataFormatada = format(selectedDate, 'yyyy-MM-dd')
            const { data, error } = await supabase
                .from('pedidos')
                .select('*, clientes(*)')
                .eq('data_evento', dataFormatada)
                .order('hora_entrega', { ascending: true })

            if (!error && data) {
                setPedidosData(data as PedidoComCliente[])
            } else {
                setPedidosData([])
            }
            setLoadingPedidos(false)
        }
    }

    // Função para destacar datas com pedidos (verde = entregas)
    const modifiers = {
        hasEvent: (day: Date) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            return dateStr in pedidosPorData
        }
    }

    const modifiersStyles = {
        hasEvent: {
            backgroundColor: '#22c55e',  // Verde para entregas
            color: 'white',
            fontWeight: 'bold' as const,
            borderRadius: '50%',
        }
    }

    // Função para obter a contagem de pedidos de uma data
    function getOrderCount(date: Date): number {
        const dateStr = format(date, 'yyyy-MM-dd')
        return pedidosPorData[dateStr] || 0
    }

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
                        <CardDescription>Clique em uma data para ver os pedidos</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={handleDateSelect}
                            className="rounded-md border"
                            locale={ptBR}
                            modifiers={modifiers}
                            modifiersStyles={modifiersStyles}
                        />
                        <p className="mt-2 text-xs text-muted-foreground text-center">
                            📍 Datas destacadas possuem pedidos
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Popup de Pedidos da Data */}
            <Dialog open={showPopup} onOpenChange={setShowPopup}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" />
                            Pedidos de {date ? format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ''}
                        </DialogTitle>
                        <DialogDescription>
                            {pedidosData.length} pedido(s) encontrado(s) para esta data
                        </DialogDescription>
                    </DialogHeader>

                    {loadingPedidos ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : pedidosData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Package className="h-16 w-16 text-muted-foreground/30" />
                            <p className="mt-4 text-lg font-medium">Nenhum pedido nesta data</p>
                            <p className="text-sm text-muted-foreground">
                                Selecione outra data ou crie um novo pedido
                            </p>
                            <Button asChild className="mt-4">
                                <Link href="/pedidos/novo">Criar Pedido</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pedidosData.map((pedido) => (
                                <div
                                    key={pedido.id}
                                    className="rounded-lg border p-4 space-y-3 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-lg">
                                                {pedido.clientes?.nome}
                                            </h3>
                                            <Badge className={`${statusColors[pedido.status]} mt-1`}>
                                                {statusLabels[pedido.status]}
                                            </Badge>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-primary">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido)}
                                            </p>
                                            {(pedido as any).hora_entrega && (
                                                <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                                                    <Clock className="h-3 w-3" />
                                                    {(pedido as any).hora_entrega}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid gap-2 text-sm">
                                        <div className="flex items-start gap-2">
                                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                            <span className="text-muted-foreground">
                                                {pedido.clientes?.endereco_completo || 'Endereço não informado'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">
                                                {pedido.clientes?.whatsapp || 'Telefone não informado'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <Button asChild size="sm" variant="outline" className="flex-1">
                                            <Link href={`/pedidos/${pedido.id}`}>
                                                <ExternalLink className="h-4 w-4 mr-2" />
                                                Ver Detalhes
                                            </Link>
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="flex-1"
                                            onClick={() => {
                                                const number = pedido.clientes?.whatsapp?.replace(/\D/g, '') || ''
                                                window.open(`https://api.whatsapp.com/send?phone=55${number}`, '_blank')
                                            }}
                                        >
                                            <Phone className="h-4 w-4 mr-2" />
                                            WhatsApp
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

