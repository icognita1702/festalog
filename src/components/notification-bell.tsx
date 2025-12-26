'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    Bell,
    Check,
    CheckCheck,
    Truck,
    AlertTriangle,
    CreditCard,
    ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import {
    getNotificacoesNaoLidas,
    marcarComoLida,
    marcarTodasComoLidas,
    gerarNotificacoesAutomaticas,
    type Notificacao
} from '@/lib/notification-service'

const tipoConfig: Record<string, { icon: typeof Bell; color: string }> = {
    evento_proximo: { icon: Truck, color: 'text-blue-500' },
    pagamento_pendente: { icon: CreditCard, color: 'text-yellow-500' },
    devolucao: { icon: AlertTriangle, color: 'text-red-500' },
}

export function NotificationBell() {
    const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
    const [loading, setLoading] = useState(true)
    const [open, setOpen] = useState(false)

    async function loadNotificacoes() {
        try {
            // Gera novas notificações automaticamente
            await gerarNotificacoesAutomaticas()
            // Busca não lidas
            const data = await getNotificacoesNaoLidas()
            setNotificacoes(data)
        } catch (err) {
            console.error('Erro ao carregar notificações:', err)
            setNotificacoes([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadNotificacoes()
        // Atualiza a cada 5 minutos
        const interval = setInterval(loadNotificacoes, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    async function handleMarcarLida(id: string) {
        await marcarComoLida(id)
        setNotificacoes(notificacoes.filter(n => n.id !== id))
    }

    async function handleMarcarTodasLidas() {
        await marcarTodasComoLidas()
        setNotificacoes([])
    }

    const count = notificacoes.length

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {count > 0 && (
                        <Badge
                            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-destructive"
                        >
                            {count > 9 ? '9+' : count}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                    <h3 className="font-semibold">Notificações</h3>
                    {count > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleMarcarTodasLidas}
                        >
                            <CheckCheck className="h-3 w-3 mr-1" />
                            Limpar
                        </Button>
                    )}
                </div>

                {loading ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Carregando...
                    </p>
                ) : notificacoes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <Bell className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground mt-2">
                            Nenhuma notificação
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {notificacoes.map((notif) => {
                            const config = tipoConfig[notif.tipo] || tipoConfig.evento_proximo
                            const Icon = config.icon
                            return (
                                <div
                                    key={notif.id}
                                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className={`mt-0.5 ${config.color}`}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium leading-none">
                                            {notif.titulo}
                                        </p>
                                        {notif.mensagem && (
                                            <p className="text-xs text-muted-foreground mt-1 truncate">
                                                {notif.mensagem}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {notif.pedido_id && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                asChild
                                            >
                                                <Link href={`/pedidos/${notif.pedido_id}`}>
                                                    <ExternalLink className="h-3 w-3" />
                                                </Link>
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleMarcarLida(notif.id)}
                                        >
                                            <Check className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
