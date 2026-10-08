'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Calendar, CheckCircle, Copy, Loader2, PartyPopper, Phone, Share2, Truck } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { getCompanyProfile } from '@/lib/company'
import { useTenantConfig } from '@/hooks/use-tenant-config'
import type { ItemPedido, PedidoCompleto, Produto } from '@/lib/database.types'
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

type ItemPedidoComProduto = ItemPedido & { produtos: Produto | null }

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function OrcamentoTemplatePage() {
  const params = useParams()
  const pedidoId = params.id as string
  const { config } = useTenantConfig()
  const company = getCompanyProfile(config)

  const [pedido, setPedido] = useState<PedidoCompleto | null>(null)
  const [loading, setLoading] = useState(true)
  const [publicUrl, setPublicUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    async function loadPedido() {
      setLoading(true)
      const { data, error } = await supabase
        .from('pedidos')
        .select('*, clientes(*), itens_pedido(*, produtos(*))')
        .eq('id', pedidoId)
        .single()

      if (error) {
        console.error('Erro ao carregar orcamento:', error)
      } else {
        setPedido(data as PedidoCompleto)
      }
      setLoading(false)
    }

    loadPedido()
  }, [pedidoId])

  async function ensurePublicUrl() {
    if (publicUrl) {
      return publicUrl
    }

    setSharing(true)
    try {
      const response = await fetch('/api/public-access/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pedidoId,
          kind: 'orcamento',
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Nao foi possivel gerar o link publico.')
      }

      setPublicUrl(payload.url)
      return payload.url as string
    } finally {
      setSharing(false)
    }
  }

  async function shareWhatsApp() {
    if (!pedido) {
      return
    }

    const url = await ensurePublicUrl()
    const number = pedido.clientes?.whatsapp?.replace(/\D/g, '') || ''
    const message =
      `Ola ${pedido.clientes?.nome}!\n\n` +
      `Aqui e da *${company.nomeEmpresa}*.\n` +
      `Seu orcamento esta pronto:\n${url}\n\n` +
      `Total: ${formatCurrency(pedido.total_pedido)}`

    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank')
  }

  async function copyLink() {
    const url = await ensurePublicUrl()
    await navigator.clipboard.writeText(url)
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

  if (!pedido) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-lg font-medium">Orcamento nao encontrado.</p>
      </div>
    )
  }

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
          <p className="mt-2 text-muted-foreground">Versao interna com link publico seguro.</p>
          <Badge variant="secondary" className="mt-2">
            Pedido #{pedido.id.slice(0, 8)}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{pedido.clientes?.nome}</p>
            {pedido.clientes?.whatsapp ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {pedido.clientes.whatsapp}
              </p>
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
            <CardTitle>Itens</CardTitle>
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
                    <TableCell>{item.produtos?.nome}</TableCell>
                    <TableCell className="text-center">{item.quantidade}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.preco_unitario)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.quantidade * item.preco_unitario)}</TableCell>
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

        {publicUrl ? (
          <Card>
            <CardHeader>
              <CardTitle>Link publico</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="block overflow-x-auto rounded bg-muted p-3 text-xs">{publicUrl}</code>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="flex-1 gap-2" size="lg" onClick={shareWhatsApp} disabled={sharing}>
            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Enviar via WhatsApp
          </Button>
          <Button variant="outline" className="flex-1 gap-2" size="lg" onClick={copyLink} disabled={sharing}>
            {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Link copiado' : 'Copiar link publico'}
          </Button>
        </div>
      </div>
    </div>
  )
}
