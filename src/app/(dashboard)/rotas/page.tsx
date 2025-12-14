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
    RefreshCw,
    MessageCircle,
    Mail
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
    const [whatsappProprietario, setWhatsappProprietario] = useState('5531982290789')

    // Load config for WhatsApp proprietário
    useEffect(() => {
        async function loadConfig() {
            try {
                const { data } = await (supabase as any)
                    .from('configuracoes')
                    .select('whatsapp_proprietario')
                    .single()
                if (data?.whatsapp_proprietario) {
                    setWhatsappProprietario(data.whatsapp_proprietario)
                }
            } catch (error) {
                console.log('Usando WhatsApp padrão')
            }
        }
        loadConfig()
    }, [])

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
            // Usar Nominatim (OSM) para geocodificar - 100% GRATUITO
            const geocode = async (endereco: string): Promise<number[] | null> => {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}&countrycodes=br&limit=1`
                const res = await fetch(url, {
                    headers: { 'User-Agent': 'FestaLog/1.0' }
                })
                const data = await res.json()
                if (data && data.length > 0) {
                    // Nominatim retorna [lat, lon], precisamos inverter para [lon, lat]
                    return [parseFloat(data[0].lon), parseFloat(data[0].lat)]
                }
                return null
            }

            // Geocodificar endereços dos clientes
            const coordenadas = await Promise.all(
                entregas.map(async (entrega) => {
                    const enderecoOriginal = entrega.pedido.clientes?.endereco_completo || ''
                    const endereco = enderecoOriginal.toLowerCase().includes('belo horizonte')
                        ? enderecoOriginal
                        : `${enderecoOriginal}, Belo Horizonte, MG, Brasil`

                    console.log('Geocoding:', endereco)
                    const coords = await geocode(endereco)
                    if (coords) {
                        console.log('Resultado:', endereco, '→', coords)
                    } else {
                        console.warn('Não encontrou:', endereco)
                    }
                    return coords
                })
            )

            // Geocodificar endereço da loja
            const lojaEndereco = `${enderecoLoja}, Brasil`
            const lojaCoord = await geocode(lojaEndereco)

            if (!lojaCoord) {
                alert('Não foi possível geocodificar o endereço da loja')
                setOtimizando(false)
                return
            }
            console.log('Loja:', lojaEndereco, '→', lojaCoord)

            // Filtrar coordenadas válidas
            const coordsValidas = coordenadas.filter((c): c is number[] => c !== null)

            if (coordsValidas.length < 1) {
                alert('Não foi possível geocodificar os endereços. Verifique se estão corretos.')
                setOtimizando(false)
                return
            }

            // Construir array de coordenadas: loja -> entregas -> loja
            const allCoords = [lojaCoord, ...coordsValidas, lojaCoord]

            console.log('=== ROTA CALCULADA ===')
            console.log(`Total de pontos: ${allCoords.length} (Loja + ${coordsValidas.length} entregas + Volta)`)

            // Usar OSRM para calcular rota - 100% GRATUITO
            // Formato: lon,lat;lon,lat;...
            const osrmCoords = allCoords.map(c => `${c[0]},${c[1]}`).join(';')
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=false`

            console.log('OSRM URL:', osrmUrl)
            const osrmRes = await fetch(osrmUrl)
            const osrmData = await osrmRes.json()

            console.log('OSRM result:', osrmData)

            if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
                const route = osrmData.routes[0]
                // OSRM retorna duration em segundos e distance em metros
                const tempoMinutos = Math.round(route.duration / 60)
                const distanciaKm = Math.round(route.distance / 100) / 10

                console.log(`OSRM - Tempo: ${tempoMinutos} min, Distância: ${distanciaKm} km`)

                // Reordenar entregas (OSRM não otimiza, mantém a ordem)
                // Se quiser otimizar, usar OSRM trip endpoint
                setEntregas(entregas.map((e, i) => ({ ...e, ordem: i })))

                setTempoTotal(tempoMinutos)
                setDistanciaTotal(distanciaKm)
                setRotaOtimizada(true)
            } else {
                console.error('OSRM error:', osrmData)
                alert('Erro ao calcular rota. Verifique os endereços.')
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
        const message = `🚚 *Lu Festas - Entrega a caminho!*\n\n` +
            `Olá ${nome}! 👋\n\n` +
            `Estamos a caminho para a entrega!\n\n` +
            `📍 Endereço: ${endereco}\n\n` +
            `Por favor, aguarde nossa chegada! ✅`
        window.open(`https://api.whatsapp.com/send?phone=55${number}&text=${encodeURIComponent(message)}`, '_blank')
    }

    function getGoogleMapsUrl() {
        if (entregas.length === 0) return ''
        const waypoints = entregas
            .map(e => encodeURIComponent(e.pedido.clientes?.endereco_completo || ''))
            .join('/')
        return `https://www.google.com/maps/dir/${encodeURIComponent(enderecoLoja)}/${waypoints}/${encodeURIComponent(enderecoLoja)}`
    }

    function enviarRotaWhatsApp() {
        if (entregas.length === 0) return
        const url = getGoogleMapsUrl()
        const dataFormatada = format(new Date(dataRota + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
        const message = `🚚 *Rota de Entregas - ${dataFormatada}*\n\n` +
            `📍 ${entregas.length} entrega(s)\n\n` +
            entregas.map((e, i) => `${i + 1}. ${e.pedido.clientes?.nome} - ${e.pedido.clientes?.endereco_completo}`).join('\n') +
            `\n\n🗺️ Abrir rota:\n${url}`
        window.open(`https://api.whatsapp.com/send?phone=${whatsappProprietario}&text=${encodeURIComponent(message)}`, '_blank')
    }

    function enviarRotaEmail() {
        if (entregas.length === 0) return
        const url = getGoogleMapsUrl()
        const dataFormatada = format(new Date(dataRota + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
        const subject = `Rota de Entregas - ${dataFormatada}`
        const body = `Rota com ${entregas.length} entrega(s):\n\n` +
            entregas.map((e, i) => `${i + 1}. ${e.pedido.clientes?.nome} - ${e.pedido.clientes?.endereco_completo}`).join('\n') +
            `\n\nAbrir no Google Maps:\n${url}`
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
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
                            Abrir no Maps
                        </Button>
                        <Button
                            onClick={enviarRotaWhatsApp}
                            disabled={entregas.length === 0}
                            variant="secondary"
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Enviar via WhatsApp
                        </Button>
                        <Button
                            onClick={enviarRotaEmail}
                            disabled={entregas.length === 0}
                            variant="outline"
                        >
                            <Mail className="mr-2 h-4 w-4" />
                            Enviar por Email
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
