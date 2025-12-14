'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
    Loader2,
    MessageCircle,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    User,
    Calendar,
    MapPin,
    Phone,
    Package,
} from 'lucide-react'
import type { ExtractionResult } from '@/lib/conversation-analyzer'

interface ConversationImportDialogProps {
    onImport: (result: ExtractionResult) => void
}

export function ConversationImportDialog({ onImport }: ConversationImportDialogProps) {
    const [open, setOpen] = useState(false)
    const [conversation, setConversation] = useState('')
    const [analyzing, setAnalyzing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<ExtractionResult | null>(null)

    async function handleAnalyze() {
        if (!conversation.trim()) {
            setError('Cole uma conversa do WhatsApp')
            return
        }

        setAnalyzing(true)
        setError(null)
        setResult(null)

        try {
            const response = await fetch('/api/analyze-conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversation }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || 'Erro ao analisar conversa')
                if (data.result) {
                    setResult(data.result)
                }
                return
            }

            setResult(data.result)

        } catch (err) {
            setError('Erro de conexão. Tente novamente.')
        } finally {
            setAnalyzing(false)
        }
    }

    function handleImport() {
        if (result) {
            onImport(result)
            setOpen(false)
            // Reset state
            setConversation('')
            setResult(null)
            setError(null)
        }
    }

    function handleClose() {
        setOpen(false)
        setConversation('')
        setResult(null)
        setError(null)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Importar de Conversa
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-green-500" />
                        Importar Dados de Conversa WhatsApp
                    </DialogTitle>
                    <DialogDescription>
                        Cole a conversa do WhatsApp e a IA irá extrair automaticamente os dados do cliente e do pedido.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Textarea para colar conversa */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Conversa do WhatsApp
                        </label>
                        <Textarea
                            placeholder="Cole aqui a conversa completa do WhatsApp com o cliente...

Exemplo:
Cliente: Oi, boa tarde! Vocês alugam mesa para festa?
Você: Olá! Sim, temos mesas redondas e retangulares.
Cliente: Preciso de 10 mesas para dia 20/01, meu nome é Maria
..."
                            value={conversation}
                            onChange={(e) => setConversation(e.target.value)}
                            className="min-h-[200px] font-mono text-sm"
                            disabled={analyzing}
                        />
                        <p className="text-xs text-muted-foreground">
                            💡 Dica: Selecione toda a conversa no WhatsApp Web e cole aqui
                        </p>
                    </div>

                    {/* Botão de análise */}
                    {!result && (
                        <Button
                            onClick={handleAnalyze}
                            disabled={analyzing || !conversation.trim()}
                            className="w-full gap-2"
                        >
                            {analyzing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Analisando com IA...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    Analisar Conversa
                                </>
                            )}
                        </Button>
                    )}

                    {/* Erro */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Resultado da extração */}
                    {result && (
                        <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Dados Extraídos
                                </h4>
                                <Badge variant={result.confianca >= 0.7 ? 'default' : 'secondary'}>
                                    Confiança: {Math.round(result.confianca * 100)}%
                                </Badge>
                            </div>

                            {/* Resumo */}
                            {result.resumo && (
                                <p className="text-sm text-muted-foreground italic">
                                    "{result.resumo}"
                                </p>
                            )}

                            {/* Dados do Cliente */}
                            <div className="space-y-2">
                                <h5 className="text-sm font-medium text-muted-foreground">Cliente</h5>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <span>{result.cliente.nome || '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <span>{result.cliente.telefone || '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm sm:col-span-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        <span>{result.cliente.endereco || '—'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Dados do Pedido */}
                            <div className="space-y-2">
                                <h5 className="text-sm font-medium text-muted-foreground">Pedido</h5>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <span>
                                            {result.pedido.data_evento
                                                ? new Date(result.pedido.data_evento + 'T12:00:00').toLocaleDateString('pt-BR')
                                                : '—'}
                                            {result.pedido.hora_evento && ` às ${result.pedido.hora_evento}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Package className="h-4 w-4 text-muted-foreground" />
                                        <span>{result.pedido.tipo_festa || '—'}</span>
                                    </div>
                                </div>
                                {result.pedido.itens.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs text-muted-foreground mb-1">Itens solicitados:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {result.pedido.itens.map((item, i) => (
                                                <Badge key={i} variant="outline" className="text-xs">
                                                    {item}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {result.pedido.observacoes && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Obs: {result.pedido.observacoes}
                                    </p>
                                )}
                            </div>

                            {result.confianca < 0.5 && (
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        Confiança baixa. Revise os dados antes de importar.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={handleClose}>
                        Cancelar
                    </Button>
                    {result && (
                        <Button onClick={handleImport} className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Importar Dados
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
