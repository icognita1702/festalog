'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Calendar, Copy, Loader2, MapPin, PartyPopper, Phone, Share2, Truck } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getCompanyProfile } from '@/lib/company'
import type { Configuracao, ItemPedido, PedidoCompleto, Produto } from '@/lib/database.types'

type ItemPedidoComProduto = ItemPedido & { produtos: Produto | null }

type ResolveResponse = {
  pedido: PedidoCompleto
  configuracao: Configuracao | null
  expiresAt: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function PublicBudgetPage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<ResolveResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      const response = await fetch(`/api/public-access/resolve?token=${encodeURIComponent(token)}&kind=orcamento`)
      const payload = await response.json()

      if (!active) {
        return
      }

      if (!response.ok) {
        setError(payload.error || 'Nao foi possivel abrir o orcamento.')
        setLoading(false)
        return
      }

      setData(payload)
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [token])

  function shareWhatsApp() {
    if (!data) {
      return
    }

    const pedido = data.pedido
    const company = getCompanyProfile(data.configuracao)
    const subtotal =
      pedido.itens_pedido?.reduce((acc, item: ItemPedidoComProduto) => acc + item.quantidade * item.preco_unitario, 0) ||
      0
    const frete = Number(pedido.frete || 0)

    let message = `Orcamento - ${company.nomeEmpresa}\n\n`
    message += `Ola ${pedido.clientes?.nome}!\n\n`
    message += `Itens:\n`
    pedido.itens_pedido?.forEach((item: ItemPedidoComProduto) => {
      message += `- ${item.quantidade}x ${item.produtos?.nome} - ${formatCurrency(item.quantidade * item.preco_unitario)}\n`
    })
    message += `\nSubtotal: ${formatCurrency(subtotal)}`
    message += `\nFrete: ${formatCurrency(frete)}`
    message += `\nTotal: ${formatCurrency(pedido.total_pedido)}`
    message += `\n\nLink completo:\n${window.location.href}`

    const whatsappNumber = pedido.clientes?.whatsapp?.replace(/\D/g, '') || ''
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank')
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-lg font-medium">{error || 'Orcamento nao encontrado.'}</p>
      </div>
    )
  }

  const company = getCompanyProfile(data.configuracao)
  const pedido = data.pedido
  const subtotal =
    pedido.itens_pedido?.reduce((acc, item: ItemPedidoComProduto) => acc + item.quantidade * item.preco_unitario, 0) ||
    0
  const frete = Number(pedido.frete || 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <PartyPopper className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">{company.nomeEmpresa}</span>
          </div>
          <h1 className="text-3xl font-bold">Orcamento</h1>
          <p className="mt-2 text-muted-foreground">Proposta personalizada para {pedido.clientes?.nome}</p>
          <Badge variant="secondary" className="mt-2">
            Valido ate {format(new Date(data.expiresAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados do cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-medium">{pedido.clientes?.nome}</p>
              {pedido.clientes?.whatsapp ? (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {pedido.clientes.whatsapp}
                </p>
              ) : null}
            </div>
            {pedido.clientes?.endereco_completo ? (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4" />
                <span>{pedido.clientes.endereco_completo}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-medium">Data do evento</span>
            </div>
            <Badge variant="outline" className="px-4 py-1 text-lg">
              {format(new Date(pedido.data_evento + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Itens do orcamento</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Preco unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedido.itens_pedido?.map((item: ItemPedidoComProduto) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.produtos?.nome}</TableCell>
                    <TableCell className="text-center">{item.quantidade}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.preco_unitario)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.quantidade * item.preco_unitario)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-6 space-y-2 border-t pt-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  Frete
                </span>
                <span>{formatCurrency(frete)}</span>
              </div>
              <div className="flex justify-between border-t pt-4 text-xl font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(pedido.total_pedido)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="flex-1 gap-2" size="lg" onClick={shareWhatsApp}>
            <Share2 className="h-4 w-4" />
            Enviar via WhatsApp
          </Button>
          <Button variant="outline" className="flex-1 gap-2" size="lg" onClick={copyLink}>
            <Copy className="h-4 w-4" />
            {copied ? 'Link copiado' : 'Copiar link'}
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>{company.nomeEmpresa}</p>
          <p>{company.cidade && company.estado ? `${company.cidade} - ${company.estado}` : company.endereco}</p>
        </div>
      </div>
    </div>
  )
}
