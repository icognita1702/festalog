'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, Eraser, FileText, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getCompanyProfile } from '@/lib/company'
import type { Configuracao, PedidoCompleto, Produto, ItemPedido } from '@/lib/database.types'

type ItemPedidoComProduto = ItemPedido & { produtos: Produto | null }

type ResolveResponse = {
  pedido: PedidoCompleto
  configuracao: Configuracao | null
  expiresAt: string
}

export default function PublicContractPage() {
  const params = useParams()
  const token = params.token as string
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [data, setData] = useState<ResolveResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [signed, setSigned] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const response = await fetch(`/api/public-access/resolve?token=${encodeURIComponent(token)}&kind=contrato`)
      const payload = await response.json()

      if (!active) {
        return
      }

      if (!response.ok) {
        setError(payload.error || 'Nao foi possivel abrir o contrato.')
        setLoading(false)
        return
      }

      setData(payload)
      setSigned(payload.pedido.status === 'assinado' || Boolean(payload.pedido.assinatura_url))
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    context.strokeStyle = '#000'
    context.lineWidth = 2
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }, [loading])

  function getCoordinates(event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()

    if (!canvas || !rect) {
      return null
    }

    if ('touches' in event) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top,
      }
    }

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  function startDrawing(event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const context = canvasRef.current?.getContext('2d')
    const coordinates = getCoordinates(event)

    if (!context || !coordinates) {
      return
    }

    setDrawing(true)
    setHasSignature(true)
    context.beginPath()
    context.moveTo(coordinates.x, coordinates.y)
  }

  function draw(event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!drawing) {
      return
    }

    const context = canvasRef.current?.getContext('2d')
    const coordinates = getCoordinates(event)

    if (!context || !coordinates) {
      return
    }

    if ('touches' in event) {
      event.preventDefault()
    }

    context.lineTo(coordinates.x, coordinates.y)
    context.stroke()
  }

  function stopDrawing() {
    setDrawing(false)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (!canvas || !context) {
      return
    }

    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  async function submitSignature() {
    if (!canvasRef.current || !hasSignature) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const signatureDataUrl = canvasRef.current.toDataURL('image/png')
      const response = await fetch('/api/public-access/contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          signatureDataUrl,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Nao foi possivel salvar a assinatura.')
      }

      setSigned(true)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Falha ao assinar o contrato.')
    } finally {
      setSaving(false)
    }
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">{error || 'Contrato nao encontrado.'}</p>
      </div>
    )
  }

  const company = getCompanyProfile(data.configuracao)
  const pedido = data.pedido

  if (signed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-green-50 p-4 text-center dark:bg-green-950">
        <CheckCircle className="h-16 w-16 text-green-500" />
        <h1 className="text-3xl font-bold text-green-700 dark:text-green-300">Contrato assinado</h1>
        <p className="text-muted-foreground">
          Obrigado, {pedido.clientes?.nome}. A equipe de {company.nomeEmpresa} recebeu sua assinatura.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Contrato de locacao</h1>
          <p className="text-muted-foreground">Revise os dados e assine abaixo.</p>
          <Badge variant="outline" className="mt-3">
            Link valido ate {format(new Date(data.expiresAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{company.nomeEmpresa}</CardTitle>
            <CardDescription>{company.endereco || 'Endereco configurado no onboarding.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Documento: {company.documento || 'Nao informado'}</p>
            <p>Telefone: {company.telefone || 'Nao informado'}</p>
            <p>Email: {company.email || 'Nao informado'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados do cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Nome</span>
              <span className="text-right font-medium">{pedido.clientes?.nome}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">CPF</span>
              <span className="text-right font-medium">{pedido.clientes?.cpf || 'Nao informado'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Endereco</span>
              <span className="text-right font-medium">{pedido.clientes?.endereco_completo}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Itens locados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedido.itens_pedido?.map((item: ItemPedidoComProduto) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.produtos?.nome}</TableCell>
                    <TableCell className="text-center">{item.quantidade}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        item.quantidade * item.preco_unitario
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-between border-t pt-4">
              <span className="font-medium">Total</span>
              <span className="text-lg font-bold text-primary">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total_pedido)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Termos principais</CardTitle>
            <CardDescription>Versao resumida dos compromissos da locacao.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. O locatario se compromete a devolver os materiais em bom estado de conservacao.</p>
            <p>2. Danos ou perdas poderao ser cobrados pelo valor de reposicao.</p>
            <p>3. O pagamento parcial e o saldo seguem a politica comercial informada por {company.nomeEmpresa}.</p>
            <p>4. Entrega e recolhimento sao combinados previamente conforme o pedido.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sua assinatura</CardTitle>
            <CardDescription>Desenhe sua assinatura para concluir o aceite do contrato.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border-2 border-dashed p-1">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full touch-none rounded bg-white"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={clearSignature} className="flex-1">
                <Eraser className="mr-2 h-4 w-4" />
                Limpar
              </Button>
              <Button type="button" className="flex-1" disabled={!hasSignature || saving} onClick={submitSignature}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Assinar contrato
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
