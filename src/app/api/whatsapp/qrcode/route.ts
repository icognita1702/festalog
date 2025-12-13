import { NextResponse } from 'next/server'
import { obterQRCode } from '@/lib/evolution-api'

export async function GET() {
    try {
        const result = await obterQRCode()
        return NextResponse.json(result)
    } catch (error) {
        console.error('Erro ao obter QR Code:', error)
        return NextResponse.json(
            { error: 'Erro ao obter QR Code' },
            { status: 500 }
        )
    }
}
