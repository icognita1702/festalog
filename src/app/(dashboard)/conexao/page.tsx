'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Smartphone,
    Wifi,
    WifiOff,
    RefreshCw,
    Loader2,
    QrCode,
    Power,
    MessageCircle,
    Bot,
    CheckCircle2,
    AlertCircle
} from 'lucide-react'

interface ConexaoStatus {
    connected: boolean
    state: string
}

export default function ConexaoWhatsAppPage() {
    const [status, setStatus] = useState<ConexaoStatus | null>(null)
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [conectando, setConectando] = useState(false)
    const [desconectando, setDesconectando] = useState(false)

    const verificarStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/status')
            const data = await res.json()
            setStatus(data)

            if (!data.connected && !qrCode) {
                // Se não está conectado e não tem QR, busca QR Code
                await buscarQRCode()
            }
        } catch (error) {
            console.error('Erro ao verificar status:', error)
            setStatus({ connected: false, state: 'error' })
        } finally {
            setLoading(false)
        }
    }, [qrCode])

    const buscarQRCode = async () => {
        try {
            const res = await fetch('/api/whatsapp/qrcode')
            const data = await res.json()

            if (data.qrcode) {
                setQrCode(data.qrcode)
            } else if (data.connected) {
                setQrCode(null)
                setStatus({ connected: true, state: 'open' })
            }
        } catch (error) {
            console.error('Erro ao buscar QR Code:', error)
        }
    }

    const criarInstancia = async () => {
        setConectando(true)
        try {
            const res = await fetch('/api/whatsapp/instance', { method: 'POST' })
            const data = await res.json()

            if (data.qrcode) {
                setQrCode(data.qrcode)
            }
        } catch (error) {
            console.error('Erro ao criar instância:', error)
        } finally {
            setConectando(false)
        }
    }

    const desconectar = async () => {
        setDesconectando(true)
        try {
            await fetch('/api/whatsapp/disconnect', { method: 'POST' })
            setStatus({ connected: false, state: 'close' })
            setQrCode(null)
        } catch (error) {
            console.error('Erro ao desconectar:', error)
        } finally {
            setDesconectando(false)
        }
    }

    useEffect(() => {
        verificarStatus()

        // Atualiza status a cada 10 segundos
        const interval = setInterval(verificarStatus, 10000)
        return () => clearInterval(interval)
    }, [verificarStatus])

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Conexão WhatsApp</h1>
                <p className="text-muted-foreground">
                    Configure o bot de atendimento automático
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Status da Conexão */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Smartphone className="h-5 w-5" />
                            Status da Conexão
                        </CardTitle>
                        <CardDescription>
                            Estado atual da conexão com o WhatsApp
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {status?.connected ? (
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                                                <Wifi className="h-6 w-6 text-green-600" />
                                            </div>
                                        ) : (
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                                                <WifiOff className="h-6 w-6 text-red-600" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-medium">
                                                {status?.connected ? 'Conectado' : 'Desconectado'}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Estado: {status?.state || 'Desconhecido'}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant={status?.connected ? 'default' : 'destructive'}>
                                        {status?.connected ? 'Online' : 'Offline'}
                                    </Badge>
                                </div>

                                <div className="flex gap-3">
                                    {status?.connected ? (
                                        <Button
                                            variant="destructive"
                                            onClick={desconectar}
                                            disabled={desconectando}
                                            className="flex-1"
                                        >
                                            {desconectando ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Power className="mr-2 h-4 w-4" />
                                            )}
                                            Desconectar
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={criarInstancia}
                                            disabled={conectando}
                                            className="flex-1"
                                        >
                                            {conectando ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <QrCode className="mr-2 h-4 w-4" />
                                            )}
                                            Conectar WhatsApp
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        onClick={verificarStatus}
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* QR Code */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <QrCode className="h-5 w-5" />
                            QR Code
                        </CardTitle>
                        <CardDescription>
                            Escaneie com o WhatsApp para conectar
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {status?.connected ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <CheckCircle2 className="h-16 w-16 text-green-500" />
                                <p className="mt-4 font-medium">WhatsApp Conectado!</p>
                                <p className="text-sm text-muted-foreground">
                                    O bot está pronto para responder mensagens
                                </p>
                            </div>
                        ) : qrCode ? (
                            <div className="flex flex-col items-center">
                                <img
                                    src={qrCode}
                                    alt="QR Code WhatsApp"
                                    className="h-64 w-64 rounded-lg border"
                                />
                                <p className="mt-4 text-sm text-muted-foreground text-center">
                                    Abra o WhatsApp no celular → Menu → Aparelhos conectados → Conectar aparelho
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <AlertCircle className="h-12 w-12 text-muted-foreground" />
                                <p className="mt-4 text-sm text-muted-foreground">
                                    Clique em &quot;Conectar WhatsApp&quot; para gerar o QR Code
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Informações do Bot */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        Funcionalidades do Bot
                    </CardTitle>
                    <CardDescription>
                        O bot responde automaticamente às mensagens
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border p-4">
                            <MessageCircle className="h-8 w-8 text-blue-500" />
                            <h3 className="mt-2 font-medium">Menu Interativo</h3>
                            <p className="text-sm text-muted-foreground">
                                Opções numeradas para fácil navegação
                            </p>
                        </div>
                        <div className="rounded-lg border p-4">
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                            <h3 className="mt-2 font-medium">Disponibilidade</h3>
                            <p className="text-sm text-muted-foreground">
                                Consulta automática no banco de dados
                            </p>
                        </div>
                        <div className="rounded-lg border p-4">
                            <Bot className="h-8 w-8 text-purple-500" />
                            <h3 className="mt-2 font-medium">IA Gemini</h3>
                            <p className="text-sm text-muted-foreground">
                                Respostas inteligentes para perguntas complexas
                            </p>
                        </div>
                        <div className="rounded-lg border p-4">
                            <Smartphone className="h-8 w-8 text-orange-500" />
                            <h3 className="mt-2 font-medium">Atendente</h3>
                            <p className="text-sm text-muted-foreground">
                                Encaminha para humano quando necessário
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Instruções */}
            <Card>
                <CardHeader>
                    <CardTitle>📋 Como Funciona</CardTitle>
                </CardHeader>
                <CardContent>
                    <ol className="list-decimal list-inside space-y-3 text-sm">
                        <li>Certifique-se que o Docker está rodando com a Evolution API</li>
                        <li>Clique em <strong>&quot;Conectar WhatsApp&quot;</strong> para gerar o QR Code</li>
                        <li>No celular, abra <strong>WhatsApp → Menu → Aparelhos conectados</strong></li>
                        <li>Clique em <strong>&quot;Conectar um aparelho&quot;</strong> e escaneie o QR Code</li>
                        <li>Pronto! O bot começará a responder automaticamente</li>
                    </ol>
                    <div className="mt-4 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>⚠️ Importante:</strong> O Docker precisa estar rodando com o comando:
                            <code className="ml-2 rounded bg-yellow-100 px-2 py-1 dark:bg-yellow-900">
                                docker-compose up -d
                            </code>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
