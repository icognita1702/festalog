'use client'

import { Loader2, PartyPopper } from 'lucide-react'

export default function Loading() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg mb-4">
                <PartyPopper className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-4">
                FestaLog
            </h1>
            <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
            <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
        </div>
    )
}
