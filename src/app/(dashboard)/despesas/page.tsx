'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
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
    Trash2,
    Loader2,
    Fuel,
    Wrench,
    Receipt,
    TrendingDown,
    Calendar,
    DollarSign
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Pagination } from '@/components/ui/pagination'

interface Despesa {
    id: string
    descricao: string
    categoria: string
    valor: number
    data: string
    pedido_id?: string
    created_at: string
}

const categoriaConfig: Record<string, { label: string; icon: typeof Fuel; color: string }> = {
    combustivel: { label: 'Combustível', icon: Fuel, color: 'bg-amber-500' },
    manutencao: { label: 'Manutenção', icon: Wrench, color: 'bg-blue-500' },
    outros: { label: 'Outros', icon: Receipt, color: 'bg-gray-500' },
}

export default function DespesasPage() {
    const [despesas, setDespesas] = useState<Despesa[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    // Filtros
    const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
    const [filterCategoria, setFilterCategoria] = useState<string>('todas')

    // Form
    const [formData, setFormData] = useState({
        descricao: '',
        categoria: 'combustivel',
        valor: 0,
        data: format(new Date(), 'yyyy-MM-dd'),
    })

    async function loadDespesas() {
        setLoading(true)
        try {
            let query = (supabase as any)
                .from('despesas')
                .select('*')
                .gte('data', dateFrom)
                .lte('data', dateTo)
                .order('data', { ascending: false })

            if (filterCategoria !== 'todas') {
                query = query.eq('categoria', filterCategoria)
            }

            const { data, error } = await query as { data: Despesa[] | null; error: any }

            if (error) {
                console.error('Erro ao carregar despesas:', error)
                // Se a tabela não existir, mostrar lista vazia
                if (error.code === '42P01') {
                    setDespesas([])
                    return
                }
            }
            setDespesas(data || [])
        } catch (err) {
            console.error('Erro:', err)
            setDespesas([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadDespesas()
    }, [dateFrom, dateTo, filterCategoria])

    // Estatísticas
    const totalDespesas = despesas.reduce((acc, d) => acc + d.valor, 0)
    const despesasPorCategoria = Object.keys(categoriaConfig).reduce((acc, cat) => {
        acc[cat] = despesas.filter(d => d.categoria === cat).reduce((sum, d) => sum + d.valor, 0)
        return acc
    }, {} as Record<string, number>)

    // Paginação
    const paginatedDespesas = despesas.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    )

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!formData.descricao.trim() || formData.valor <= 0) {
            alert('Preencha todos os campos corretamente.')
            return
        }

        setSaving(true)
        try {
            const { error } = await (supabase as any)
                .from('despesas')
                .insert({
                    descricao: formData.descricao.trim(),
                    categoria: formData.categoria,
                    valor: formData.valor,
                    data: formData.data,
                })

            if (error) throw error

            setDialogOpen(false)
            setFormData({
                descricao: '',
                categoria: 'combustivel',
                valor: 0,
                data: format(new Date(), 'yyyy-MM-dd'),
            })
            loadDespesas()
        } catch (error: any) {
            console.error('Erro ao salvar despesa:', error)
            alert(`Erro ao salvar: ${error?.message || 'Tente novamente.'}`)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Excluir esta despesa?')) return

        const { error } = await (supabase as any)
            .from('despesas')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Erro ao excluir:', error)
            alert('Erro ao excluir despesa.')
        } else {
            loadDespesas()
        }
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <TrendingDown className="h-8 w-8 text-destructive" />
                        Despesas Operacionais
                    </h1>
                    <p className="text-muted-foreground">
                        Controle de gastos com combustível, manutenção e outros custos.
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Nova Despesa
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <form onSubmit={handleSubmit}>
                            <DialogHeader>
                                <DialogTitle>Registrar Despesa</DialogTitle>
                                <DialogDescription>
                                    Adicione um novo gasto operacional.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="descricao">Descrição</Label>
                                    <Input
                                        id="descricao"
                                        value={formData.descricao}
                                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                        placeholder="Ex: Abastecimento Fiorino"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="categoria">Categoria</Label>
                                        <Select
                                            value={formData.categoria}
                                            onValueChange={(v) => setFormData({ ...formData, categoria: v })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(categoriaConfig).map(([key, config]) => (
                                                    <SelectItem key={key} value={key}>
                                                        <div className="flex items-center gap-2">
                                                            <config.icon className="h-4 w-4" />
                                                            {config.label}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="valor">Valor (R$)</Label>
                                        <Input
                                            id="valor"
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={formData.valor}
                                            onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="data">Data</Label>
                                    <Input
                                        id="data"
                                        type="date"
                                        value={formData.data}
                                        onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total do Período</CardTitle>
                        <DollarSign className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
                        </div>
                    </CardContent>
                </Card>
                {Object.entries(categoriaConfig).map(([key, config]) => {
                    const Icon = config.icon
                    return (
                        <Card key={key}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
                                <Icon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(despesasPorCategoria[key] || 0)}
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
                    <div className="grid gap-2 flex-1">
                        <Label>De</Label>
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2 flex-1">
                        <Label>Até</Label>
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2 flex-1">
                        <Label>Categoria</Label>
                        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todas">Todas</SelectItem>
                                {Object.entries(categoriaConfig).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Tabela */}
            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Despesas</CardTitle>
                    <CardDescription>
                        {despesas.length} despesa(s) no período selecionado
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : despesas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Receipt className="h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-2 text-muted-foreground">Nenhuma despesa registrada</p>
                            <Button className="mt-4" size="sm" onClick={() => setDialogOpen(true)}>
                                Registrar Primeira Despesa
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead>Categoria</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedDespesas.map((despesa) => {
                                        const catConfig = categoriaConfig[despesa.categoria] || categoriaConfig.outros
                                        const Icon = catConfig.icon
                                        return (
                                            <TableRow key={despesa.id}>
                                                <TableCell>
                                                    {format(new Date(despesa.data + 'T12:00:00'), 'dd/MM/yyyy')}
                                                </TableCell>
                                                <TableCell className="font-medium">{despesa.descricao}</TableCell>
                                                <TableCell>
                                                    <Badge className={catConfig.color}>
                                                        <Icon className="h-3 w-3 mr-1" />
                                                        {catConfig.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-destructive">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(despesa.valor)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        onClick={() => handleDelete(despesa.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                            <Pagination
                                currentPage={currentPage}
                                totalItems={despesas.length}
                                pageSize={pageSize}
                                onPageChange={setCurrentPage}
                                onPageSizeChange={setPageSize}
                            />
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
