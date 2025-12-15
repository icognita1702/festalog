'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Users,
    Package,
    FileSpreadsheet,
    CalendarIcon,
    Loader2,
    ArrowUpRight,
    ArrowDownRight,
    ShoppingCart,
    Percent
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { exportToExcel, type PedidoExport, type ClienteExport, type ProdutoExport, type ResumoMensal } from '@/lib/excel-export'
import { cn } from '@/lib/utils'

// Import Recharts
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    Legend
} from 'recharts'

// Constants
const statusLabels: Record<string, string> = {
    orcamento: 'Orçamento',
    contrato_enviado: 'Contrato Enviado',
    assinado: 'Assinado',
    pago_50: 'Pago 50%',
    entregue: 'Entregue',
    recolhido: 'Recolhido',
    finalizado: 'Finalizado',
}

const statusColors: Record<string, string> = {
    orcamento: '#6b7280',
    contrato_enviado: '#3b82f6',
    assinado: '#8b5cf6',
    pago_50: '#eab308',
    entregue: '#f97316',
    recolhido: '#14b8a6',
    finalizado: '#22c55e',
}

const PIE_COLORS = ['#6b7280', '#3b82f6', '#8b5cf6', '#eab308', '#f97316', '#14b8a6', '#22c55e']

// Types
interface FinancialStats {
    faturamentoTotal: number
    ticketMedio: number
    totalPedidos: number
    pedidosFinalizados: number
    clientesUnicos: number
    taxaConversao: number
    faturamentoAnterior: number
    pedidosAnteriores: number
}

interface MonthlyData {
    mes: string
    mesAbrev: string
    faturamento: number
    pedidos: number
}

interface StatusData {
    name: string
    value: number
    color: string
}

interface TopProduto {
    nome: string
    quantidade: number
    receita: number
}

