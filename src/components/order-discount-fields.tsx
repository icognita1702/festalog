'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { noDiscount, type OrderDiscount, type DiscountScope, type DiscountType } from '@/lib/order-discount'
import { calculateDiscountedTotal } from '@/lib/order-discount'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface OrderDiscountFieldsProps {
  pedidoId: string
  value: OrderDiscount
  onChange: (value: OrderDiscount) => void
}

export function OrderDiscountFields({ pedidoId, value, onChange }: OrderDiscountFieldsProps) {
  const [products, setProducts] = useState<Array<{ id: string; nome: string }>>([])
  const [itemTotals, setItemTotals] = useState<Array<{ productId: string; total: number }>>([])
  const [freight, setFreight] = useState(0)

  useEffect(() => {
    let active = true
    async function loadProducts() {
      const [{ data, error }, pedidoResponse] = await Promise.all([
        (supabase as any)
        .from('itens_pedido')
        .select('produto_id, quantidade, preco_unitario, produtos(id, nome)')
        .eq('pedido_id', pedidoId),
        (supabase as any).from('pedidos').select('frete').eq('id', pedidoId).single(),
      ])
      if (active && !error && !pedidoResponse.error) {
        const uniqueProducts = new Map<string, { id: string; nome: string }>()
        for (const row of data || []) {
          const product = Array.isArray(row.produtos) ? row.produtos[0] : row.produtos
          if (product?.id) uniqueProducts.set(product.id, { id: product.id, nome: product.nome })
        }
        setProducts([...uniqueProducts.values()].sort((a, b) => a.nome.localeCompare(b.nome)))
        setItemTotals((data || []).map((row: { produto_id: string; quantidade: number; preco_unitario: number }) => ({
          productId: row.produto_id,
          total: Number(row.quantidade) * Number(row.preco_unitario),
        })))
        setFreight(Number(pedidoResponse.data?.frete || 0))
      }
    }
    loadProducts()
    return () => { active = false }
  }, [pedidoId])

  function change(patch: Partial<OrderDiscount>) {
    onChange({ ...value, ...patch })
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
  const previewTotal = calculateDiscountedTotal(itemTotals, freight, value)

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid gap-2">
        <Label>Desconto</Label>
        <Select
          value={value.tipo || 'nenhum'}
          onValueChange={(raw) => {
            if (raw === 'nenhum') onChange(noDiscount)
            else change({ tipo: raw as DiscountType, escopo: value.escopo || 'pedido', valor: value.valor ?? 0 })
          }}
        >
          <SelectTrigger><SelectValue placeholder="Sem desconto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhum">Sem desconto</SelectItem>
            <SelectItem value="percentual">Porcentagem (%)</SelectItem>
            <SelectItem value="valor">Valor fixo (R$)</SelectItem>
            <SelectItem value="preco_final">Definir preço final</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.tipo && <>
        <div className="grid gap-2">
          <Label>Aplicar em</Label>
          <Select
            value={value.escopo || 'pedido'}
            onValueChange={(raw) => change({ escopo: raw as DiscountScope, produtoId: raw === 'pedido' ? null : value.produtoId })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pedido">Pedido inteiro</SelectItem>
              <SelectItem value="produto">Um produto do pedido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {value.escopo === 'produto' && <div className="grid gap-2">
          <Label>Produto</Label>
          <Select value={value.produtoId || ''} onValueChange={(produtoId) => change({ produtoId })}>
            <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
            <SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>}
        <div className="grid gap-2">
          <Label htmlFor={`discount-${pedidoId}`}>
            {value.tipo === 'percentual' ? 'Desconto (%)' : value.tipo === 'valor' ? 'Desconto (R$)' : 'Preço final (R$)'}
          </Label>
          <Input
            id={`discount-${pedidoId}`}
            type="number"
            min="0"
            step={value.tipo === 'percentual' ? '0.1' : '0.01'}
            max={value.tipo === 'percentual' ? '100' : undefined}
            value={value.valor ?? ''}
            onChange={(event) => change({ valor: event.target.value === '' ? null : Number(event.target.value) })}
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Total após o desconto: <strong className="text-foreground">{formatCurrency(previewTotal)}</strong>
        </p>
      </>}
    </div>
  )
}
