'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Building2,
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  MapPin,
  Monitor,
  Moon,
  Palette,
  Save,
  Star,
  Sun,
  Truck,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ConfiguracaoUpdate } from '@/lib/database.types'
import { buildGoogleReviewLink } from '@/lib/company'
import { useTenantConfig } from '@/hooks/use-tenant-config'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const EMPTY_CONFIG: ConfiguracaoUpdate = {
  nome_empresa: '',
  cnpj: '',
  endereco: '',
  telefone: '',
  email: '',
  pix_tipo: '',
  pix_chave: '',
  pix_nome: '',
  pix_banco: '',
  google_place_id: '',
  whatsapp_proprietario: '',
  preco_km: 0,
  frete_minimo: 0,
  cidade: '',
  estado: '',
}

export default function ConfiguracoesPage() {
  const { config, loading, setConfig } = useTenantConfig()
  const [draft, setDraft] = useState<ConfiguracaoUpdate>(EMPTY_CONFIG)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (config) {
      setDraft({
        nome_empresa: config.nome_empresa || '',
        cnpj: config.cnpj || '',
        endereco: config.endereco || '',
        telefone: config.telefone || '',
        email: config.email || '',
        pix_tipo: config.pix_tipo || '',
        pix_chave: config.pix_chave || '',
        pix_nome: config.pix_nome || '',
        pix_banco: config.pix_banco || '',
        google_place_id: config.google_place_id || '',
        whatsapp_proprietario: config.whatsapp_proprietario || '',
        preco_km: Number(config.preco_km ?? 0),
        frete_minimo: Number(config.frete_minimo ?? 0),
        cidade: config.cidade || '',
        estado: config.estado || '',
      })
    }
  }, [config])

  function updateField<Key extends keyof ConfiguracaoUpdate>(key: Key, value: ConfiguracaoUpdate[Key]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function saveConfig() {
    setSaving(true)

    try {
      const payload: ConfiguracaoUpdate = {
        ...draft,
        preco_km: Number(draft.preco_km ?? 0),
        frete_minimo: Number(draft.frete_minimo ?? 0),
      }

      let query
      const targetId = config?.id

      if (targetId) {
        query = supabase.from('configuracoes').update(payload).eq('id', targetId)
      } else {
        const { data: existing } = await supabase.from('configuracoes').select('id').limit(1).maybeSingle()
        if (existing?.id) {
          query = supabase.from('configuracoes').update(payload).eq('id', existing.id)
        } else {
          query = supabase.from('configuracoes').insert(payload)
        }
      }

      const { data, error } = await query.select().single()

      if (error) {
        throw error
      }

      setConfig(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error: any) {
      console.error('Erro ao salvar configuracoes:', error)
      const errorMsg = error?.message
        ? `Não foi possível salvar as configurações: ${error.message}`
        : 'Não foi possível salvar as configurações.'
      alert(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const googleReviewLink = buildGoogleReviewLink(draft.google_place_id || '')

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuracoes</h1>
          <p className="text-muted-foreground">Gerencie a identidade e as regras comerciais do seu tenant.</p>
        </div>
        <Button onClick={saveConfig} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saved ? 'Salvo' : 'Salvar'}
        </Button>
      </div>

      <Tabs defaultValue="empresa" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="empresa" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="pagamento" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamento
          </TabsTrigger>
          <TabsTrigger value="entregas" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Entregas
          </TabsTrigger>
          <TabsTrigger value="google" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Google
          </TabsTrigger>
          <TabsTrigger value="aparencia" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Aparencia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
          <Card>
            <CardHeader>
              <CardTitle>Dados da empresa</CardTitle>
              <CardDescription>Esses dados alimentam contratos, mensagens e documentos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="nome_empresa">Nome da empresa</Label>
                  <Input
                    id="nome_empresa"
                    value={draft.nome_empresa || ''}
                    onChange={(event) => updateField('nome_empresa', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cnpj">Documento</Label>
                  <Input id="cnpj" value={draft.cnpj || ''} onChange={(event) => updateField('cnpj', event.target.value)} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="endereco">Endereco base</Label>
                <Input
                  id="endereco"
                  value={draft.endereco || ''}
                  onChange={(event) => updateField('endereco', event.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={draft.cidade || ''}
                    onChange={(event) => updateField('cidade', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Input
                    id="estado"
                    value={draft.estado || ''}
                    onChange={(event) => updateField('estado', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={draft.telefone || ''}
                    onChange={(event) => updateField('telefone', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={draft.email || ''}
                    onChange={(event) => updateField('email', event.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamento">
          <Card>
            <CardHeader>
              <CardTitle>PIX</CardTitle>
              <CardDescription>Esses dados substituem qualquer valor que antes ficava hardcoded.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="pix_tipo">Tipo da chave</Label>
                  <Input
                    id="pix_tipo"
                    value={draft.pix_tipo || ''}
                    onChange={(event) => updateField('pix_tipo', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pix_chave">Chave PIX</Label>
                  <Input
                    id="pix_chave"
                    value={draft.pix_chave || ''}
                    onChange={(event) => updateField('pix_chave', event.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="pix_nome">Titular</Label>
                  <Input
                    id="pix_nome"
                    value={draft.pix_nome || ''}
                    onChange={(event) => updateField('pix_nome', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pix_banco">Banco</Label>
                  <Input
                    id="pix_banco"
                    value={draft.pix_banco || ''}
                    onChange={(event) => updateField('pix_banco', event.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entregas">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Regras de frete
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="preco_km">Preco por km</Label>
                  <Input
                    id="preco_km"
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.preco_km ?? 0}
                    onChange={(event) => updateField('preco_km', Number(event.target.value))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="frete_minimo">Frete minimo</Label>
                  <Input
                    id="frete_minimo"
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.frete_minimo ?? 0}
                    onChange={(event) => updateField('frete_minimo', Number(event.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  WhatsApp de rotas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <Label htmlFor="whatsapp_proprietario">Numero de recebimento das rotas</Label>
                  <Input
                    id="whatsapp_proprietario"
                    value={draft.whatsapp_proprietario || ''}
                    onChange={(event) => updateField('whatsapp_proprietario', event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="google">
          <Card>
            <CardHeader>
              <CardTitle>Google Meu Negocio</CardTitle>
              <CardDescription>Opcional. Se vazio, o sistema nao mostra link de avaliacao.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="google_place_id">Place ID</Label>
                <Input
                  id="google_place_id"
                  value={draft.google_place_id || ''}
                  onChange={(event) => updateField('google_place_id', event.target.value)}
                />
              </div>

              {googleReviewLink ? (
                <div className="rounded-lg bg-muted p-4">
                  <p className="mb-2 text-sm font-medium">Link gerado</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 overflow-x-auto rounded bg-background p-2 text-xs">{googleReviewLink}</code>
                    <Button variant="outline" size="sm" onClick={() => window.open(googleReviewLink, '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aparencia">
          <Card>
            <CardHeader>
              <CardTitle>Tema</CardTitle>
              <CardDescription>Escolha o modo claro, escuro ou automatico.</CardDescription>
            </CardHeader>
            <CardContent>
              {mounted ? (
                <div className="grid max-w-md grid-cols-3 gap-4">
                  {[
                    { value: 'light', icon: Sun, label: 'Claro' },
                    { value: 'dark', icon: Moon, label: 'Escuro' },
                    { value: 'system', icon: Monitor, label: 'Sistema' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      className={`rounded-lg border-2 p-4 transition-all ${
                        theme === option.value
                          ? 'border-primary bg-primary/10'
                          : 'border-muted hover:border-primary/50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <option.icon className="h-8 w-8" />
                        <span className="text-sm font-medium">{option.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
