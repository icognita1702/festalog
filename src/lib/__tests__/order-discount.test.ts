import { describe, expect, it } from 'vitest'
import { calculateDiscountedTotal, noDiscount, type OrderDiscount } from '../order-discount'

const lines = [
  { productId: 'mesa', total: 100 },
  { productId: 'cadeira', total: 50 },
]

describe('calculateDiscountedTotal', () => {
  it('applies an order-wide discount to the full order total, including freight', () => {
    const discount: OrderDiscount = { tipo: 'percentual', valor: 10, escopo: 'pedido', produtoId: null }
    expect(calculateDiscountedTotal(lines, 15, discount)).toBe(148.5)
  })

  it('applies a fixed value to the whole order', () => {
    const discount: OrderDiscount = { tipo: 'valor', valor: 20, escopo: 'pedido', produtoId: null }
    expect(calculateDiscountedTotal(lines, 15, discount)).toBe(145)
  })

  it('sets the final value of the whole order', () => {
    const discount: OrderDiscount = { tipo: 'preco_final', valor: 100, escopo: 'pedido', produtoId: null }
    expect(calculateDiscountedTotal(lines, 15, discount)).toBe(100)
  })

  it('applies a percentage to the selected product only', () => {
    const discount: OrderDiscount = { tipo: 'percentual', valor: 20, escopo: 'produto', produtoId: 'mesa' }
    expect(calculateDiscountedTotal(lines, 15, discount)).toBe(145)
  })

  it('applies a fixed discount to the selected product only', () => {
    const discount: OrderDiscount = { tipo: 'valor', valor: 25, escopo: 'produto', produtoId: 'mesa' }
    expect(calculateDiscountedTotal(lines, 15, discount)).toBe(140)
  })

  it('sets the final value of the selected product scope', () => {
    const discount: OrderDiscount = { tipo: 'preco_final', valor: 20, escopo: 'produto', produtoId: 'cadeira' }
    expect(calculateDiscountedTotal(lines, 15, discount)).toBe(135)
  })

  it('returns the regular total when no discount is active', () => {
    expect(calculateDiscountedTotal(lines, 15, noDiscount)).toBe(165)
  })
})
