import { NextRequest, NextResponse } from 'next/server'
import { enviarMensagem } from '@/lib/evolution-api'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { number, text } = body

        if (!number || !text) {
            return NextResponse.json(
                { error: 'Número e texto são obrigatórios' },
                { status: 400 }
            )
        }

        const success = await enviarMensagem({ number, text })

        if (success) {
            return NextResponse.json({ success: true, message: 'Mensagem enviada com sucesso' })
        } else {
            return NextResponse.json(
                { error: 'Falha ao enviar mensagem. Verifique se o WhatsApp está conectado.' },
                { status: 500 }
            )
        }
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error)
        return NextResponse.json(
            { error: 'Erro interno ao enviar mensagem' },
            { status: 500 }
        )
    }
}
