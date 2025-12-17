#!/usr/bin/env npx tsx
/**
 * WhatsApp Message Interpreter - CLI Tool
 * 
 * Parses WhatsApp messages and extracts client/order information.
 * Uses regex for structured data and optionally Gemini AI for complex extraction.
 * 
 * Usage:
 *   npx tsx scripts/whatsapp-interpreter.ts messages.txt
 *   echo "messages" | npx tsx scripts/whatsapp-interpreter.ts --stdin
 *   npx tsx scripts/whatsapp-interpreter.ts messages.txt --use-ai
 *   npx tsx scripts/whatsapp-interpreter.ts messages.txt --create
 * 
 * Flags:
 *   --stdin    Read from stdin instead of file
 *   --use-ai   Use Gemini AI for complex text understanding
 *   --create   Auto-create client/order in Supabase
 *   --json     Output only JSON (machine-readable)
 */

import * as fs from 'fs'
import * as readline from 'readline'

// ============ Types ============

interface ParsedMessage {
    timestamp: Date
    sender: string
    content: string
}

interface RegexExtractionResult {
    cliente: {
        nome: string | null
        telefone: string | null
        endereco: string | null
    }
    pedido: {
        data_evento: string | null
        hora_evento: string | null
        itens: string[]
    }
    confianca: number
    metodo: 'regex' | 'ai' | 'hybrid'
}

// ============ Regex Patterns ============

const PATTERNS = {
    // WhatsApp message format: [HH:MM, DD/MM/YYYY] Name: Message
    message: /\[(\d{2}:\d{2}),\s*(\d{2}\/\d{2}\/\d{4})\]\s*([^:]+):\s*(.+)/,

    // Brazilian phone numbers
    phone: /(?:55)?(?:\s)?(?:\()?(\d{2})(?:\))?(?:\s)?(\d{4,5})(?:[-\s])?(\d{4})/g,

    // Dates: DD/MM, DD/MM/YYYY, dia DD
    dateExplicit: /(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/gi,
    dateRelative: /\b(amanh[ãa]|depois de amanh[ãa]|pr[oó]xim[oa]\s+(?:s[aá]bado|domingo|segunda|terça|quarta|quinta|sexta))\b/gi,

    // Times
    time: /(?:às?\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:h(?:oras)?|hrs?)?(?:\s*(?:da\s+)?(manh[ãa]|tarde|noite))?/gi,

    // Addresses
    address: /(?:rua|av(?:enida)?|travessa|alameda|praça)\s+[^,\n]+(?:,\s*\d+)?(?:\s*[-,]\s*[\w\s]+)?/gi,

    // Quantities and items
    quantity: /(\d+)\s*(?:x|unid(?:ades?)?|jogos?|conjuntos?)?\s*(mesa|cadeira|toalha|caixa|copos?|prataria|talheres?)/gi,

    // Store identifiers (to filter out)
    storeNames: /\b(lu\s*festas?|filipe|loja|empresa)\b/i
}

// ============ Regex Parser ============

function parseMessages(raw: string): ParsedMessage[] {
    const lines = raw.split('\n')
    const messages: ParsedMessage[] = []
    let currentMessage: ParsedMessage | null = null

    for (const line of lines) {
        const match = line.match(PATTERNS.message)

        if (match) {
            if (currentMessage) messages.push(currentMessage)

            const [, time, date, sender, content] = match
            const [day, month, year] = date.split('/')
            const [hour, minute] = time.split(':')

            currentMessage = {
                timestamp: new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute)),
                sender: sender.trim(),
                content: content.trim()
            }
        } else if (currentMessage && line.trim()) {
            // Continuation of previous message
            currentMessage.content += '\n' + line.trim()
        }
    }

    if (currentMessage) messages.push(currentMessage)
    return messages
}

function identifyClient(messages: ParsedMessage[]): string | null {
    // Count messages per sender
    const senderCounts = new Map<string, number>()

    for (const msg of messages) {
        senderCounts.set(msg.sender, (senderCounts.get(msg.sender) || 0) + 1)
    }

    // Find sender who is NOT the store
    for (const [sender] of senderCounts) {
        if (!PATTERNS.storeNames.test(sender)) {
            return sender
        }
    }

    // Fallback: first sender
    return messages[0]?.sender || null
}

function extractPhone(text: string): string | null {
    const matches = text.matchAll(PATTERNS.phone)
    for (const match of matches) {
        const [, ddd, part1, part2] = match
        return `55${ddd}${part1}${part2}`
    }
    return null
}

