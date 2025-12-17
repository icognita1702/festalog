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
import { Plus, Pencil, Trash2, Package, Loader2, Tags, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Pagination } from '@/components/ui/pagination'
import type { DisponibilidadeProduto } from '@/lib/database.types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Categoria {
    id: string
    nome: string
    cor: string
}

interface Produto {
    id: string
    nome: string
    quantidade_total: number
    preco_unitario: number
    categoria: string
}

interface ProdutoInsert {
    nome: string
    quantidade_total: number
    preco_unitario: number
    categoria: string
}

// Default colors for new categories
const defaultColors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-cyan-500',
]

export default function ProdutosPage() {
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
    const [editingProduto, setEditingProduto] = useState<Produto | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryColor, setNewCategoryColor] = useState('bg-gray-500')
    const [savingCategory, setSavingCategory] = useState(false)

    // Stock availability state
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeProduto[]>([])
    const [loadingDisp, setLoadingDisp] = useState(false)

    const [formData, setFormData] = useState<ProdutoInsert>({
        nome: '',
        quantidade_total: 0,
        preco_unitario: 0,
        categoria: '',
    })

    async function loadCategorias() {
        const { data, error } = await (supabase as any)
            .from('categorias')
            .select('*')
            .order('nome', { ascending: true })

        if (error) {
            console.error('Erro ao carregar categorias:', error)
        } else {
            setCategorias(data || [])
        }
    }

    async function loadProdutos() {
        setLoading(true)
        const { data, error } = await supabase
            .from('produtos')
            .select('*')
            .order('categoria', { ascending: true })
            .order('nome', { ascending: true })

        if (error) {
            console.error('Erro ao carregar produtos:', error)
        } else {
            setProdutos(data || [])
        }
        setLoading(false)
    }

    async function loadDisponibilidade(dataConsulta: string) {
        setLoadingDisp(true)
        const { data, error } = await supabase
            .rpc('calcular_disponibilidade', { data_consulta: dataConsulta })

        if (error) {
            console.error('Erro ao carregar disponibilidade:', error)
        } else {
            setDisponibilidade(data || [])
        }
        setLoadingDisp(false)
    }

    useEffect(() => {
        loadCategorias()
        loadProdutos()
    }, [])

    useEffect(() => {
        if (selectedDate) {
            loadDisponibilidade(selectedDate)
        }
    }, [selectedDate])

    // Paginate
    const paginatedProdutos = produtos.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    )

    function getCategoriaColor(categoriaNome: string): string {
        const cat = categorias.find(c => c.nome.toLowerCase() === categoriaNome.toLowerCase())
        return cat?.cor || 'bg-gray-500'
    }

    function getDisponibilidadeProduto(produtoId: string) {
        return disponibilidade.find(d => d.produto_id === produtoId)
    }

    function getStockStatus(total: number, reservado: number) {
        const disponivel = total - reservado
        const percentual = total > 0 ? (disponivel / total) * 100 : 0

        if (disponivel <= 0) {
            return { label: 'Esgotado', color: 'bg-red-500', icon: XCircle }
        } else if (percentual <= 20) {
            return { label: 'Baixo', color: 'bg-yellow-500', icon: AlertTriangle }
        }
        return { label: 'OK', color: 'bg-green-500', icon: CheckCircle2 }
    }

    function openDialog(produto?: Produto) {
        if (produto) {
            setEditingProduto(produto)
            setFormData({
                nome: produto.nome,
                quantidade_total: produto.quantidade_total,
                preco_unitario: produto.preco_unitario,
                categoria: produto.categoria,
            })
        } else {
            setEditingProduto(null)
            setFormData({
                nome: '',
                quantidade_total: 0,
                preco_unitario: 0,
                categoria: categorias[0]?.nome || '',
            })
        }
        setDialogOpen(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if (!formData.categoria) {
            alert('Selecione uma categoria para o produto.')
            return
        }

        setSaving(true)

        try {
            if (editingProduto) {
                const { error } = await (supabase as any)
                    .from('produtos')
                    .update(formData)
                    .eq('id', editingProduto.id)

                if (error) throw error
            } else {
                const { error } = await (supabase as any)
                    .from('produtos')
                    .insert(formData)

                if (error) throw error
            }

            setDialogOpen(false)
            loadProdutos()
        } catch (error: any) {
            console.error('Erro ao salvar produto:', error)
            alert(`Erro ao salvar produto: ${error?.message || 'Tente novamente.'}`)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza que deseja excluir este produto?')) return

        const { error } = await supabase
            .from('produtos')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Erro ao excluir produto:', error)
            alert('Erro ao excluir produto. Verifique se não há pedidos vinculados.')
        } else {
            loadProdutos()
        }
    }

    async function handleAddCategory(e: React.FormEvent) {
        e.preventDefault()
        if (!newCategoryName.trim()) return

        setSavingCategory(true)
        try {
            const { error } = await (supabase as any)
                .from('categorias')
                .insert({ nome: newCategoryName.trim(), cor: newCategoryColor })

            if (error) {
                if (error.code === '23505') {
                    alert('Já existe uma categoria com esse nome.')
                } else {
                    throw error
                }
            } else {
                setNewCategoryName('')
                setNewCategoryColor(defaultColors[Math.floor(Math.random() * defaultColors.length)])
                await loadCategorias()
            }
        } catch (error) {
            console.error('Erro ao criar categoria:', error)
            alert('Erro ao criar categoria.')
        } finally {
            setSavingCategory(false)
        }
    }

    async function handleDeleteCategory(id: string, nome: string) {
        // Check if category is in use
        const { data: produtosUsando } = await (supabase as any)
            .from('produtos')
            .select('id')
            .eq('categoria', nome)
            .limit(1)

        if (produtosUsando && produtosUsando.length > 0) {
            alert('Não é possível excluir esta categoria pois há produtos vinculados a ela.')
            return
        }

        if (!confirm(`Tem certeza que deseja excluir a categoria "${nome}"?`)) return

        const { error } = await (supabase as any)
            .from('categorias')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Erro ao excluir categoria:', error)
            alert('Erro ao excluir categoria.')
        } else {
            loadCategorias()
        }
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
                    <p className="text-muted-foreground">
                        Gerencie o estoque de materiais para locação
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* Manage Categories Dialog */}
                    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Tags className="mr-2 h-4 w-4" />
                                Categorias
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Gerenciar Categorias</DialogTitle>
                                <DialogDescription>
                                    Adicione ou remova categorias de produtos
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                {/* Add new category */}
                                <form onSubmit={handleAddCategory} className="flex gap-2">
                                    <Input
                                        placeholder="Nova categoria..."
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        className="flex-1"
                                    />
                                    <Select value={newCategoryColor} onValueChange={setNewCategoryColor}>
                                        <SelectTrigger className="w-[120px]">
                                            <div className="flex items-center gap-2">
                                                <div className={`h-3 w-3 rounded-full ${newCategoryColor}`} />
                                                <span>Cor</span>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent position="popper" sideOffset={5}>
                                            {defaultColors.map((color) => (
                                                <SelectItem key={color} value={color}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`h-3 w-3 rounded-full ${color}`} />
                                                        <span>{color.replace('bg-', '').replace('-500', '')}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button type="submit" disabled={savingCategory || !newCategoryName.trim()}>
                                        {savingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    </Button>
                                </form>

                                {/* List categories */}
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {categorias.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            Nenhuma categoria cadastrada
                                        </p>
                                    ) : (
                                        categorias.map((cat) => (
                                            <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg border">
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-3 w-3 rounded-full ${cat.cor}`} />
                                                    <span>{cat.nome}</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteCategory(cat.id, cat.nome)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Add Product Dialog */}
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => openDialog()}>
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Produto
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <form onSubmit={handleSubmit}>
                                <DialogHeader>
                                    <DialogTitle>
                                        {editingProduto ? 'Editar Produto' : 'Novo Produto'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Preencha os dados do produto abaixo
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="nome">Nome do Produto</Label>
                                        <Input
                                            id="nome"
                                            value={formData.nome}
                                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                            placeholder="Ex: Mesa Redonda 1.20m"
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="categoria">Categoria</Label>
                                        <Select
                                            value={formData.categoria}
                                            onValueChange={(value) =>
                                                setFormData({ ...formData, categoria: value })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione a categoria" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categorias.map((cat) => (
                                                    <SelectItem key={cat.id} value={cat.nome}>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`h-2 w-2 rounded-full ${cat.cor}`} />
                                                            {cat.nome}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="quantidade">Quantidade Total</Label>
                                            <Input
                                                id="quantidade"
                                                type="number"
                                                min="0"
                                                value={formData.quantidade_total}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, quantidade_total: parseInt(e.target.value) || 0 })
                                                }
                                                required
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="preco">Preço Unitário (R$)</Label>
                                            <Input
                                                id="preco"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={formData.preco_unitario}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, preco_unitario: parseFloat(e.target.value) || 0 })
                                                }
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={saving}>
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {editingProduto ? 'Salvar' : 'Cadastrar'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Tabela */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle>Estoque</CardTitle>
                            <CardDescription>
                                {produtos.length} produto{produtos.length !== 1 ? 's' : ''} cadastrado{produtos.length !== 1 ? 's' : ''}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="stock-date" className="text-sm whitespace-nowrap">
                                Ver disponibilidade para:
                            </Label>
                            <Input
                                id="stock-date"
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-[160px]"
                            />
                            {loadingDisp && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : produtos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Package className="h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                Nenhum produto cadastrado ainda
                            </p>
                            <Button className="mt-4" size="sm" onClick={() => openDialog()}>
                                Cadastrar Primeiro Produto
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Categoria</TableHead>
                                        <TableHead className="text-center">Total</TableHead>
                                        <TableHead className="text-center">Reservado</TableHead>
                                        <TableHead className="text-center">Disponível</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                        <TableHead className="text-right">Preço Unit.</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedProdutos.map((produto) => {
                                        const disp = getDisponibilidadeProduto(produto.id)
                                        const reservado = disp ? Number(disp.quantidade_reservada) : 0
                                        const disponivel = disp ? Number(disp.quantidade_disponivel) : produto.quantidade_total
                                        const status = getStockStatus(produto.quantidade_total, reservado)
                                        const StatusIcon = status.icon

                                        return (
                                            <TableRow key={produto.id}>
                                                <TableCell className="font-medium">{produto.nome}</TableCell>
                                                <TableCell>
                                                    <Badge className={getCategoriaColor(produto.categoria)}>
                                                        {produto.categoria}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">{produto.quantidade_total}</TableCell>
                                                <TableCell className="text-center">
                                                    {reservado > 0 ? (
                                                        <span className="font-medium text-orange-600">{reservado}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">0</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className={disponivel <= 0 ? 'text-red-600 font-bold' : disponivel <= produto.quantidade_total * 0.2 ? 'text-yellow-600 font-medium' : 'text-green-600 font-medium'}>
                                                        {disponivel}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={`${status.color} gap-1`}>
                                                        <StatusIcon className="h-3 w-3" />
                                                        {status.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco_unitario)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openDialog(produto)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => handleDelete(produto.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                            <Pagination
                                currentPage={currentPage}
                                totalItems={produtos.length}
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
