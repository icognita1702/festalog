'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Building2,
    CreditCard,
    MessageCircle,
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
    whatsapp_instance: string
    mensagem_boas_vindas: string
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
    whatsapp_instance: 'lufestas',
    mensagem_boas_vindas: 'Olá! Bem-vindo à Lu Festas! Como posso ajudar?'
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

    function updateConfig(field: keyof Configuracoes, value: string) {
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
                    <TabsTrigger value="integracoes" className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Integrações
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

                {/* Integrações */}
                <TabsContent value="integracoes">
                    <Card>
                        <CardHeader>
                            <CardTitle>WhatsApp Bot</CardTitle>
                            <CardDescription>
                                Configurações da integração com WhatsApp
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="whatsapp_instance">Nome da Instância (Evolution API)</Label>
                                <Input
                                    id="whatsapp_instance"
                                    value={config.whatsapp_instance}
                                    onChange={(e) => updateConfig('whatsapp_instance', e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="mensagem_boas_vindas">Mensagem de Boas-vindas</Label>
                                <Textarea
                                    id="mensagem_boas_vindas"
                                    value={config.mensagem_boas_vindas}
                                    onChange={(e) => updateConfig('mensagem_boas_vindas', e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>
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
