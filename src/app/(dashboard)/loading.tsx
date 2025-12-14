'use client'

import { Loader2, PartyPopper } from 'lucide-react'

export default function DashboardLoading() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
            <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
        </div>
    )
}