function extractDate(text: string): string | null {
    // Explicit dates first
    const dateMatch = text.match(PATTERNS.dateExplicit)
    if (dateMatch) {
        const currentYear = new Date().getFullYear()
        // Parse DD/MM or DD/MM/YYYY
        const parts = dateMatch[0].replace(/dia\s+/i, '').split('/')
        const day = parts[0].padStart(2, '0')
        const month = parts[1].padStart(2, '0')
        const year = parts[2] ? (parts[2].length === 2 ? '20' + parts[2] : parts[2]) : String(currentYear)
        return `${year}-${month}-${day}`
    }

    // Relative dates
    const relativeMatch = text.match(PATTERNS.dateRelative)
    if (relativeMatch) {
        const today = new Date()
        const relative = relativeMatch[0].toLowerCase()

        if (relative.includes('amanh')) {
            today.setDate(today.getDate() + 1)
        } else if (relative.includes('depois')) {
            today.setDate(today.getDate() + 2)
        }

        return today.toISOString().split('T')[0]
    }

    return null
}

function extractTime(text: string): string | null {
    const timeMatch = text.match(PATTERNS.time)
    if (timeMatch) {
        // Parse time from match
        const hourMatch = timeMatch[0].match(/(\d{1,2})/)
        if (hourMatch) {
            let hour = parseInt(hourMatch[1])
            const isPM = /tarde|noite/i.test(timeMatch[0])
            if (isPM && hour < 12) hour += 12
            return `${String(hour).padStart(2, '0')}:00`
        }
    }
    return null
}

function extractAddress(text: string): string | null {
    const match = text.match(PATTERNS.address)
    return match ? match[0].trim() : null
}

function extractItems(text: string): string[] {
    const items: string[] = []
    const matches = text.matchAll(PATTERNS.quantity)

    for (const match of matches) {
        const [, qty, item] = match
        items.push(`${qty} ${item.toLowerCase()}`)
    }

    return items
}

function extractWithRegex(messages: ParsedMessage[]): RegexExtractionResult {
    const clientName = identifyClient(messages)
    const allText = messages.map(m => m.content).join('\n')

    let phone: string | null = null
    let address: string | null = null
    let eventDate: string | null = null
    let eventTime: string | null = null
    const allItems: string[] = []

    for (const msg of messages) {
        // Skip store messages for extraction
        if (clientName && msg.sender !== clientName) continue

        const text = msg.content

        phone = phone || extractPhone(text)
        address = address || extractAddress(text)
        eventDate = eventDate || extractDate(text)
        eventTime = eventTime || extractTime(text)
        allItems.push(...extractItems(text))
    }

    // Calculate confidence based on what was found
    let confidence = 0
    if (clientName) confidence += 0.2
    if (phone) confidence += 0.2
    if (eventDate) confidence += 0.2
    if (allItems.length > 0) confidence += 0.3
    if (address) confidence += 0.1

    return {
        cliente: {
            nome: clientName,
            telefone: phone,
            endereco: address
        },
        pedido: {
            data_evento: eventDate,
            hora_evento: eventTime,
            itens: [...new Set(allItems)] // Remove duplicates
        },
        confianca: Math.min(confidence, 1),
        metodo: 'regex'
    }
}

// ============ AI Enhancement (Optional) ============

async function enhanceWithAI(messages: ParsedMessage[], regexResult: RegexExtractionResult, apiKey: string): Promise<RegexExtractionResult> {
    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(apiKey)

        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 1500,
            }
        })

        const conversation = messages.map(m => `[${m.sender}]: ${m.content}`).join('\n')

        const prompt = `Analise esta conversa do WhatsApp e extraia informações:

${conversation}

Dados já extraídos por regex:
${JSON.stringify(regexResult, null, 2)}

Complete ou corrija os dados acima. Responda APENAS com JSON válido:
{
  "cliente": { "nome": "...", "telefone": "55XXXXXXXXXXX", "endereco": "..." },
  "pedido": { "data_evento": "YYYY-MM-DD", "hora_evento": "HH:MM", "itens": ["item1", "item2"] },
  "confianca": 0.0-1.0
}`

        const result = await model.generateContent(prompt)
        const response = result.response.text()

        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const aiResult = JSON.parse(jsonMatch[0])
            return {
                cliente: {
                    nome: aiResult.cliente?.nome || regexResult.cliente.nome,
                    telefone: aiResult.cliente?.telefone || regexResult.cliente.telefone,
                    endereco: aiResult.cliente?.endereco || regexResult.cliente.endereco
                },
                pedido: {
                    data_evento: aiResult.pedido?.data_evento || regexResult.pedido.data_evento,
                    hora_evento: aiResult.pedido?.hora_evento || regexResult.pedido.hora_evento,
                    itens: aiResult.pedido?.itens?.length > 0 ? aiResult.pedido.itens : regexResult.pedido.itens
                },
                confianca: aiResult.confianca || regexResult.confianca,
                metodo: 'hybrid'
            }
        }
    } catch (error) {
        console.error('AI enhancement failed, using regex results:', error)
    }

    return regexResult
}

