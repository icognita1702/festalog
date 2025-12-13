import { NextResponse } from 'next/server'
import { criarInstancia } from '@/lib/evolution-api'

export async function POST() {
    try {
        const result = await criarInstancia()
        return NextResponse.json(result)
    } catch (error) {
        console.error('Erro ao criar instância:', error)
        return NextResponse.json(
            { error: 'Erro ao criar instância' },
            { status: 500 }
        )
    }
}
