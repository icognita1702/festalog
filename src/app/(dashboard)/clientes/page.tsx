'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AddressAutocomplete } from '@/components/address-autocomplete'
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, Users, Loader2, Phone, MapPin, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Pagination } from '@/components/ui/pagination'
import { ConversationImportDialog } from '@/components/conversation-import-dialog'
import type { Cliente, ClienteInsert } from '@/lib/database.types'
import type { ExtractionResult } from '@/lib/conversation-analyzer'

export default function ClientesPage() {
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const [formData, setFormData] = useState<ClienteInsert>({
        nome: '',
        whatsapp: '',
        endereco_completo: '',
        cpf: '',
    })

    async function loadClientes() {
        setLoading(true)
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .order('nome', { ascending: true })

        if (error) {
            console.error('Erro ao carregar clientes:', error)
        } else {
            setClientes(data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        loadClientes()
    }, [])

    const filteredClientes = clientes.filter(cliente =>
        cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.whatsapp.includes(searchTerm) ||
        (cliente.cpf && cliente.cpf.includes(searchTerm))
    )

    // Paginate
    const paginatedClientes = filteredClientes.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    )

    // Reset page when search changes
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm])

    function openDialog(cliente?: Cliente) {
        if (cliente) {
            setEditingCliente(cliente)
            setFormData({
                nome: cliente.nome,
                whatsapp: cliente.whatsapp,
                endereco_completo: cliente.endereco_completo,
                cpf: cliente.cpf || '',
            })
        } else {
            setEditingCliente(null)
            setFormData({
                nome: '',
                whatsapp: '',
                endereco_completo: '',
                cpf: '',
            })
        }
        setDialogOpen(true)
    }

    function formatWhatsApp(value: string) {
        // Remove tudo que não é número
        const numbers = value.replace(/\D/g, '')
        // Formata como (XX) XXXXX-XXXX
        if (numbers.length <= 2) return numbers
        if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
    }

    function formatCPF(value: string) {
        // Remove tudo que não é número
        const numbers = value.replace(/\D/g, '')
        // Formata como XXX.XXX.XXX-XX
        if (numbers.length <= 3) return numbers
        if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
        if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
        return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)

        try {
            if (editingCliente) {
                const { error } = await supabase
                    .from('clientes')
                    .update(formData)
                    .eq('id', editingCliente.id)

                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('clientes')
                    .insert(formData)

                if (error) throw error
            }

            setDialogOpen(false)
            loadClientes()
        } catch (error) {
            console.error('Erro ao salvar cliente:', error)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza que deseja excluir este cliente?')) return

        const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Erro ao excluir cliente:', error)
            alert('Erro ao excluir cliente. Verifique se não há pedidos vinculados.')
        } else {
            loadClientes()
        }
    }

    function openWhatsApp(whatsapp: string) {
        const number = whatsapp.replace(/\D/g, '')
        window.open(`https://api.whatsapp.com/send?phone=55${number}`, '_blank')
    }

    // Handler para importar cliente a partir de conversa do WhatsApp
    async function handleConversationImport(result: ExtractionResult) {
        if (!result.cliente.nome) {
            alert('Nome do cliente não foi extraído da conversa')
            return
        }

        // Verifica se cliente já existe pelo telefone
        if (result.cliente.telefone) {
            const telefoneNormalizado = result.cliente.telefone.replace(/\D/g, '')
            const { data: existingByPhone } = await supabase
                .from('clientes')
                .select('id, nome')
                .or(`whatsapp.ilike.%${telefoneNormalizado.slice(-9)}%`)
                .single()

            if (existingByPhone) {
                alert(`Cliente já cadastrado: ${existingByPhone.nome}`)
                loadClientes()
                return
            }
        }

        // Verifica pelo nome
        const { data: existingByName } = await supabase
            .from('clientes')
            .select('id, nome')
            .ilike('nome', result.cliente.nome)
            .single()

        if (existingByName) {
            alert(`Cliente já cadastrado: ${existingByName.nome}`)
            loadClientes()
            return
        }

        // Formata telefone para (XX) XXXXX-XXXX
        let whatsappFormatado = result.cliente.telefone || ''
        if (whatsappFormatado) {
            const cleaned = whatsappFormatado.replace(/\D/g, '')
            // Remove código do país se presente
            const local = cleaned.length >= 12 && cleaned.startsWith('55')
                ? cleaned.slice(2)
                : cleaned
            if (local.length === 11) {
                whatsappFormatado = `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
            } else if (local.length === 10) {
                whatsappFormatado = `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
            }
        }

        // Cria o cliente
        setFormData({
            nome: result.cliente.nome,
            whatsapp: whatsappFormatado,
            endereco_completo: result.cliente.endereco || '',
            cpf: '',
        })
        setEditingCliente(null)
        setDialogOpen(true)
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
                    <p className="text-muted-foreground">
                        Gerencie seus clientes e informações de contato
                    </p>
                </div>
                <div className="flex gap-2">
                    <ConversationImportDialog onImport={handleConversationImport} />
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => openDialog()}>
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Cliente
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <form onSubmit={handleSubmit}>
                                <DialogHeader>
                                    <DialogTitle>
                                        {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Preencha os dados do cliente abaixo
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="nome">Nome Completo</Label>
                                        <Input
                                            id="nome"
                                            value={formData.nome}
                                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                            placeholder="Ex: João da Silva"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="whatsapp">WhatsApp</Label>
                                            <Input
                                                id="whatsapp"
                                                value={formData.whatsapp}
                                                onChange={(e) => setFormData({ ...formData, whatsapp: formatWhatsApp(e.target.value) })}
                                                placeholder="(31) 99999-9999"
                                                required
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="cpf">CPF</Label>
                                            <Input
                                                id="cpf"
                                                value={formData.cpf || ''}
                                                onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                                                placeholder="000.000.000-00"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="endereco">Endereço Completo</Label>
                                        <AddressAutocomplete
                                            id="endereco"
                                            value={formData.endereco_completo}
                                            onChange={(value) => setFormData({ ...formData, endereco_completo: value })}
                                            placeholder="Digite o endereço..."
                                            required
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Comece a digitar e selecione uma sugestão
                                        </p>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={saving}>
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {editingCliente ? 'Salvar' : 'Cadastrar'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Busca */}
            <div className="flex gap-4">
                <Input
                    placeholder="Buscar por nome, telefone ou CPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
            </div>

            {/* Tabela */}
            <Card>
                <CardHeader>
                    <CardTitle>Lista de Clientes</CardTitle>
                    <CardDescription>
                        {filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''} encontrado{filteredClientes.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredClientes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Users className="h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
                            </p>
                            {!searchTerm && (
                                <Button className="mt-4" size="sm" onClick={() => openDialog()}>
                                    Cadastrar Primeiro Cliente
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>WhatsApp</TableHead>
                                        <TableHead>CPF</TableHead>
                                        <TableHead>Endereço</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedClientes.map((cliente) => (
                                        <TableRow key={cliente.id}>
                                            <TableCell className="font-medium">{cliente.nome}</TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-auto p-0 text-green-600 hover:text-green-700"
                                                    onClick={() => openWhatsApp(cliente.whatsapp)}
                                                >
                                                    <Phone className="mr-1 h-3 w-3" />
                                                    {cliente.whatsapp}
                                                </Button>
                                            </TableCell>
                                            <TableCell>{cliente.cpf || '-'}</TableCell>
                                            <TableCell className="max-w-[200px] truncate">
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                                    {cliente.endereco_completo}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openDialog(cliente)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => handleDelete(cliente.id)}
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
                                totalItems={filteredClientes.length}
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