// ============ Supabase Integration (Optional) ============

async function createInSupabase(result: RegexExtractionResult): Promise<void> {
    const { createClient } = await import('@supabase/supabase-js')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials in environment')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Create or find client
    let clienteId: string

    if (result.cliente.telefone) {
        const { data: existing } = await supabase
            .from('clientes')
            .select('id')
            .eq('whatsapp', result.cliente.telefone)
            .single()

        if (existing) {
            clienteId = existing.id
            console.log(`Found existing client: ${clienteId}`)
        } else {
            const { data: newClient, error } = await supabase
                .from('clientes')
                .insert({
                    nome: result.cliente.nome || 'Cliente WhatsApp',
                    whatsapp: result.cliente.telefone,
                    endereco_completo: result.cliente.endereco || ''
                })
                .select()
                .single()

            if (error) throw error
            clienteId = newClient.id
            console.log(`Created new client: ${clienteId}`)
        }
    } else if (result.cliente.nome) {
        const { data: newClient, error } = await supabase
            .from('clientes')
            .insert({
                nome: result.cliente.nome,
                whatsapp: '',
                endereco_completo: result.cliente.endereco || ''
            })
            .select()
            .single()

        if (error) throw error
        clienteId = newClient.id
        console.log(`Created new client: ${clienteId}`)
    } else {
        throw new Error('No client information to create')
    }

    // Create order
    const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
            cliente_id: clienteId,
            data_evento: result.pedido.data_evento || new Date().toISOString().split('T')[0],
            observacoes: `Importado do WhatsApp\nItens solicitados: ${result.pedido.itens.join(', ')}`,
            status: 'orcamento'
        })
        .select()
        .single()

    if (pedidoError) throw pedidoError
    console.log(`Created order: ${pedido.id}`)
}

// ============ CLI Interface ============

async function readStdin(): Promise<string> {
    return new Promise((resolve) => {
        let data = ''
        const rl = readline.createInterface({ input: process.stdin })
        rl.on('line', (line) => data += line + '\n')
        rl.on('close', () => resolve(data))
    })
}

async function main() {
    const args = process.argv.slice(2)

    const useStdin = args.includes('--stdin')
    const useAI = args.includes('--use-ai')
    const createOrder = args.includes('--create')
    const jsonOnly = args.includes('--json')

    const fileArg = args.find(a => !a.startsWith('--'))

    // Get input
    let input: string
    if (useStdin) {
        input = await readStdin()
    } else if (fileArg) {
        input = fs.readFileSync(fileArg, 'utf-8')
    } else {
        console.error('Usage: npx tsx whatsapp-interpreter.ts <file> [--stdin] [--use-ai] [--create] [--json]')
        process.exit(1)
    }

    // Parse messages
    const messages = parseMessages(input)

    if (!jsonOnly) {
        console.log(`\n📱 Parsed ${messages.length} messages`)
    }

    // Extract with regex
    let result = extractWithRegex(messages)

    if (!jsonOnly) {
        console.log(`\n📊 Regex extraction (confidence: ${(result.confianca * 100).toFixed(0)}%)`)
    }

    // Enhance with AI if requested
    if (useAI) {
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
        if (!apiKey) {
            console.error('⚠️  GOOGLE_GEMINI_API_KEY not set, skipping AI enhancement')
        } else {
            if (!jsonOnly) console.log('\n🤖 Enhancing with Gemini AI...')
            result = await enhanceWithAI(messages, result, apiKey)
            if (!jsonOnly) console.log(`✅ AI enhancement complete (confidence: ${(result.confianca * 100).toFixed(0)}%)`)
        }
    }

    // Create in Supabase if requested
    if (createOrder) {
        if (!jsonOnly) console.log('\n💾 Creating in Supabase...')
        try {
            await createInSupabase(result)
            if (!jsonOnly) console.log('✅ Created successfully')
        } catch (error) {
            console.error('❌ Failed to create:', error)
        }
    }

    // Output result
    if (jsonOnly) {
        console.log(JSON.stringify(result, null, 2))
    } else {
        console.log('\n📋 Result:')
        console.log(JSON.stringify(result, null, 2))
    }
}

main().catch(console.error)
