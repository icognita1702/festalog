import { describe, it, expect, vi, beforeEach } from 'vitest'
import { classificarIntencao } from '../gemini-agent'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Mock infrastructure
const generateContentMock = vi.fn()

vi.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: class {
            getGenerativeModel() {
                return {
                    generateContent: generateContentMock
                }
            }
        }
    }
})

describe('gemini-agent classification', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        // Default mock response
        generateContentMock.mockResolvedValue({
            response: { text: () => JSON.stringify({ intencao: 'geral', confianca: 0.9 }) }
        })
    })

    it('deve classificar via heurística local (rápido)', async () => {
        // Não deve chamar o Gemini para casos simples
        expect(await classificarIntencao('oi')).toBe('saudacao')
        expect(await classificarIntencao('qual o preço')).toBe('preco') // match keyword 'preço' ou 'preco'
        expect(await classificarIntencao('1')).toBe('disponibilidade')

        expect(generateContentMock).not.toHaveBeenCalled()
    })

    it('deve usar Gemini para frases complexas', async () => {
        // Configura resposta da IA
        generateContentMock.mockResolvedValueOnce({
            response: {
                text: () => JSON.stringify({ intencao: 'orcamento', confianca: 0.95 })
            }
        })

        const msg = "Estou planejando um evento para o fim do ano e preciso de umas coisas."
        const resultado = await classificarIntencao(msg)

        expect(resultado).toBe('orcamento')
        expect(generateContentMock).toHaveBeenCalledTimes(1)
    })

    it('deve fazer fallback gracefully se IA falhar', async () => {
        // IA retorna lixo
        generateContentMock.mockResolvedValueOnce({
            response: { text: () => "Error 500" }
        })

        const resultado = await classificarIntencao("Frase complexa que falha na IA")
        expect(resultado).toBe('geral')
    })
})