export default function FinanceiroPage() {
    // Date range state
    const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()))
    const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()))

    // Data states
    const [stats, setStats] = useState<FinancialStats>({
        faturamentoTotal: 0,
        ticketMedio: 0,
        totalPedidos: 0,
        pedidosFinalizados: 0,
        clientesUnicos: 0,
        taxaConversao: 0,
        faturamentoAnterior: 0,
        pedidosAnteriores: 0,
    })
    const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
    const [statusData, setStatusData] = useState<StatusData[]>([])
    const [topProdutos, setTopProdutos] = useState<TopProduto[]>([])
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)
    const [mounted, setMounted] = useState(false)

    // Ensure client-side only rendering for charts
    useEffect(() => {
        setMounted(true)
    }, [])

    // Load data function
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const fromStr = format(dateFrom, 'yyyy-MM-dd')
            const toStr = format(dateTo, 'yyyy-MM-dd')

            // Previous period for comparison
            const daysDiff = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24))
            const prevFrom = format(subMonths(dateFrom, 1), 'yyyy-MM-dd')
            const prevTo = format(subMonths(dateTo, 1), 'yyyy-MM-dd')

            // Fetch all orders in period
            const { data: pedidos } = await supabase
                .from('pedidos')
                .select('*, clientes(*)')
                .gte('data_evento', fromStr)
                .lte('data_evento', toStr)

            // Fetch previous period orders for comparison
            const { data: pedidosAnteriores } = await supabase
                .from('pedidos')
                .select('total_pedido')
                .gte('data_evento', prevFrom)
                .lte('data_evento', prevTo)
                .eq('status', 'finalizado')

            // Calculate stats
            const allPedidos = pedidos || []
            const finalizados = allPedidos.filter(p => p.status === 'finalizado')
            const orcamentos = allPedidos.filter(p => p.status === 'orcamento')

            const faturamentoTotal = finalizados.reduce((acc, p) => acc + (p.total_pedido || 0), 0)
            const ticketMedio = finalizados.length > 0 ? faturamentoTotal / finalizados.length : 0
            const clientesUnicos = new Set(allPedidos.map(p => p.cliente_id)).size
            const taxaConversao = orcamentos.length > 0
                ? ((allPedidos.length - orcamentos.length) / allPedidos.length) * 100
                : (allPedidos.length > 0 ? 100 : 0)

            const faturamentoAnterior = (pedidosAnteriores || []).reduce((acc, p) => acc + (p.total_pedido || 0), 0)

            setStats({
                faturamentoTotal,
                ticketMedio,
                totalPedidos: allPedidos.length,
                pedidosFinalizados: finalizados.length,
                clientesUnicos,
                taxaConversao,
                faturamentoAnterior,
                pedidosAnteriores: (pedidosAnteriores || []).length,
            })

            // Status distribution
            const statusCount: Record<string, number> = {}
            allPedidos.forEach(p => {
                statusCount[p.status] = (statusCount[p.status] || 0) + 1
            })
            setStatusData(
                Object.entries(statusCount).map(([status, count]) => ({
                    name: statusLabels[status] || status,
                    value: count,
                    color: statusColors[status] || '#888',
                }))
            )

            // Monthly data (last 12 months)
            const months = eachMonthOfInterval({
                start: subMonths(new Date(), 11),
                end: new Date()
            })

            const { data: allYearPedidos } = await supabase
                .from('pedidos')
                .select('data_evento, total_pedido, status')
                .gte('data_evento', format(months[0], 'yyyy-MM-dd'))
                .eq('status', 'finalizado')

            const monthlyStats: MonthlyData[] = months.map(month => {
                const monthStr = format(month, 'yyyy-MM')
                const monthPedidos = (allYearPedidos || []).filter(p =>
                    p.data_evento.startsWith(monthStr)
                )
                return {
                    mes: format(month, 'MMM/yy', { locale: ptBR }),
                    mesAbrev: format(month, 'MMM', { locale: ptBR }),
                    faturamento: monthPedidos.reduce((acc, p) => acc + (p.total_pedido || 0), 0),
                    pedidos: monthPedidos.length,
                }
            })
            setMonthlyData(monthlyStats)

            // Top products
            const { data: itens } = await supabase
                .from('itens_pedido')
                .select('quantidade, preco_unitario, produto_id, produtos(nome)')

            const produtoStats: Record<string, { quantidade: number; receita: number; nome: string }> = {}
                ; (itens || []).forEach(item => {
                    const id = item.produto_id
                    const nome = (item.produtos as any)?.nome || 'Produto'
                    if (!produtoStats[id]) {
                        produtoStats[id] = { quantidade: 0, receita: 0, nome }
                    }
                    produtoStats[id].quantidade += item.quantidade
                    produtoStats[id].receita += item.quantidade * item.preco_unitario
                })

            const top5 = Object.values(produtoStats)
                .sort((a, b) => b.quantidade - a.quantidade)
                .slice(0, 5)
            setTopProdutos(top5)

        } catch (error) {
            console.error('Erro ao carregar dados:', error)
        } finally {
            setLoading(false)
        }
    }, [dateFrom, dateTo])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Export function
    async function handleExport() {
        setExporting(true)
        try {
            const fromStr = format(dateFrom, 'yyyy-MM-dd')
            const toStr = format(dateTo, 'yyyy-MM-dd')

            // Fetch all data for export
            const { data: pedidos } = await supabase
                .from('pedidos')
                .select('*, clientes(*)')
                .gte('data_evento', fromStr)
                .lte('data_evento', toStr)
                .order('data_evento', { ascending: false })

            const { data: clientes } = await supabase
                .from('clientes')
                .select('*')
                .order('nome')

            const { data: produtos } = await supabase
                .from('produtos')
                .select('*')
                .order('nome')

            // Calculate client stats
            const clientesWithStats = (clientes || []).map(c => {
                const clientePedidos = (pedidos || []).filter(p => p.cliente_id === c.id)
                return {
                    ...c,
                    totalPedidos: clientePedidos.length,
                    totalGasto: clientePedidos.reduce((acc, p) => acc + (p.total_pedido || 0), 0),
                }
            })

            // Resumo mensal
            const resumo: ResumoMensal[] = [{
                mes: format(dateFrom, 'MMMM/yyyy', { locale: ptBR }),
                faturamento: stats.faturamentoTotal,
                qtdPedidos: stats.totalPedidos,
                ticketMedio: stats.ticketMedio,
                clientesNovos: stats.clientesUnicos,
            }]

            exportToExcel(
                resumo,
                (pedidos || []) as PedidoExport[],
                clientesWithStats as ClienteExport[],
                (produtos || []) as ProdutoExport[],
                format(dateFrom, 'MM-yyyy')
            )
        } catch (error) {
            console.error('Erro ao exportar:', error)
        } finally {
            setExporting(false)
        }
    }

    // Calculate growth percentages
    const faturamentoGrowth = stats.faturamentoAnterior > 0
        ? ((stats.faturamentoTotal - stats.faturamentoAnterior) / stats.faturamentoAnterior) * 100
        : 0

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <TrendingUp className="h-8 w-8 text-primary" />
                        Análise Financeira
                    </h1>
                    <p className="text-muted-foreground">
                        Acompanhe o desempenho do seu negócio
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Date From */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(dateFrom, 'dd/MM/yy')}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={dateFrom}
                                onSelect={(d) => d && setDateFrom(d)}
                                locale={ptBR}
                            />
                        </PopoverContent>
                    </Popover>
                    <span className="text-muted-foreground">até</span>
                    {/* Date To */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(dateTo, 'dd/MM/yy')}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={dateTo}
                                onSelect={(d) => d && setDateTo(d)}
                                locale={ptBR}
                            />
                        </PopoverContent>
                    </Popover>
                    {/* Export Button */}
                    <Button onClick={handleExport} disabled={exporting} className="gap-2">
                        {exporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <FileSpreadsheet className="h-4 w-4" />
                        )}
                        Baixar XLS
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    {/* Stats Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.faturamentoTotal)}
                                </div>
                                <p className={cn(
                                    "text-xs flex items-center gap-1",
                                    faturamentoGrowth >= 0 ? "text-green-600" : "text-red-600"
                                )}>
                                    {faturamentoGrowth >= 0 ? (
                                        <ArrowUpRight className="h-3 w-3" />
                                    ) : (
                                        <ArrowDownRight className="h-3 w-3" />
                                    )}
                                    {Math.abs(faturamentoGrowth).toFixed(1)}% vs período anterior
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.ticketMedio)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Por pedido finalizado
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Clientes Únicos</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.clientesUnicos}</div>
                                <p className="text-xs text-muted-foreground">
                                    Atendidos no período
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                                <Percent className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.taxaConversao.toFixed(1)}%</div>
                                <p className="text-xs text-muted-foreground">
                                    Orçamentos convertidos
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Faturamento Mensal */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-primary" />
                                    Faturamento Mensal
                                </CardTitle>
                                <CardDescription>Últimos 12 meses</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    {mounted && <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={monthlyData}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                            <XAxis dataKey="mesAbrev" className="text-xs" />
                                            <YAxis
                                                className="text-xs"
                                                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                                            />
                                            <Tooltip
                                                formatter={(value: number) => [
                                                    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                                                    'Faturamento'
                                                ]}
                                                labelFormatter={(label) => `Mês: ${label}`}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="faturamento"
                                                stroke="hsl(var(--primary))"
                                                strokeWidth={3}
                                                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Status Distribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5 text-primary" />
                                    Status dos Pedidos
                                </CardTitle>
                                <CardDescription>Distribuição atual</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    {mounted && <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={statusData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={2}
                                                dataKey="value"
                                            >
                                                {statusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value: number, name: string) => [value, name]}
                                            />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row 2 */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Pedidos por Mês */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5 text-primary" />
                                    Pedidos por Mês
                                </CardTitle>
                                <CardDescription>Quantidade de pedidos finalizados</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px] w-full">
                                    {mounted && <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={monthlyData}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                            <XAxis dataKey="mesAbrev" className="text-xs" />
                                            <YAxis className="text-xs" />
                                            <Tooltip
                                                formatter={(value: number) => [value, 'Pedidos']}
                                            />
                                            <Bar
                                                dataKey="pedidos"
                                                fill="hsl(var(--primary))"
                                                radius={[4, 4, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Top Produtos */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-primary" />
                                    Top 5 Produtos
                                </CardTitle>
                                <CardDescription>Mais alugados (por quantidade)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {topProdutos.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-8">
                                            Nenhum dado disponível
                                        </p>
                                    ) : (
                                        topProdutos.map((produto, index) => (
                                            <div key={index} className="flex items-center gap-4">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{produto.nome}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {produto.quantidade} unidades • {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.receita)}
                                                    </p>
                                                </div>
                                                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full"
                                                        style={{
                                                            width: `${(produto.quantidade / topProdutos[0].quantidade) * 100}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    )
}
