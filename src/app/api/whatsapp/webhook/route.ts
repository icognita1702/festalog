import { NextRequest, NextResponse } from 'next/server'
import { processarMensagem, enviarMensagemBot } from '@/lib/whatsapp-bot'
import { WebhookMessage, extrairNumeroWhatsApp, extrairTextoMensagem } from '@/lib/evolution-api'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as WebhookMessage

        console.log('[Webhook] Evento recebido:', body.event)

        // Ignora eventos que não são mensagens recebidas
        if (body.event !== 'messages.upsert') {
            return NextResponse.json({ status: 'ignored', event: body.event })
        }

        // Ignora mensagens enviadas por nós mesmos
        if (body.data?.key?.fromMe) {
            return NextResponse.json({ status: 'ignored', reason: 'own_message' })
        }

        // Ignora mensagens de grupo
        if (body.data?.key?.remoteJid?.includes('@g.us')) {
            return NextResponse.json({ status: 'ignored', reason: 'group_message' })
        }

        const numero = extrairNumeroWhatsApp(body.data?.key?.remoteJid || '')
        const mensagem = extrairTextoMensagem(body.data?.message)
        const nomeContato = body.data?.pushName || 'Cliente'

        if (!numero || !mensagem) {
            return NextResponse.json({ status: 'ignored', reason: 'missing_data' })
        }

        console.log(`[Webhook] Mensagem de ${nomeContato} (${numero}): ${mensagem}`)

        // Processa a mensagem e gera resposta
        const resposta = await processarMensagem(numero, mensagem, nomeContato)

        // Envia a resposta
        const enviado = await enviarMensagemBot(numero, resposta)

        console.log(`[Webhook] Resposta ${enviado ? 'enviada' : 'FALHOU'}: ${resposta.substring(0, 50)}...`)

        return NextResponse.json({
            status: 'processed',
            from: numero,
            message: mensagem,
            response_sent: enviado,
        })
    } catch (error) {
        console.error('[Webhook] Erro ao processar:', error)
        return NextResponse.json(
            { status: 'error', message: 'Erro interno' },
            { status: 500 }
        )
    }
}

// Health check
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'WhatsApp Webhook',
        timestamp: new Date().toISOString(),
    })
}
