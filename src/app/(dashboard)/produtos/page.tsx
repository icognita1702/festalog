'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress' // Assumindo que existe ou usarei HTML nativo se não
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
    Plus,
    Pencil,
    Trash2,
    Package,
    Loader2,
    Tags,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Search,
    LayoutGrid,
    List,
    ImageIcon
} from 'lucide-react'
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
    const [pageSize, setPageSize] = useState(12) // Grid fit better with 12
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryColor, setNewCategoryColor] = useState('bg-gray-500')
    const [savingCategory, setSavingCategory] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

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

    // Filter and Paginate
    const filteredProdutos = produtos.filter(p =>
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.categoria.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const paginatedProdutos = filteredProdutos.slice(
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
            return { label: 'Esgotado', color: 'text-red-500', barColor: 'bg-red-500', icon: XCircle }
        } else if (percentual <= 20) {
            return { label: 'Baixo', color: 'text-amber-500', barColor: 'bg-amber-500', icon: AlertTriangle }
        }
        return { label: 'Disponível', color: 'text-emerald-500', barColor: 'bg-emerald-500', icon: CheckCircle2 }
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
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Estoque</h1>
                    <p className="text-muted-foreground">
                        Visão visual e controle de disponibilidade.
                    </p>
                </div>
                <div className="flex gap-2">
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
                                <DialogDescription>Adicione ou remova categorias.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
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
                                        <SelectContent>
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
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {categorias.map((cat) => (
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
                                    ))}
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

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
                                    <DialogTitle>{editingProduto ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="nome">Nome</Label>
                                        <Input
                                            id="nome"
                                            value={formData.nome}
                                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="categoria">Categoria</Label>
                                        <Select
                                            value={formData.categoria}
                                            onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>
                                                {categorias.map((cat) => (
                                                    <SelectItem key={cat.id} value={cat.nome}>{cat.nome}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="quantidade">Qtd Total</Label>
                                            <Input
                                                id="quantidade"
                                                type="number"
                                                min="0"
                                                value={formData.quantidade_total}
                                                onChange={(e) => setFormData({ ...formData, quantidade_total: parseInt(e.target.value) || 0 })}
                                                required
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="preco">Preço (R$)</Label>
                                            <Input
                                                id="preco"
                                                type="number"
                                                step="0.01"
                                                value={formData.preco_unitario}
                                                onChange={(e) => setFormData({ ...formData, preco_unitario: parseFloat(e.target.value) || 0 })}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                                    <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filters Bar */}
            <Card className="bg-muted/30 border-none shadow-sm">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar produtos..."
                            className="pl-9 bg-background"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Label htmlFor="stock-date" className="whitespace-nowrap font-medium text-sm">
                            Disponibilidade em:
                        </Label>
                        <Input
                            id="stock-date"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-[160px] bg-background"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Visual Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : filteredProdutos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
                    <Package className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-2 text-lg font-medium text-muted-foreground">Nenhum produto encontrado</p>
                    <Button variant="link" onClick={() => setSearchTerm('')} className="mt-2 text-primary">
                        Limpar busca
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {paginatedProdutos.map((produto) => {
                        const disp = getDisponibilidadeProduto(produto.id)
                        const reservado = disp ? Number(disp.quantidade_reservada) : 0
                        const disponivel = disp ? Number(disp.quantidade_disponivel) : produto.quantidade_total
                        const status = getStockStatus(produto.quantidade_total, reservado)
                        const catColor = getCategoriaColor(produto.categoria)

                        return (
                            <Card key={produto.id} className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-muted-foreground/10">
                                {/* Visual Header / Placeholder Image */}
                                <div className={`aspect-video w-full ${catColor} relative flex items-center justify-center bg-opacity-10 dark:bg-opacity-20`}>
                                    {/* Gradiente subtil overlay */}
                                    <div className={`absolute inset-0 bg-gradient-to-br from-white/10 to-black/5`}></div>
                                    <ImageIcon className="h-10 w-10 text-white/50" />
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => openDialog(produto)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleDelete(produto.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Badge variant="secondary" className="absolute bottom-2 left-2 text-xs font-medium shadow-sm">
                                        {produto.categoria}
                                    </Badge>
                                </div>

                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-lg leading-tight line-clamp-2" title={produto.nome}>
                                            {produto.nome}
                                        </h3>
                                        <span className="font-semibold text-primary whitespace-nowrap">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.preco_unitario)}
                                        </span>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Disponível: <strong>{disponivel}</strong></span>
                                            <span>Total: {produto.quantidade_total}</span>
                                        </div>
                                        {/* Barra de Progresso Visual (Simulada com div por simplicidade e controle de cor) */}
                                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${status.barColor} transition-all duration-500`}
                                                style={{ width: `${(disponivel / produto.quantidade_total) * 100}%` }}
                                            />
                                        </div>
                                        <div className={`flex items-center gap-1.5 text-xs font-medium ${status.color} pt-1`}>
                                            <status.icon className="h-3.5 w-3.5" />
                                            {status.label}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            <Pagination
                currentPage={currentPage}
                totalItems={filteredProdutos.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
            />
        </div>
    )
}
