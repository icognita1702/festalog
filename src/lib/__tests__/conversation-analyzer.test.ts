import { describe, it, expect, vi } from 'vitest'
import { extractDataFromConversation } from '../conversation-analyzer'

// Variável para capturar a função de geração
let mockGenerateContent = vi.fn().mockResolvedValue({
    response: { text: () => JSON.stringify({}) }
})

vi.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: class {
            getGenerativeModel() {
                return {
                    generateContent: mockGenerateContent
                }
            }
        }
    }
})

describe('conversation-analyzer', () => {
    const apiKey = 'fake'

    it('deve lidar com JSON inválido (retornar empty result)', async () => {
        // Simula falha/retorno vazio que falha no Zod
        mockGenerateContent.mockResolvedValue({
            response: { text: () => "{}" }
        })

        const result = await extractDataFromConversation('Teste de conversa longa...', apiKey)
        // Se falhar validação, retorna empty result com confianca 0
        expect(result.confianca).toBe(0)
    })

    it('deve extrair dados corretamente quando a IA retorna JSON válido', async () => {
        const mockData = {
            cliente: {
                nome: "Teste Silva",
                telefone: "5531999999999",
                endereco: "Rua Teste",
                email: "teste@email.com"
            },
            pedido: {
                data_evento: "2023-12-25",
                hora_evento: "14:00",
                itens: ["Mesa"],
                tipo_festa: "Natal",
                observacoes: "Obs",
                valor_estimado: 100
            },
            confianca: 1,
            resumo: "Resumo valido"
        }

        mockGenerateContent.mockResolvedValue({
            response: { text: () => JSON.stringify(mockData) }
        })

        const result = await extractDataFromConversation('Teste de conversa longa...', apiKey)

        expect(result.cliente.nome).toBe("Teste Silva")
        expect(result.confianca).toBe(1)
    })
})
