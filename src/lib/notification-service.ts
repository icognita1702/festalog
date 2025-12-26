import { supabase } from '@/lib/supabase'
import { format, addDays, isBefore } from 'date-fns'

export type NotificationType = 'evento_proximo' | 'pagamento_pendente' | 'devolucao'

export interface Notificacao {
    id: string
    tipo: NotificationType
    titulo: string
    mensagem: string | null
    pedido_id: string | null
    lida: boolean
    created_at: string
}

/**
 * Gera notificações automáticas baseadas no estado atual dos pedidos
 */
export async function gerarNotificacoesAutomaticas(): Promise<number> {
    const hoje = new Date()
    const amanha = addDays(hoje, 1)
    const hojeStr = format(hoje, 'yyyy-MM-dd')
    const amanhaStr = format(amanha, 'yyyy-MM-dd')

    let notificacoesCriadas = 0

    try {
        // 1. Eventos Próximos (hoje ou amanhã)
        const { data: eventosProximos } = await (supabase as any)
            .from('pedidos')
            .select('id, data_evento, clientes(nome)')
            .in('data_evento', [hojeStr, amanhaStr])
            .not('status', 'in', '("finalizado","recolhido")')

        for (const pedido of eventosProximos || []) {
            const jaExiste = await verificarNotificacaoExistente(pedido.id, 'evento_proximo')
            if (!jaExiste) {
                const isHoje = pedido.data_evento === hojeStr
                await criarNotificacao({
                    tipo: 'evento_proximo',
                    titulo: isHoje ? '🚚 Entrega HOJE!' : '📅 Entrega amanhã',
                    mensagem: `Evento de ${pedido.clientes?.nome || 'Cliente'}`,
                    pedido_id: pedido.id,
                })
                notificacoesCriadas++
            }
        }

        // 2. Pagamentos Pendentes (pedidos não pagos integralmente)
        const { data: pedidosPendentes } = await (supabase as any)
            .from('pedidos')
            .select('id, total_pedido, valor_pago, data_evento, clientes(nome)')
            .lt('data_evento', hojeStr) // Evento já passou
            .not('status', 'eq', 'finalizado')

        for (const pedido of pedidosPendentes || []) {
            const valorPago = pedido.valor_pago || 0
            const saldoDevedor = pedido.total_pedido - valorPago
            if (saldoDevedor > 0.01) {
                const jaExiste = await verificarNotificacaoExistente(pedido.id, 'pagamento_pendente')
                if (!jaExiste) {
                    await criarNotificacao({
                        tipo: 'pagamento_pendente',
                        titulo: '💰 Pagamento pendente',
                        mensagem: `${pedido.clientes?.nome} - Saldo: R$ ${saldoDevedor.toFixed(2)}`,
                        pedido_id: pedido.id,
                    })
                    notificacoesCriadas++
                }
            }
        }

        // 3. Devoluções Pendentes (status = entregue há mais de 2 dias)
        const limiteDevolucao = format(addDays(hoje, -2), 'yyyy-MM-dd')
        const { data: devolucoesPendentes } = await (supabase as any)
            .from('pedidos')
            .select('id, data_evento, clientes(nome)')
            .eq('status', 'entregue')
            .lt('data_evento', limiteDevolucao)

        for (const pedido of devolucoesPendentes || []) {
            const jaExiste = await verificarNotificacaoExistente(pedido.id, 'devolucao')
            if (!jaExiste) {
                await criarNotificacao({
                    tipo: 'devolucao',
                    titulo: '⚠️ Devolução pendente',
                    mensagem: `Material de ${pedido.clientes?.nome} não recolhido`,
                    pedido_id: pedido.id,
                })
                notificacoesCriadas++
            }
        }
    } catch (error) {
        console.error('Erro ao gerar notificações:', error)
    }

    return notificacoesCriadas
}

async function verificarNotificacaoExistente(pedidoId: string, tipo: NotificationType): Promise<boolean> {
    const { data } = await (supabase as any)
        .from('notificacoes')
        .select('id')
        .eq('pedido_id', pedidoId)
        .eq('tipo', tipo)
        .eq('lida', false)
        .limit(1)

    return (data?.length || 0) > 0
}

async function criarNotificacao(notif: Omit<Notificacao, 'id' | 'lida' | 'created_at'>) {
    await (supabase as any)
        .from('notificacoes')
        .insert({
            tipo: notif.tipo,
            titulo: notif.titulo,
            mensagem: notif.mensagem,
            pedido_id: notif.pedido_id,
        })
}

/**
 * Busca notificações não lidas
 */
export async function getNotificacoesNaoLidas(): Promise<Notificacao[]> {
    const { data, error } = await (supabase as any)
        .from('notificacoes')
        .select('*')
        .eq('lida', false)
        .order('created_at', { ascending: false })
        .limit(20)

    if (error) {
        console.error('Erro ao buscar notificações:', error)
        return []
    }

    return data || []
}

/**
 * Marca notificação como lida
 */
export async function marcarComoLida(notificacaoId: string) {
    await (supabase as any)
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', notificacaoId)
}

/**
 * Marca todas as notificações como lidas
 */
export async function marcarTodasComoLidas() {
    await (supabase as any)
        .from('notificacoes')
        .update({ lida: true })
        .eq('lida', false)
}
