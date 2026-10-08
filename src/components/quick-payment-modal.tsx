'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard,
  Banknote,
  Wallet,
  ArrowRightLeft,
  Loader2,
  CheckCircle2,
  Calendar,
  User,
  Check,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { StatusPedido } from '@/lib/database.types'

export interface QuickPaymentPedido {
  id: string
  total_pedido: number
  status: StatusPedido
  clientes?: {
    nome: string
    whatsapp?: string | null
  } | null
  data_evento?: string
  valor_pago?: number | null
}

interface QuickPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedido: QuickPaymentPedido | null
  valorPagoAtual: number
  valorSugeridoInicial?: number
  observacaoInicial?: string
  onSuccess?: () => void
}

const paymentMethods = [
  { id: 'pix', label: 'PIX', icon: Wallet, color: 'text-teal-600 dark:text-teal-400' },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'cartao', label: 'Cartão', icon: CreditCard, color: 'text-blue-600 dark:text-blue-400' },
  { id: 'transferencia', label: 'Transferência', icon: ArrowRightLeft, color: 'text-purple-600 dark:text-purple-400' },
]

export function QuickPaymentModal({
  open,
  onOpenChange,
  pedido,
  valorPagoAtual,
  valorSugeridoInicial,
  observacaoInicial,
  onSuccess,
}: QuickPaymentModalProps) {
  const [valor, setValor] = useState<string>('')
  const [metodo, setMetodo] = useState<string>('pix')
  const [observacao, setObservacao] = useState<string>('')
  const [dataPagamento, setDataPagamento] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [successAnimation, setSuccessAnimation] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const totalPedido = Number(pedido?.total_pedido || 0)
  const saldoDevedor = Math.max(0, totalPedido - valorPagoAtual)
  const metadeTotal = Number((totalPedido * 0.5).toFixed(2))

  useEffect(() => {
    if (open && pedido) {
      setSuccessAnimation(false)
      setMetodo('pix')
      setDataPagamento(format(new Date(), 'yyyy-MM-dd'))
      setObservacao(observacaoInicial || '')

      let initialValue = saldoDevedor
      if (valorSugeridoInicial !== undefined && valorSugeridoInicial > 0) {
        initialValue = valorSugeridoInicial
      }

      setValor(initialValue > 0 ? initialValue.toFixed(2) : '')

      // Focus on amount input for immediate typing
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 150)
    }
  }, [open, pedido, valorPagoAtual, valorSugeridoInicial, observacaoInicial, saldoDevedor])

  function formatCurrency(val: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  function handleSetAmount(amount: number) {
    const safeAmount = Math.max(0, amount)
    setValor(safeAmount.toFixed(2))
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pedido) return

    const numValor = parseFloat(valor.replace(',', '.'))
    if (isNaN(numValor) || numValor <= 0) {
      alert('Informe um valor de pagamento válido.')
      return
    }

    setSaving(true)
    try {
      // 1. Insert into pagamentos table
      const { error: insertError } = await (supabase as any).from('pagamentos').insert({
        pedido_id: pedido.id,
        valor: numValor,
        metodo: metodo,
        observacao: observacao.trim() || null,
        data_pagamento: dataPagamento,
      })

      if (insertError) throw insertError

      // 2. Keep pedidos.valor_pago in sync
      const novoTotalPago = Number((valorPagoAtual + numValor).toFixed(2))
      await supabase
        .from('pedidos')
        .update({ valor_pago: novoTotalPago })
        .eq('id', pedido.id)

      // 3. Feedback animation and auto-close
      setSuccessAnimation(true)
      setTimeout(() => {
        onOpenChange(false)
        onSuccess?.()
      }, 600)
    } catch (err: any) {
      console.error('Erro ao registrar pagamento:', err)
      alert(`Não foi possível registrar o pagamento: ${err?.message || 'Tente novamente.'}`)
    } finally {
      setSaving(false)
    }
  }

  if (!pedido) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-2 shadow-2xl">
        {/* POS Header / Frente de Caixa */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold opacity-90 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                Frente de Caixa Rápida
              </span>
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-0">
                {pedido.clientes?.nome || 'Cliente'}
              </Badge>
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-white mt-1">
              Registrar Pagamento
            </DialogTitle>
            <DialogDescription className="text-emerald-100 text-xs flex items-center gap-3 mt-1">
              {pedido.data_evento && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Evento: {format(new Date(pedido.data_evento + 'T12:00:00'), 'dd/MM/yyyy')}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                Total: {formatCurrency(totalPedido)}
              </span>
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Display do Caixa: Total, Já Pago e Saldo Devedor */}
        <div className="bg-muted/40 border-b px-6 py-3 grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-background/80 border">
            <span className="text-[11px] text-muted-foreground block">Total Pedido</span>
            <span className="text-xs sm:text-sm font-semibold">{formatCurrency(totalPedido)}</span>
          </div>
          <div className="p-2 rounded-lg bg-background/80 border">
            <span className="text-[11px] text-muted-foreground block">Já Pago</span>
            <span className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(valorPagoAtual)}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-background/80 border border-emerald-500/30">
            <span className="text-[11px] text-muted-foreground block">Restante</span>
            <span className={`text-xs sm:text-sm font-bold ${saldoDevedor > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {formatCurrency(saldoDevedor)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Valor Input + Atalhos Rápidos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="quick-valor" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Valor do Pagamento (R$)
              </Label>
              <div className="flex gap-1.5">
                {metadeTotal > 0 && metadeTotal <= totalPedido && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5 hover:border-emerald-500 hover:text-emerald-600"
                    onClick={() => handleSetAmount(metadeTotal)}
                  >
                    Sinal 50% ({formatCurrency(metadeTotal)})
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5 font-medium border-emerald-500/40 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  onClick={() => handleSetAmount(saldoDevedor)}
                >
                  Quitar Total ({formatCurrency(saldoDevedor)})
                </Button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-lg">
                R$
              </span>
              <Input
                id="quick-valor"
                ref={inputRef}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="pl-12 text-2xl font-bold h-14 bg-background tracking-tight focus-visible:ring-emerald-500"
                required
              />
            </div>
          </div>

          {/* Seleção Rápida de Método (1 clique sem dropdown) */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Forma de Pagamento
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {paymentMethods.map((m) => {
                const Icon = m.icon
                const isSelected = metodo === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetodo(m.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 shadow-sm ring-2 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-100 dark:border-emerald-400'
                        : 'border-border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mb-1.5 ${isSelected ? m.color : 'text-muted-foreground'}`} />
                    <span>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Data e Observação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="quick-data" className="text-xs text-muted-foreground">
                Data do Recebimento
              </Label>
              <Input
                id="quick-data"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quick-obs" className="text-xs text-muted-foreground">
                Observação (opcional)
              </Label>
              <Input
                id="quick-obs"
                placeholder="Ex: Sinal PIX, Dinheiro na entrega"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-muted-foreground"
            >
              Cancelar (Esc)
            </Button>

            <Button
              type="submit"
              disabled={saving || !valor || parseFloat(valor) <= 0}
              className="min-w-[170px] h-11 font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : successAnimation ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Registrado!
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirmar (Enter)
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
