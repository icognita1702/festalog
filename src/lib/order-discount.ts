export type DiscountType = 'percentual' | 'valor' | 'preco_final'
export type DiscountScope = 'pedido' | 'produto'

export interface OrderDiscount {
  tipo: DiscountType | null
  valor: number | null
  escopo: DiscountScope | null
  produtoId: string | null
}

export const noDiscount: OrderDiscount = {
  tipo: null,
  valor: null,
  escopo: null,
  produtoId: null,
}

export function calculateDiscountedTotal(
  itemTotals: Array<{ productId: string; total: number }>,
  freight: number,
  discount: OrderDiscount,
): number {
  const itemsTotal = itemTotals.reduce((sum, item) => sum + item.total, 0)
  if (!discount.tipo || !discount.escopo || discount.valor == null) {
    return Number((itemsTotal + freight).toFixed(2))
  }

  const scopeTotal = discount.escopo === 'produto'
    ? itemTotals.filter((item) => item.productId === discount.produtoId).reduce((sum, item) => sum + item.total, 0)
    : itemsTotal + freight
  const reduction = discount.tipo === 'percentual'
    ? scopeTotal * discount.valor / 100
    : discount.tipo === 'valor'
      ? discount.valor
      : scopeTotal - discount.valor

  return Number((itemsTotal + freight - Math.min(scopeTotal, Math.max(0, reduction))).toFixed(2))
}
