'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
    CreditCard,
    Banknote,
    Wallet,
    AlertTriangle,
    CheckCircle2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

interface Pagamento {
    id: string
    pedido_id: string
    valor: number
    metodo: string
    observacao: string | null
    data_pagamento: string
    created_at: string
}

interface PaymentSectionProps {
    pedidoId: string
    totalPedido: number
    onPaymentChange?: () => void
}

const metodoConfig: Record<string, { label: string; icon: typeof CreditCard }> = {
    pix: { label: 'PIX', icon: Wallet },
    dinheiro: { label: 'Dinheiro', icon: Banknote },
    cartao: { label: 'Cartão', icon: CreditCard },
    transferencia: { label: 'Transferência', icon: CreditCard },
}

export function PaymentSection({ pedidoId, totalPedido, onPaymentChange }: PaymentSectionProps) {
    const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)

    const [formData, setFormData] = useState({
        valor: 0,
        metodo: 'pix',
        observacao: '',
        data_pagamento: format(new Date(), 'yyyy-MM-dd'),
    })

    async function loadPagamentos() {
        setLoading(true)
        try {
            const { data, error } = await (supabase as any)
                .from('pagamentos')
                .select('*')
                .eq('pedido_id', pedidoId)
                .order('data_pagamento', { ascending: false })

            if (error) {
                // Tabela pode não existir ainda
                if (error.code === '42P01') {
                    setPagamentos([])
                    return
                }
                console.error('Erro ao carregar pagamentos:', error)
            }
            setPagamentos(data || [])
        } catch (err) {
            console.error('Erro:', err)
            setPagamentos([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadPagamentos()
    }, [pedidoId])

    const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0)
    const saldoDevedor = totalPedido - totalPago
    const percentualPago = totalPedido > 0 ? (totalPago / totalPedido) * 100 : 0
    const isPagoCompleto = saldoDevedor <= 0.01

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (formData.valor <= 0) {
            alert('Informe um valor válido.')
            return
        }

        setSaving(true)
        try {
            const { error } = await (supabase as any)
                .from('pagamentos')
                .insert({
                    pedido_id: pedidoId,
                    valor: formData.valor,
                    metodo: formData.metodo,
                    observacao: formData.observacao || null,
                    data_pagamento: formData.data_pagamento,
                })

            if (error) throw error

            setDialogOpen(false)
            setFormData({
                valor: 0,
                metodo: 'pix',
                observacao: '',
                data_pagamento: format(new Date(), 'yyyy-MM-dd'),
            })
            loadPagamentos()
            onPaymentChange?.()
        } catch (error: any) {
            console.error('Erro ao registrar pagamento:', error)
            alert(`Erro ao salvar: ${error?.message || 'Tente novamente.'}`)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Excluir este pagamento?')) return

        const { error } = await (supabase as any)
            .from('pagamentos')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Erro ao excluir:', error)
            alert('Erro ao excluir pagamento.')
        } else {
            loadPagamentos()
            onPaymentChange?.()
        }
    }

    // Sugestão de valor: 50% ou saldo restante
    function sugerirValor(tipo: '50%' | 'restante') {
        if (tipo === '50%') {
            setFormData({ ...formData, valor: totalPedido * 0.5 })
        } else {
            setFormData({ ...formData, valor: Math.max(0, saldoDevedor) })
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Pagamentos
                        </CardTitle>
                        <CardDescription>Controle de pagamentos parciais</CardDescription>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" disabled={isPagoCompleto}>
                                <Plus className="mr-2 h-4 w-4" />
                                Registrar
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <form onSubmit={handleSubmit}>
                                <DialogHeader>
                                    <DialogTitle>Registrar Pagamento</DialogTitle>
                                    <DialogDescription>
                                        Saldo devedor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoDevedor)}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
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
                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" size="sm" onClick={() => sugerirValor('50%')}>
                                                Sinal 50%
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" onClick={() => sugerirValor('restante')}>
                                                Restante
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="metodo">Método</Label>
                                            <Select
                                                value={formData.metodo}
                                                onValueChange={(v) => setFormData({ ...formData, metodo: v })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(metodoConfig).map(([key, config]) => (
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
                                            <Label htmlFor="data">Data</Label>
                                            <Input
                                                id="data"
                                                type="date"
                                                value={formData.data_pagamento}
                                                onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="obs">Observação (opcional)</Label>
                                        <Input
                                            id="obs"
                                            value={formData.observacao}
                                            onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                                            placeholder="Ex: Sinal via PIX"
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
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Resumo */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span>Progresso do Pagamento</span>
                        <span className="font-medium">{percentualPago.toFixed(0)}%</span>
                    </div>
                    <Progress value={percentualPago} className="h-2" />
                    <div className="flex justify-between text-sm">
                        <div>
                            <span className="text-muted-foreground">Pago: </span>
                            <span className="font-medium text-green-600">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPago)}
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Restante: </span>
                            <span className={`font-medium ${saldoDevedor > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, saldoDevedor))}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                    {isPagoCompleto ? (
                        <Badge className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Pago Integralmente
                        </Badge>
                    ) : saldoDevedor === totalPedido ? (
                        <Badge variant="secondary">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Aguardando Pagamento
                        </Badge>
                    ) : (
                        <Badge className="bg-yellow-500">
                            <CreditCard className="h-3 w-3 mr-1" />
                            Pagamento Parcial
                        </Badge>
                    )}
                </div>

                {/* Lista de Pagamentos */}
                {loading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : pagamentos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum pagamento registrado
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Método</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pagamentos.map((pag) => {
                                const metodo = metodoConfig[pag.metodo] || metodoConfig.dinheiro
                                const Icon = metodo.icon
                                return (
                                    <TableRow key={pag.id}>
                                        <TableCell>
                                            {format(new Date(pag.data_pagamento + 'T12:00:00'), 'dd/MM/yyyy')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Icon className="h-3 w-3" />
                                                {metodo.label}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-green-600">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pag.valor)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(pag.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}
