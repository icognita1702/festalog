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
import { Plus, Pencil, Trash2, Package, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Pagination } from '@/components/ui/pagination'
import type { Produto, ProdutoInsert, CategoriaProduto } from '@/lib/database.types'

const categorias: { value: CategoriaProduto; label: string }[] = [
    { value: 'mesas', label: 'Mesas' },
    { value: 'cadeiras', label: 'Cadeiras' },
    { value: 'toalhas', label: 'Toalhas' },
    { value: 'caixa_termica', label: 'Caixa Térmica' },
    { value: 'outros', label: 'Outros' },
]

const categoriaColors: Record<CategoriaProduto, string> = {
    mesas: 'bg-blue-500',
    cadeiras: 'bg-green-500',
    toalhas: 'bg-purple-500',
    caixa_termica: 'bg-orange-500',
    outros: 'bg-gray-500',
}

export default function ProdutosPage() {
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingProduto, setEditingProduto] = useState<Produto | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const [formData, setFormData] = useState<ProdutoInsert>({
        nome: '',
        quantidade_total: 0,
        preco_unitario: 0,
        categoria: 'outros',
    })

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

    useEffect(() => {
        loadProdutos()
    }, [])

    // Paginate
    const paginatedProdutos = produtos.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    )

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
                categoria: 'outros',
            })
        }
        setDialogOpen(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)

        try {
            if (editingProduto) {
                const { error } = await supabase
                    .from('produtos')
                    .update(formData)
                    .eq('id', editingProduto.id)

                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('produtos')
                    .insert(formData)

                if (error) throw error
            }

            setDialogOpen(false)
            loadProdutos()
        } catch (error) {
            console.error('Erro ao salvar produto:', error)
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
                                        onValueChange={(value: CategoriaProduto) =>
                                            setFormData({ ...formData, categoria: value })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione a categoria" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categorias.map((cat) => (
                                                <SelectItem key={cat.value} value={cat.value}>
                                                    {cat.label}
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

            {/* Tabela */}
            <Card>
                <CardHeader>
                    <CardTitle>Estoque</CardTitle>
                    <CardDescription>
                        {produtos.length} produto{produtos.length !== 1 ? 's' : ''} cadastrado{produtos.length !== 1 ? 's' : ''}
                    </CardDescription>
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
                                        <TableHead className="text-center">Quantidade</TableHead>
                                        <TableHead className="text-right">Preço Unit.</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedProdutos.map((produto) => (
                                        <TableRow key={produto.id}>
                                            <TableCell className="font-medium">{produto.nome}</TableCell>
                                            <TableCell>
                                                <Badge className={categoriaColors[produto.categoria]}>
                                                    {categorias.find(c => c.value === produto.categoria)?.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">{produto.quantidade_total}</TableCell>
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
                                    ))}
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
