'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, FileText, Loader2, MessageCircle, Send, Star, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCompanyProfile } from '@/lib/company'
import { useTenantConfig } from '@/hooks/use-tenant-config'
import type { PedidoComCliente } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmojiText } from '@/components/ui/emoji-text'

type TemplateType = 'orcamento' | 'contrato' | 'cobranca' | 'entrega' | 'avaliacao'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function WhatsAppPage() {
  const { config } = useTenantConfig()
  const company = useMemo(() => getCompanyProfile(config), [config])

  const [pedidos, setPedidos] = useState<PedidoComCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [pedidoSelecionado, setPedidoSelecionado] = useState('')
  const [templateSelecionado, setTemplateSelecionado] = useState<TemplateType | ''>('')
  const [mensagemFinal, setMensagemFinal] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    async function loadPedidos() {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*, clientes(*)')
        .order('data_evento', { ascending: true })

      if (error) {
        console.error('Erro ao carregar pedidos:', error)
      } else {
        setPedidos((data as PedidoComCliente[]) || [])
      }

      setLoading(false)
    }

    loadPedidos()
  }, [])

  const templates = useMemo(
    () =>
      ({
        orcamento: {
          icon: FileText,
          title: 'Confirmar orcamento',
          build: (pedido: PedidoComCliente) =>
            `Ola ${pedido.clientes?.nome}!\n\nAqui e da *${company.nomeEmpresa}*.\n\nSegue o orcamento do seu evento em ${new Date(
              pedido.data_evento + 'T12:00:00'
            ).toLocaleDateString('pt-BR')}.\nTotal: ${formatCurrency(pedido.total_pedido)}.\n\nSe quiser seguir, me avise e eu preparo o contrato.`,
        },
        contrato: {
          icon: FileText,
          title: 'Lembrete de contrato',
          build: (pedido: PedidoComCliente) =>
            `Ola ${pedido.clientes?.nome}!\n\nAqui e da *${company.nomeEmpresa}*.\n\nSeu contrato esta pronto para assinatura.\nData do evento: ${new Date(
              pedido.data_evento + 'T12:00:00'
            ).toLocaleDateString('pt-BR')}\nValor total: ${formatCurrency(pedido.total_pedido)}\nSinal sugerido: ${formatCurrency(
              pedido.total_pedido * 0.5
            )}\n\nSe quiser, eu envio o link agora.`,
        },
        cobranca: {
          icon: MessageCircle,
          title: 'Cobrar sinal',
          build: (pedido: PedidoComCliente) =>
            `Ola ${pedido.clientes?.nome}!\n\nPassando para lembrar o sinal do pedido com a *${company.nomeEmpresa}*.\nValor sugerido: ${formatCurrency(
              pedido.total_pedido * 0.5
            )}\n\n${company.pixTipo ? `PIX ${company.pixTipo}: ${company.pixChave}\n` : ''}${
              company.pixNome ? `Titular: ${company.pixNome}\n` : ''
            }${company.pixBanco ? `Banco: ${company.pixBanco}\n` : ''}\nDepois me envie o comprovante por aqui.`,
        },
        entrega: {
          icon: Truck,
          title: 'Aviso de entrega',
          build: (pedido: PedidoComCliente) =>
            `Ola ${pedido.clientes?.nome}!\n\nAqui e da *${company.nomeEmpresa}*.\nEstamos a caminho da entrega.\nEndereco: ${
              pedido.clientes?.endereco_completo || 'Endereco nao informado'
            }\n\nQualquer duvida, estou por aqui.`,
        },
        avaliacao: {
          icon: Star,
          title: 'Pedir avaliacao',
          build: (pedido: PedidoComCliente) =>
            `Ola ${pedido.clientes?.nome}!\n\nObrigado por escolher a *${company.nomeEmpresa}*.\n${
              company.googleReviewLink
                ? `Se puder, deixe uma avaliacao neste link:\n${company.googleReviewLink}\n\n`
                : ''
            }Seu feedback ajuda muito o nosso trabalho.`,
        },
      }) satisfies Record<TemplateType, { icon: typeof FileText; title: string; build: (pedido: PedidoComCliente) => string }>,
    [company]
  )

  function syncTemplateMessage(nextPedidoId: string, nextTemplate: TemplateType | '') {
    if (!nextPedidoId || !nextTemplate) {
      return setMensagemFinal('')
    }

    const pedido = pedidos.find((current) => current.id === nextPedidoId)
    if (!pedido) {
      return setMensagemFinal('')
    }

    setMensagemFinal(templates[nextTemplate].build(pedido))
  }

  function copiarMensagem() {
    navigator.clipboard.writeText(mensagemFinal)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function enviarWhatsAppWeb() {
    const pedido = pedidos.find((current) => current.id === pedidoSelecionado)
    if (!pedido) {
      return
    }

    const number = pedido.clientes?.whatsapp.replace(/\D/g, '') || ''
    window.open(`https://api.whatsapp.com/send?phone=55${number}&text=${encodeURIComponent(mensagemFinal)}`, '_blank')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-muted-foreground">Mensagens padrao baseadas na configuracao atual do tenant.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Selecione o pedido</CardTitle>
              <CardDescription>Os dados do cliente e do valor entram automaticamente na mensagem.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Select
                  value={pedidoSelecionado}
                  onValueChange={(value) => {
                    setPedidoSelecionado(value)
                    syncTemplateMessage(value, templateSelecionado)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar pedido..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pedidos.map((pedido) => (
                      <SelectItem key={pedido.id} value={pedido.id}>
                        {pedido.clientes?.nome} - {new Date(pedido.data_evento + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Template</CardTitle>
              <CardDescription>Escolha o tipo de mensagem que deseja enviar.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(templates) as Array<[TemplateType, (typeof templates)[TemplateType]]>).map(
                  ([key, template]) => (
                    <Button
                      key={key}
                      variant={templateSelecionado === key ? 'default' : 'outline'}
                      className="h-auto flex-col gap-2 p-4"
                      onClick={() => {
                        setTemplateSelecionado(key)
                        syncTemplateMessage(pedidoSelecionado, key)
                      }}
                    >
                      <template.icon className="h-5 w-5" />
                      <span className="text-xs">{template.title}</span>
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              Mensagem
            </CardTitle>
            <CardDescription>Edite livremente antes de abrir o WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Mensagem</Label>
              <Textarea
                value={mensagemFinal}
                onChange={(event) => setMensagemFinal(event.target.value)}
                rows={12}
                className="font-mono text-sm"
                placeholder="Selecione um pedido e um template..."
              />
            </div>

            {mensagemFinal ? (
              <div className="grid gap-2">
                <Label>Preview</Label>
                <div className="rounded-lg bg-[#e5ded8] p-4 text-sm text-gray-800">
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <EmojiText text={mensagemFinal} />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={copiarMensagem} disabled={!mensagemFinal}>
                {copiado ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copiado ? 'Copiado' : 'Copiar'}
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={enviarWhatsAppWeb}
                disabled={!mensagemFinal || !pedidoSelecionado}
              >
                <Send className="mr-2 h-4 w-4" />
                Enviar ao cliente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
