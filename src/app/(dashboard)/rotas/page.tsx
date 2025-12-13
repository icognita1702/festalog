'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    MapPin,
    Navigation,
    Loader2,
    Clock,
    Truck,
    ExternalLink,
    RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import type { PedidoComCliente, StatusPedido } from '@/lib/database.types'

interface Entrega {
    pedido: PedidoComCliente
    ordem?: number
}

const statusLabels: Record<StatusPedido, string> = {
    orcamento: 'Orçamento',
    contrato_enviado: 'Contrato Enviado',
    assinado: 'Assinado',
    pago_50: 'Pago 50%',
    entregue: 'Entregue',
    recolhido: 'Recolhido',
    finalizado: 'Finalizado',
}

export default function RotasPage() {
    const [dataRota, setDataRota] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [entregas, setEntregas] = useState<Entrega[]>([])
    const [loading, setLoading] = useState(false)
    const [otimizando, setOtimizando] = useState(false)
    const [rotaOtimizada, setRotaOtimizada] = useState(false)
    const [tempoTotal, setTempoTotal] = useState<number | null>(null)
    const [distanciaTotal, setDistanciaTotal] = useState<number | null>(null)

    const enderecoLoja = process.env.NEXT_PUBLIC_LOJA_ENDERECO || 'Rua Ariramba 121, BH - MG'

    async function loadEntregas() {
        setLoading(true)
        setRotaOtimizada(false)
        setTempoTotal(null)
        setDistanciaTotal(null)

        const { data, error } = await supabase
            .from('pedidos')
            .select('*, clientes(*)')
            .eq('data_evento', dataRota)
            .in('status', ['assinado', 'pago_50']) // Pedidos confirmados que precisam de entrega
            .order('created_at')

        if (error) {
            console.error('Erro ao carregar entregas:', error)
        } else {
            setEntregas((data as PedidoComCliente[])?.map(p => ({ pedido: p })) || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        if (dataRota) {
            loadEntregas()
        }
    }, [dataRota])

    async function otimizarRota() {
        if (entregas.length < 2) {
            alert('Adicione pelo menos 2 entregas para otimizar a rota')
            return
        }

        setOtimizando(true)

        try {
            // Geocodificar endereços (usar API do OpenRouteService)
            const coordenadas = await Promise.all(
                entregas.map(async (entrega) => {
                    const endereco = encodeURIComponent(entrega.pedido.clientes?.endereco_completo || '')
                    const res = await fetch(
                        `https://api.openrouteservice.org/geocode/search?api_key=${process.env.NEXT_PUBLIC_OPENROUTE_API_KEY || ''}&text=${endereco}&boundary.country=BR`
                    )
                    const data = await res.json()
                    if (data.features && data.features.length > 0) {
                        return data.features[0].geometry.coordinates
                    }
                    return null
                })
            )

            // Geocodificar endereço da loja
            const lojaRes = await fetch(
                `https://api.openrouteservice.org/geocode/search?api_key=${process.env.NEXT_PUBLIC_OPENROUTE_API_KEY || ''}&text=${encodeURIComponent(enderecoLoja)}&boundary.country=BR`
            )
            const lojaData = await lojaRes.json()
            const lojaCoord = lojaData.features?.[0]?.geometry?.coordinates

            if (!lojaCoord) {
                alert('Não foi possível geocodificar o endereço da loja')
                setOtimizando(false)
                return
            }

            // Filtrar coordenadas válidas
            const coordsValidas = coordenadas.filter((c): c is number[] => c !== null)

            if (coordsValidas.length < 2) {
                alert('Não foi possível geocodificar os endereços. Verifique se estão corretos.')
                setOtimizando(false)
                return
            }

            // Chamar API de otimização
            const response = await fetch('https://api.openrouteservice.org/optimization', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': process.env.NEXT_PUBLIC_OPENROUTE_API_KEY || '',
                },
                body: JSON.stringify({
                    jobs: coordsValidas.map((coord, i) => ({
                        id: i + 1,
                        location: coord,
                        service: 300, // 5 min por entrega
                    })),
                    vehicles: [{
                        id: 1,
                        profile: 'driving-car',
                        start: lojaCoord,
                        end: lojaCoord, // Retorna à loja
                    }],
                }),
            })

            const result = await response.json()

            if (result.routes && result.routes.length > 0) {
                const route = result.routes[0]

                // Reordenar entregas conforme otimização
                const novaOrdem: Entrega[] = []
                route.steps.forEach((step: { type: string; job?: number }, ordem: number) => {
                    if (step.type === 'job' && step.job !== undefined) {
                        const entregaIndex = step.job - 1
                        if (entregas[entregaIndex]) {
                            novaOrdem.push({ ...entregas[entregaIndex], ordem: ordem })
                        }
                    }
                })

                setEntregas(novaOrdem)
                // Validar e converter valores
                const durationSecs = route.duration || 0
                const distanceMeters = route.distance || 0
                setTempoTotal(durationSecs > 0 ? Math.round(durationSecs / 60) : 0)
                setDistanciaTotal(distanceMeters > 0 ? Math.round(distanceMeters / 1000 * 10) / 10 : 0)
                setRotaOtimizada(true)
            }
        } catch (error) {
            console.error('Erro ao otimizar rota:', error)
            alert('Erro ao otimizar rota. Tente novamente.')
        } finally {
            setOtimizando(false)
        }
    }

    function abrirGoogleMaps() {
        if (entregas.length === 0) return

        const waypoints = entregas
            .map(e => encodeURIComponent(e.pedido.clientes?.endereco_completo || ''))
            .join('/')

        const url = `https://www.google.com/maps/dir/${encodeURIComponent(enderecoLoja)}/${waypoints}/${encodeURIComponent(enderecoLoja)}`
        window.open(url, '_blank')
    }

    function abrirWhatsApp(whatsapp: string, nome: string, endereco: string) {
        const number = whatsapp.replace(/\D/g, '')
        const message = encodeURIComponent(
            `Olá ${nome}! Aqui é da locadora. Estamos a caminho para a entrega no endereço: ${endereco}. Aguarde nossa chegada! 🚚`
        )
        window.open(`https://wa.me/55${number}?text=${message}`, '_blank')
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Rotas de Entrega</h1>
                    <p className="text-muted-foreground">
                        Otimize suas rotas de entrega e economize combustível
                    </p>
                </div>
            </div>

            {/* Seleção de Data */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Entregas do Dia
                    </CardTitle>
                    <CardDescription>
                        Selecione a data para visualizar e otimizar as entregas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        <Input
                            type="date"
                            value={dataRota}
                            onChange={(e) => setDataRota(e.target.value)}
                            className="w-[200px]"
                        />
                        <Button
                            onClick={otimizarRota}
                            disabled={otimizando || entregas.length < 2}
                            variant="secondary"
                        >
                            {otimizando ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Otimizar Rota
                        </Button>
                        <Button
                            onClick={abrirGoogleMaps}
                            disabled={entregas.length === 0}
                        >
                            <Navigation className="mr-2 h-4 w-4" />
                            Abrir no Google Maps
                        </Button>
                    </div>

                    {rotaOtimizada && tempoTotal !== null && distanciaTotal !== null && (
                        <div className="mt-4 flex gap-4 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-green-600" />
                                <span className="font-medium text-green-700 dark:text-green-400">
                                    Tempo estimado: {tempoTotal >= 60 ? `${Math.floor(tempoTotal / 60)}h ${tempoTotal % 60}min` : `${tempoTotal} min`}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-green-600" />
                                <span className="font-medium text-green-700 dark:text-green-400">
                                    Distância: {distanciaTotal > 0 ? `${distanciaTotal} km` : 'Calcular...'}
                                </span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Lista de Entregas */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        Rota de Entregas para {format(new Date(dataRota + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                    </CardTitle>
                    <CardDescription>
                        {entregas.length} entrega{entregas.length !== 1 ? 's' : ''} programada{entregas.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : entregas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Truck className="h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                Nenhuma entrega programada para esta data
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Pedidos com status &quot;Assinado&quot; ou &quot;Pago 50%&quot; aparecerão aqui
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Ponto de Partida */}
                            <div className="flex items-center gap-4 rounded-lg border border-green-500 bg-green-50 p-4 dark:bg-green-950">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white font-bold">
                                    🏠
                                </div>
                                <div>
                                    <p className="font-medium">Ponto de Partida - Loja</p>
                                    <p className="text-sm text-muted-foreground">{enderecoLoja}</p>
                                </div>
                            </div>

                            {/* Entregas */}
                            {entregas.map((entrega, index) => (
                                <div
                                    key={entrega.pedido.id}
                                    className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                                >
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                                        {rotaOtimizada ? entrega.ordem : index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">{entrega.pedido.clientes?.nome}</p>
                                            <Badge variant="secondary">
                                                {statusLabels[entrega.pedido.status]}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {entrega.pedido.clientes?.endereco_completo}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => abrirWhatsApp(
                                                entrega.pedido.clientes?.whatsapp || '',
                                                entrega.pedido.clientes?.nome || '',
                                                entrega.pedido.clientes?.endereco_completo || ''
                                            )}
                                        >
                                            Avisar
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(entrega.pedido.clientes?.endereco_completo || '')}`
                                                window.open(url, '_blank')
                                            }}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            {/* Retorno à Loja */}
                            <div className="flex items-center gap-4 rounded-lg border border-green-500 bg-green-50 p-4 dark:bg-green-950">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white font-bold">
                                    🏠
                                </div>
                                <div>
                                    <p className="font-medium">Retorno - Loja</p>
                                    <p className="text-sm text-muted-foreground">{enderecoLoja}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
