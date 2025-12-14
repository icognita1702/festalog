'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Building2,
    CreditCard,
    Truck,
    MapPin,
    Save,
    Loader2,
    Check,
    ExternalLink,
    Star
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Configuracoes {
    id?: string
    nome_empresa: string
    cnpj: string
    endereco: string
    telefone: string
    email: string
    pix_tipo: string
    pix_chave: string
    pix_nome: string
    pix_banco: string
    google_place_id: string
    whatsapp_proprietario: string
    preco_km: number
    frete_minimo: number
}

const configPadrao: Configuracoes = {
    nome_empresa: 'Lu Festas',
    cnpj: '46.446.131/0001-06',
    endereco: 'Rua Ariramba, 121 - Alípio de Melo, Belo Horizonte - MG',
    telefone: '(31) 98229-0789',
    email: 'contato@lufestas.com.br',
    pix_tipo: 'CNPJ',
    pix_chave: '46.446.131/0001-06',
    pix_nome: 'GABRIEL LUCAS',
    pix_banco: 'CORA SCD',
    google_place_id: 'ChIJxyFz3xGXpgAR8jNtT0lyZTE',
    whatsapp_proprietario: '5531982290789',
    preco_km: 2.00,
    frete_minimo: 15.00
}

export default function ConfiguracoesPage() {
    const [config, setConfig] = useState<Configuracoes>(configPadrao)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        loadConfig()
    }, [])

    async function loadConfig() {
        try {
            const { data, error } = await (supabase as any)
                .from('configuracoes')
                .select('*')
                .single()

            if (data) {
                setConfig(data)
            }
        } catch (error) {
            console.log('Usando configurações padrão')
        }
        setLoading(false)
    }

    async function saveConfig() {
        setSaving(true)
        try {
            const { data: existing } = await (supabase as any)
                .from('configuracoes')
                .select('id')
                .single()

            if (existing?.id) {
                await (supabase as any)
                    .from('configuracoes')
                    .update(config)
                    .eq('id', existing.id)
            } else {
                await (supabase as any)
                    .from('configuracoes')
                    .insert(config)
            }

            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (error) {
            console.error('Erro ao salvar:', error)
            alert('Erro ao salvar configurações')
        }
        setSaving(false)
    }

    function updateConfig(field: keyof Configuracoes, value: string | number) {
        setConfig(prev => ({ ...prev, [field]: value }))
    }

    const googleReviewLink = `https://search.google.com/local/writereview?placeid=${config.google_place_id}`

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
                    <p className="text-muted-foreground">
                        Gerencie as informações da sua empresa
                    </p>
                </div>
                <Button onClick={saveConfig} disabled={saving}>
                    {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : saved ? (
                        <Check className="mr-2 h-4 w-4" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {saved ? 'Salvo!' : 'Salvar'}
                </Button>
            </div>

            <Tabs defaultValue="empresa" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
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
                </TabsList>

                {/* Empresa */}
                <TabsContent value="empresa">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dados da Empresa</CardTitle>
                            <CardDescription>
                                Informações que aparecem nos contratos e documentos
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="nome_empresa">Nome da Empresa</Label>
                                    <Input
                                        id="nome_empresa"
                                        value={config.nome_empresa}
                                        onChange={(e) => updateConfig('nome_empresa', e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="cnpj">CNPJ</Label>
                                    <Input
                                        id="cnpj"
                                        value={config.cnpj}
                                        onChange={(e) => updateConfig('cnpj', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="endereco">Endereço Completo</Label>
                                <Input
                                    id="endereco"
                                    value={config.endereco}
                                    onChange={(e) => updateConfig('endereco', e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Este endereço é usado como origem para o cálculo de frete
                                </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="telefone">Telefone/WhatsApp</Label>
                                    <Input
                                        id="telefone"
                                        value={config.telefone}
                                        onChange={(e) => updateConfig('telefone', e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">E-mail</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={config.email}
                                        onChange={(e) => updateConfig('email', e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Pagamento */}
                <TabsContent value="pagamento">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dados do PIX</CardTitle>
                            <CardDescription>
                                Informações para recebimento de pagamentos
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="pix_tipo">Tipo de Chave</Label>
                                    <Input
                                        id="pix_tipo"
                                        value={config.pix_tipo}
                                        onChange={(e) => updateConfig('pix_tipo', e.target.value)}
                                        placeholder="CNPJ, CPF, E-mail, Telefone..."
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="pix_chave">Chave PIX</Label>
                                    <Input
                                        id="pix_chave"
                                        value={config.pix_chave}
                                        onChange={(e) => updateConfig('pix_chave', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="pix_nome">Nome do Titular</Label>
                                    <Input
                                        id="pix_nome"
                                        value={config.pix_nome}
                                        onChange={(e) => updateConfig('pix_nome', e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="pix_banco">Banco</Label>
                                    <Input
                                        id="pix_banco"
                                        value={config.pix_banco}
                                        onChange={(e) => updateConfig('pix_banco', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="rounded-lg bg-muted p-4 mt-4">
                                <p className="text-sm font-medium mb-2">Preview da mensagem:</p>
                                <div className="text-sm text-muted-foreground space-y-1">
                                    <p>🏦 *Dados para pagamento:*</p>
                                    <p>Chave PIX {config.pix_tipo}: {config.pix_chave}</p>
                                    <p>Nome: {config.pix_nome}</p>
                                    <p>Banco: {config.pix_banco}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Entregas (formerly Integrações) */}
                <TabsContent value="entregas">
                    <div className="space-y-6">
                        {/* Cálculo de Frete */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5" />
                                    Cálculo de Frete
                                </CardTitle>
                                <CardDescription>
                                    Configure os valores utilizados no cálculo automático de frete
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="preco_km">Preço por KM (R$)</Label>
                                        <Input
                                            id="preco_km"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={config.preco_km}
                                            onChange={(e) => updateConfig('preco_km', parseFloat(e.target.value) || 0)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Valor cobrado por quilômetro rodado
                                        </p>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="frete_minimo">Frete Mínimo (R$)</Label>
                                        <Input
                                            id="frete_minimo"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={config.frete_minimo}
                                            onChange={(e) => updateConfig('frete_minimo', parseFloat(e.target.value) || 0)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Valor mínimo cobrado para qualquer entrega
                                        </p>
                                    </div>
                                </div>

                                {/* Preview */}
                                <div className="rounded-lg bg-muted p-4">
                                    <p className="text-sm font-medium mb-2">Exemplo de cálculo:</p>
                                    <div className="text-sm text-muted-foreground space-y-1">
                                        <p>• Distância: 10 km → Frete: R$ {Math.max(10 * config.preco_km, config.frete_minimo).toFixed(2)}</p>
                                        <p>• Distância: 3 km → Frete: R$ {Math.max(3 * config.preco_km, config.frete_minimo).toFixed(2)}</p>
                                        <p>• Distância: 20 km → Frete: R$ {Math.max(20 * config.preco_km, config.frete_minimo).toFixed(2)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* WhatsApp para Rotas */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Truck className="h-5 w-5" />
                                    Rotas de Entrega
                                </CardTitle>
                                <CardDescription>
                                    Número para receber os links das rotas otimizadas
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="whatsapp_proprietario">Seu WhatsApp</Label>
                                    <Input
                                        id="whatsapp_proprietario"
                                        value={config.whatsapp_proprietario}
                                        onChange={(e) => updateConfig('whatsapp_proprietario', e.target.value)}
                                        placeholder="5531999999999"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Formato: código do país + DDD + número (ex: 5531999999999)
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Google */}
                <TabsContent value="google">
                    <Card>
                        <CardHeader>
                            <CardTitle>Google Meu Negócio</CardTitle>
                            <CardDescription>
                                Link para avaliações no Google
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="google_place_id">Place ID do Google</Label>
                                <Input
                                    id="google_place_id"
                                    value={config.google_place_id}
                                    onChange={(e) => updateConfig('google_place_id', e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Encontre seu Place ID em:{' '}
                                    <a
                                        href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                    >
                                        Google Place ID Finder
                                    </a>
                                </p>
                            </div>

                            <div className="rounded-lg bg-muted p-4">
                                <p className="text-sm font-medium mb-2">Link de Avaliação:</p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-xs bg-background p-2 rounded overflow-x-auto">
                                        {googleReviewLink}
                                    </code>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(googleReviewLink, '_blank')}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
