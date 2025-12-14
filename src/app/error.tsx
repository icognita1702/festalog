'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, PartyPopper } from 'lucide-react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Application error:', error)
    }, [error])

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg mb-4">
                <PartyPopper className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-4">
                FestaLog
            </h1>
            <div className="flex items-center gap-2 text-destructive mb-4">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Ocorreu um erro</span>
            </div>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                Algo deu errado ao carregar a aplicação. Isso pode ser um problema temporário.
            </p>
            <div className="flex gap-3">
                <Button onClick={reset} variant="default">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Tentar Novamente
                </Button>
                <Button onClick={() => window.location.href = '/dashboard'} variant="outline">
                    Ir para o Dashboard
                </Button>
            </div>
        </div>
    )
}
