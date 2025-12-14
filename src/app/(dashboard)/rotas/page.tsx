'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    MapPin,
    Navigation,
    Loader2,
    Clock,
    Truck,
    ExternalLink,
    RefreshCw,
    MessageCircle,
    Mail,
    AlertTriangle
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
    const [modoOrdenacao, setModoOrdenacao] = useState<'horario' | 'distancia'>('horario')
    const [showConflictDialog, setShowConflictDialog] = useState(false)
    const [entregasOtimizadas, setEntregasOtimizadas] = useState<Entrega[]>([])
    const [conflitos, setConflitos] = useState<string[]>([])

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
        setModoOrdenacao('horario')

        const { data, error } = await supabase
            .from('pedidos')
            .select('*, clientes(*)')
            .eq('data_evento', dataRota)
            .in('status', ['assinado', 'pago_50']) // Pedidos confirmados que precisam de entrega
            .order('hora_entrega') // ORDER BY DELIVERY TIME

        if (error) {
            console.error('Erro ao carregar entregas:', error)
        } else {
            setEntregas((data as PedidoComCliente[])?.map((p, i) => ({ pedido: p, ordem: i + 1 })) || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        if (dataRota) {
            loadEntregas()
        }
    }, [dataRota])

    function formatarHora(hora: string | null | undefined): string {
        if (!hora) return '--:--'
        // hora_entrega is stored as "HH:MM" or "HH:MM:SS"
        return hora.substring(0, 5)
    }

    // Helper to get hora_entrega from pedido (type cast needed as field may not be in generated types)
    function getHoraEntrega(pedido: PedidoComCliente): string | null {
        return (pedido as any).hora_entrega || null
    }

    // Check if optimization would change delivery order and cause time conflicts
    function detectarConflitos(entregasOriginais: Entrega[], entregasReordenadas: Entrega[]): string[] {
        const conflitosDetectados: string[] = []

        for (let i = 0; i < entregasReordenadas.length; i++) {
            const entregaAtual = entregasReordenadas[i]
            const horaAtual = getHoraEntrega(entregaAtual.pedido) || '00:00'

            // Check if any earlier delivery (in optimized order) has a later scheduled time
            for (let j = i + 1; j < entregasReordenadas.length; j++) {
                const entregaPosterior = entregasReordenadas[j]
                const horaPosterior = getHoraEntrega(entregaPosterior.pedido) || '00:00'

                // If an earlier position has later time than a later position, there's conflict
                if (horaAtual > horaPosterior) {
                    const nomeAtual = entregaAtual.pedido.clientes?.nome || 'Cliente'
                    const nomePosterior = entregaPosterior.pedido.clientes?.nome || 'Cliente'
                    conflitosDetectados.push(
                        `${nomeAtual} (${formatarHora(horaAtual)}) será entregue antes de ${nomePosterior} (${formatarHora(horaPosterior)})`
                    )
                }
            }
        }

        return conflitosDetectados
    }

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

                    return await geocode(endereco)
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

            // Filtrar coordenadas válidas e manter índices
            const entregasComCoords = entregas
                .map((e, i) => ({ entrega: e, coords: coordenadas[i], index: i }))
                .filter((item): item is { entrega: Entrega; coords: number[]; index: number } => item.coords !== null)

            if (entregasComCoords.length < 1) {
                alert('Não foi possível geocodificar os endereços. Verifique se estão corretos.')
                setOtimizando(false)
                return
            }

            // Use OSRM Trip endpoint for optimization (traveling salesman)
            const allCoords = [lojaCoord, ...entregasComCoords.map(e => e.coords)]
            const osrmCoords = allCoords.map(c => `${c[0]},${c[1]}`).join(';')

            // Use trip endpoint with roundtrip=true, source=first (start from store)
            const osrmUrl = `https://router.project-osrm.org/trip/v1/driving/${osrmCoords}?source=first&roundtrip=true&overview=false`

            const osrmRes = await fetch(osrmUrl)
            const osrmData = await osrmRes.json()

            if (osrmData.code === 'Ok' && osrmData.trips && osrmData.trips.length > 0) {
                const trip = osrmData.trips[0]
                const tempoMinutos = Math.round(trip.duration / 60)
                const distanciaKm = Math.round(trip.distance / 100) / 10

                // Get optimized order from waypoints (skip first which is the store)
                const waypoints = osrmData.waypoints.slice(1) // Remove store waypoint
                const novaOrdem = waypoints.map((wp: { waypoint_index: number }) => wp.waypoint_index - 1)

                // Reorder deliveries based on optimization
                const entregasReordenadas = novaOrdem
                    .filter((idx: number) => idx >= 0 && idx < entregasComCoords.length)
                    .map((idx: number, ordem: number) => ({
                        ...entregasComCoords[idx].entrega,
                        ordem: ordem + 1
                    }))

                // Detect conflicts with scheduled times
                const conflitosDetectados = detectarConflitos(entregas, entregasReordenadas)

                if (conflitosDetectados.length > 0) {
                    // Show warning dialog
                    setEntregasOtimizadas(entregasReordenadas)
                    setConflitos(conflitosDetectados)
                    setShowConflictDialog(true)
                    // Store calculated values temporarily
                    setTempoTotal(tempoMinutos)
                    setDistanciaTotal(distanciaKm)
                } else {
                    // No conflicts, apply optimization directly
                    setEntregas(entregasReordenadas)
                    setTempoTotal(tempoMinutos)
                    setDistanciaTotal(distanciaKm)
                    setRotaOtimizada(true)
                    setModoOrdenacao('distancia')
                }
            } else {
                // Fallback to regular route calculation if trip fails
                const routeUrl = `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=false`
                const routeRes = await fetch(routeUrl)
                const routeData = await routeRes.json()

                if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
                    const route = routeData.routes[0]
                    setTempoTotal(Math.round(route.duration / 60))
                    setDistanciaTotal(Math.round(route.distance / 100) / 10)
                    setRotaOtimizada(true)
                } else {
                    alert('Erro ao calcular rota. Verifique os endereços.')
                }
            }
        } catch (error) {
            console.error('Erro ao otimizar rota:', error)
            alert('Erro ao otimizar rota. Tente novamente.')
        } finally {
            setOtimizando(false)
        }
    }

    function aplicarOtimizacao() {
        setEntregas(entregasOtimizadas)
        setRotaOtimizada(true)
        setModoOrdenacao('distancia')
        setShowConflictDialog(false)
    }

    function manterPorHorario() {
        // Keep original order, but still show calculated time/distance
        setRotaOtimizada(true)
        setModoOrdenacao('horario')
        setShowConflictDialog(false)
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
            entregas.map((e, i) => `${i + 1}. ⏰ ${formatarHora(getHoraEntrega(e.pedido))} - ${e.pedido.clientes?.nome} - ${e.pedido.clientes?.endereco_completo}`).join('\n') +
            `\n\n🗺️ Abrir rota:\n${url}`
        window.open(`https://api.whatsapp.com/send?phone=${whatsappProprietario}&text=${encodeURIComponent(message)}`, '_blank')
    }

    function enviarRotaEmail() {
        if (entregas.length === 0) return
        const url = getGoogleMapsUrl()
        const dataFormatada = format(new Date(dataRota + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
        const subject = `Rota de Entregas - ${dataFormatada}`
        const body = `Rota com ${entregas.length} entrega(s):\n\n` +
            entregas.map((e, i) => `${i + 1}. ${formatarHora(getHoraEntrega(e.pedido))} - ${e.pedido.clientes?.nome} - ${e.pedido.clientes?.endereco_completo}`).join('\n') +
            `\n\nAbrir no Google Maps:\n${url}`
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    }

    return (
        <div className="space-y-8">
            {/* Conflict Warning Dialog */}
            <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="h-5 w-5" />
                            Atenção: Conflito de Horários
                        </DialogTitle>
                        <DialogDescription className="text-left pt-2">
                            A otimização por menor distância pode causar atrasos nas entregas agendadas:
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 p-4 space-y-2">
                            {conflitos.map((conflito, i) => (
                                <p key={i} className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                                    <span>•</span>
                                    <span>{conflito}</span>
                                </p>
                            ))}
                        </div>
                        <p className="text-sm text-muted-foreground mt-4">
                            Escolha como deseja organizar a rota:
                        </p>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={manterPorHorario} className="flex-1">
                            <Clock className="mr-2 h-4 w-4" />
                            Manter por Horário
                        </Button>
                        <Button onClick={aplicarOtimizacao} className="flex-1 bg-amber-600 hover:bg-amber-700">
                            <Navigation className="mr-2 h-4 w-4" />
                            Otimizar por Distância
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                        <div className="mt-4 flex flex-wrap gap-4 rounded-lg bg-green-50 p-4 dark:bg-green-950">
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
                            <Badge variant={modoOrdenacao === 'horario' ? 'default' : 'secondary'} className="ml-auto">
                                {modoOrdenacao === 'horario' ? '⏰ Por Horário' : '📍 Por Distância'}
                            </Badge>
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
                        {modoOrdenacao === 'horario' && entregas.length > 0 && ' • Ordenado por horário de entrega'}
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
                                        {entrega.ordem ?? index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-medium">{entrega.pedido.clientes?.nome}</p>
                                            <Badge variant="outline" className="gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatarHora(getHoraEntrega(entrega.pedido))}
                                            </Badge>
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
