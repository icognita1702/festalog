'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Clock,
    Calendar,
    MessageCircle,
    Bot,
    CheckCircle2,
    ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function ConexaoWhatsAppPage() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Conexão WhatsApp</h1>
                <p className="text-muted-foreground">
                    Bot de atendimento automático
                </p>
            </div>

            {/* Aviso de Manutenção */}
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                        <Clock className="h-5 w-5" />
                        🔧 Em Manutenção
                    </CardTitle>
                    <CardDescription className="text-amber-700 dark:text-amber-300">
                        O bot automático está temporariamente desativado
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-amber-800 dark:text-amber-200">
                        Estamos aprimorando a conexão com o WhatsApp para maior estabilidade.
                    </p>

                    <div className="flex items-center gap-2 rounded-lg bg-amber-100 p-3 dark:bg-amber-900">
                        <Calendar className="h-5 w-5 text-amber-600" />
                        <span className="font-medium text-amber-800 dark:text-amber-200">
                            Previsão de retorno: 17 de Dezembro de 2024
                        </span>
                    </div>

                    <div className="pt-2">
                        <Badge variant="outline" className="border-amber-400 text-amber-700">
                            Consulte: GUIA_RECONEXAO_WHATSAPP.md
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* O que funciona */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        O que funciona agora
                    </CardTitle>
                    <CardDescription>
                        Todas estas funcionalidades estão operacionais
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex items-start gap-3 rounded-lg border p-4">
                            <MessageCircle className="h-8 w-8 text-green-500" />
                            <div>
                                <h3 className="font-medium">Enviar via WhatsApp Web</h3>
                                <p className="text-sm text-muted-foreground">
                                    Clique nos botões de WhatsApp para abrir conversa com mensagem pronta
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border p-4">
                            <Bot className="h-8 w-8 text-blue-500" />
                            <div>
                                <h3 className="font-medium">Templates de Mensagem</h3>
                                <p className="text-sm text-muted-foreground">
                                    Use a página de WhatsApp para enviar mensagens padronizadas
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex gap-3">
                        <Link href="/whatsapp">
                            <Button>
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Ir para WhatsApp
                            </Button>
                        </Link>
                        <Link href="/pedidos">
                            <Button variant="outline">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Ver Pedidos
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Informações do Bot (quando voltar) */}
            <Card className="opacity-60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        Funcionalidades do Bot
                        <Badge variant="secondary">Em breve</Badge>
                    </CardTitle>
                    <CardDescription>
                        Recursos que estarão disponíveis após a manutenção
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border p-4 opacity-50">
                            <MessageCircle className="h-8 w-8 text-blue-500" />
                            <h3 className="mt-2 font-medium">Menu Interativo</h3>
                            <p className="text-sm text-muted-foreground">
                                Opções numeradas para fácil navegação
                            </p>
                        </div>
                        <div className="rounded-lg border p-4 opacity-50">
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                            <h3 className="mt-2 font-medium">Disponibilidade</h3>
                            <p className="text-sm text-muted-foreground">
                                Consulta automática no banco de dados
                            </p>
                        </div>
                        <div className="rounded-lg border p-4 opacity-50">
                            <Bot className="h-8 w-8 text-purple-500" />
                            <h3 className="mt-2 font-medium">IA Gemini</h3>
                            <p className="text-sm text-muted-foreground">
                                Respostas inteligentes para perguntas complexas
                            </p>
                        </div>
                        <div className="rounded-lg border p-4 opacity-50">
                            <MessageCircle className="h-8 w-8 text-orange-500" />
                            <h3 className="mt-2 font-medium">Atendente</h3>
                            <p className="text-sm text-muted-foreground">
                                Encaminha para humano quando necessário
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
