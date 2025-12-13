import { NextResponse } from 'next/server'
import { verificarStatus } from '@/lib/evolution-api'

export async function GET() {
    try {
        const status = await verificarStatus()
        return NextResponse.json(status)
    } catch (error) {
        console.error('Erro ao verificar status:', error)
        return NextResponse.json(
            { connected: false, state: 'error', message: 'Erro ao conectar com Evolution API' },
            { status: 500 }
        )
    }
}
