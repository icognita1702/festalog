import { NextRequest, NextResponse } from 'next/server'
import { extractDataFromConversation } from '@/lib/conversation-analyzer'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { conversation } = body

        if (!conversation || typeof conversation !== 'string') {
            return NextResponse.json(
                { error: 'Conversa não fornecida ou inválida' },
                { status: 400 }
            )
        }

        // Verifica se conversa tem conteúdo mínimo
        if (conversation.trim().length < 50) {
            return NextResponse.json(
                { error: 'Conversa muito curta. Cole mais conteúdo.' },
                { status: 400 }
            )
        }

        // Obtém API key do ambiente
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Chave de API Gemini não configurada' },
                { status: 500 }
            )
        }

        // Extrai dados da conversa
        const result = await extractDataFromConversation(conversation, apiKey)

        // Verifica se extração teve sucesso mínimo
        if (result.confianca === 0 && !result.cliente.nome && result.pedido.itens.length === 0) {
            return NextResponse.json(
                {
                    error: 'Não foi possível extrair dados relevantes. Verifique se a conversa contém informações de cliente ou pedido.',
                    result
                },
                { status: 422 }
            )
        }

        return NextResponse.json({
            success: true,
            result
        })

    } catch (error) {
        console.error('Erro ao analisar conversa:', error)
        return NextResponse.json(
            { error: 'Erro interno ao processar conversa' },
            { status: 500 }
        )
    }
}
