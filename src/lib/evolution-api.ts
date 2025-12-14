const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080'
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'lufestas_evolution_key_2024'
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'lufestas'

interface SendMessageParams {
    number: string
    text: string
}

interface EvolutionResponse {
    key: {
        remoteJid: string
        fromMe: boolean
        id: string
    }
    message: {
        extendedTextMessage?: {
            text: string
        }
        conversation?: string
    }
    messageTimestamp: string
    status: string
}

export async function enviarMensagem({ number, text }: SendMessageParams): Promise<boolean> {
    try {
        // Formata o número (remove caracteres especiais)
        const formattedNumber = number.replace(/\D/g, '')

        const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
                number: formattedNumber,
                textMessage: {
                    text: text
                }
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('Erro ao enviar mensagem:', error)
            return false
        }

        return true
    } catch (error) {
        console.error('Erro ao enviar mensagem via Evolution API:', error)
        return false
    }
}

export async function criarInstancia(): Promise<{ qrcode?: string; error?: string }> {
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
                instanceName: EVOLUTION_INSTANCE,
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS',
            }),
        })

        const data = await response.json()

        if (data.qrcode) {
            return { qrcode: data.qrcode.base64 }
        }

        return { error: data.message || 'Erro ao criar instância' }
    } catch (error) {
        console.error('Erro ao criar instância:', error)
        return { error: 'Erro de conexão com Evolution API' }
    }
}

export async function obterQRCode(): Promise<{ qrcode?: string; connected?: boolean; error?: string }> {
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE}`, {
            method: 'GET',
            headers: {
                'apikey': EVOLUTION_API_KEY,
            },
        })

        const data = await response.json()

        if (data.base64) {
            return { qrcode: data.base64 }
        }

        if (data.instance?.state === 'open') {
            return { connected: true }
        }

        return { error: data.message || 'Instância não encontrada' }
    } catch (error) {
        console.error('Erro ao obter QR Code:', error)
        return { error: 'Erro de conexão com Evolution API' }
    }
}

export async function verificarStatus(): Promise<{ connected: boolean; state: string }> {
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`, {
            method: 'GET',
            headers: {
                'apikey': EVOLUTION_API_KEY,
            },
        })

        const data = await response.json()

        return {
            connected: data.instance?.state === 'open',
            state: data.instance?.state || 'unknown',
        }
    } catch (error) {
        console.error('Erro ao verificar status:', error)
        return { connected: false, state: 'error' }
    }
}

export async function desconectar(): Promise<boolean> {
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/logout/${EVOLUTION_INSTANCE}`, {
            method: 'DELETE',
            headers: {
                'apikey': EVOLUTION_API_KEY,
            },
        })

        return response.ok
    } catch (error) {
        console.error('Erro ao desconectar:', error)
        return false
    }
}

// Tipos para webhooks
export interface WebhookMessage {
    event: string
    instance: string
    data: {
        key: {
            remoteJid: string
            fromMe: boolean
            id: string
        }
        pushName?: string
        message?: {
            conversation?: string
            extendedTextMessage?: {
                text: string
            }
        }
        messageType?: string
        messageTimestamp?: number
    }
}

export function extrairNumeroWhatsApp(remoteJid: string): string {
    // Remove @s.whatsapp.net do final
    return remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')
}

export function extrairTextoMensagem(message: WebhookMessage['data']['message']): string {
    if (!message) return ''
    return message.conversation || message.extendedTextMessage?.text || ''
}
