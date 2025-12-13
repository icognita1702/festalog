import { NextResponse } from 'next/server'
import { desconectar } from '@/lib/evolution-api'

export async function POST() {
    try {
        const success = await desconectar()
        return NextResponse.json({ success })
    } catch (error) {
        console.error('Erro ao desconectar:', error)
        return NextResponse.json(
            { error: 'Erro ao desconectar' },
            { status: 500 }
        )
    }
}
