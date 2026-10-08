'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Store } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Configuracao, Tenant } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface OnboardingFormProps {
  tenant: Tenant
  configuracao: Configuracao | null
}

type FormState = {
  nome_empresa: string
  telefone: string
  email: string
  endereco: string
  cidade: string
  estado: string
  pix_tipo: string
  pix_chave: string
  pix_nome: string
  pix_banco: string
  whatsapp_proprietario: string
  preco_km: string
  frete_minimo: string
}

function initialState(configuracao: Configuracao | null, tenant: Tenant): FormState {
  return {
    nome_empresa: configuracao?.nome_empresa || tenant.display_name || '',
    telefone: configuracao?.telefone || '',
    email: configuracao?.email || tenant.owner_email || '',
    endereco: configuracao?.endereco || '',
    cidade: configuracao?.cidade || '',
    estado: configuracao?.estado || '',
    pix_tipo: configuracao?.pix_tipo || '',
    pix_chave: configuracao?.pix_chave || '',
    pix_nome: configuracao?.pix_nome || '',
    pix_banco: configuracao?.pix_banco || '',
    whatsapp_proprietario: configuracao?.whatsapp_proprietario || '',
    preco_km: String(configuracao?.preco_km ?? 0),
    frete_minimo: String(configuracao?.frete_minimo ?? 0),
  }
}

export function OnboardingForm({ tenant, configuracao }: OnboardingFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => initialState(configuracao, tenant))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { error: configError } = await supabase.from('configuracoes').upsert(
        {
          tenant_id: tenant.id,
          nome_empresa: form.nome_empresa,
          telefone: form.telefone,
          email: form.email,
          endereco: form.endereco,
          cidade: form.cidade,
          estado: form.estado,
          pix_tipo: form.pix_tipo,
          pix_chave: form.pix_chave,
          pix_nome: form.pix_nome,
          pix_banco: form.pix_banco,
          whatsapp_proprietario: form.whatsapp_proprietario,
          preco_km: Number(form.preco_km || 0),
          frete_minimo: Number(form.frete_minimo || 0),
        },
        {
          onConflict: 'tenant_id',
        }
      )

      if (configError) {
        throw configError
      }

      const { error: tenantError } = await supabase
        .from('tenants')
        .update({
          display_name: form.nome_empresa || tenant.display_name,
          owner_email: form.email || tenant.owner_email,
          onboarding_completed: true,
        })
        .eq('id', tenant.id)

      if (tenantError) {
        throw tenantError
      }

      router.replace('/dashboard')
      router.refresh()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Nao foi possivel concluir o onboarding.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Configure sua locadora
        </CardTitle>
        <CardDescription>
          Estes dados passam a ser a identidade padrao do tenant. Nenhum dado de outro locador sera reutilizado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="nome_empresa">Nome da empresa</Label>
              <Input
                id="nome_empresa"
                value={form.nome_empresa}
                onChange={(event) => updateField('nome_empresa', event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={form.telefone}
                onChange={(event) => updateField('telefone', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail comercial</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="whatsapp_proprietario">WhatsApp do proprietario</Label>
              <Input
                id="whatsapp_proprietario"
                value={form.whatsapp_proprietario}
                onChange={(event) => updateField('whatsapp_proprietario', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="endereco">Endereco base</Label>
            <Input
              id="endereco"
              value={form.endereco}
              onChange={(event) => updateField('endereco', event.target.value)}
              placeholder="Rua, numero, bairro"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={form.cidade}
                onChange={(event) => updateField('cidade', event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="estado">Estado</Label>
              <Input
                id="estado"
                value={form.estado}
                onChange={(event) => updateField('estado', event.target.value)}
                placeholder="UF"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pix_tipo">Tipo de chave PIX</Label>
              <Input
                id="pix_tipo"
                value={form.pix_tipo}
                onChange={(event) => updateField('pix_tipo', event.target.value)}
                placeholder="CPF, CNPJ, telefone..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pix_chave">Chave PIX</Label>
              <Input
                id="pix_chave"
                value={form.pix_chave}
                onChange={(event) => updateField('pix_chave', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pix_nome">Titular do PIX</Label>
              <Input
                id="pix_nome"
                value={form.pix_nome}
                onChange={(event) => updateField('pix_nome', event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pix_banco">Banco</Label>
              <Input
                id="pix_banco"
                value={form.pix_banco}
                onChange={(event) => updateField('pix_banco', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="preco_km">Preco por km</Label>
              <Input
                id="preco_km"
                type="number"
                step="0.01"
                min="0"
                value={form.preco_km}
                onChange={(event) => updateField('preco_km', event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="frete_minimo">Frete minimo</Label>
              <Input
                id="frete_minimo"
                type="number"
                step="0.01"
                min="0"
                value={form.frete_minimo}
                onChange={(event) => updateField('frete_minimo', event.target.value)}
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Finalizar onboarding
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
