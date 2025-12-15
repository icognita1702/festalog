import * as XLSX from 'xlsx'
import { format } from 'date-fns'

// Types
export interface PedidoExport {
    id: string
    data_evento: string
    status: string
    total_pedido: number
    created_at: string
    observacoes?: string
    clientes?: {
        nome: string
        whatsapp: string
        endereco_completo: string
    }
}

export interface ClienteExport {
    id: string
    nome: string
    whatsapp: string
    endereco_completo: string
    cpf?: string
    created_at: string
    totalPedidos?: number
    totalGasto?: number
}

export interface ProdutoExport {
    id: string
    nome: string
    categoria: string
    quantidade_total: number
    preco_unitario: number
    quantidadeAlugada?: number
    receitaGerada?: number
}

export interface ResumoMensal {
    mes: string
    faturamento: number
    qtdPedidos: number
    ticketMedio: number
    clientesNovos: number
}

// Status labels em português
const statusLabels: Record<string, string> = {
    orcamento: 'Orçamento',
    contrato_enviado: 'Contrato Enviado',
    assinado: 'Assinado',
    pago_50: 'Pago 50%',
    entregue: 'Entregue',
    recolhido: 'Recolhido',
    finalizado: 'Finalizado',
}

// Formatar moeda
function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

// Exportar dados para XLS
export function exportToExcel(
    resumo: ResumoMensal[],
    pedidos: PedidoExport[],
    clientes: ClienteExport[],
    produtos: ProdutoExport[],
    mesAno?: string
) {
    const wb = XLSX.utils.book_new()

    // Aba 1: Resumo Mensal
    const resumoData = resumo.map(r => ({
        'Mês/Ano': r.mes,
        'Faturamento': formatCurrency(r.faturamento),
        'Qtd Pedidos': r.qtdPedidos,
        'Ticket Médio': formatCurrency(r.ticketMedio),
        'Clientes Novos': r.clientesNovos,
    }))
    const wsResumo = XLSX.utils.json_to_sheet(resumoData)
    wsResumo['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

    // Aba 2: Pedidos
    const pedidosData = pedidos.map(p => ({
        'ID': p.id.substring(0, 8),
        'Data Evento': format(new Date(p.data_evento), 'dd/MM/yyyy'),
        'Cliente': p.clientes?.nome || 'N/A',
        'WhatsApp': p.clientes?.whatsapp || 'N/A',
        'Status': statusLabels[p.status] || p.status,
        'Total': formatCurrency(p.total_pedido),
        'Observações': p.observacoes || '',
        'Criado em': format(new Date(p.created_at), 'dd/MM/yyyy HH:mm'),
    }))
    const wsPedidos = XLSX.utils.json_to_sheet(pedidosData)
    wsPedidos['!cols'] = [
        { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 15 },
        { wch: 18 }, { wch: 15 }, { wch: 30 }, { wch: 18 }
    ]
    XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos')

    // Aba 3: Clientes
    const clientesData = clientes.map(c => ({
        'Nome': c.nome,
        'WhatsApp': c.whatsapp,
        'Endereço': c.endereco_completo,
        'CPF': c.cpf || 'N/A',
        'Total Pedidos': c.totalPedidos || 0,
        'Total Gasto': formatCurrency(c.totalGasto || 0),
        'Cadastrado em': format(new Date(c.created_at), 'dd/MM/yyyy'),
    }))
    const wsClientes = XLSX.utils.json_to_sheet(clientesData)
    wsClientes['!cols'] = [
        { wch: 25 }, { wch: 15 }, { wch: 40 }, { wch: 15 },
        { wch: 14 }, { wch: 15 }, { wch: 14 }
    ]
    XLSX.utils.book_append_sheet(wb, wsClientes, 'Clientes')

    // Aba 4: Produtos
    const produtosData = produtos.map(p => ({
        'Nome': p.nome,
        'Categoria': p.categoria,
        'Estoque Total': p.quantidade_total,
        'Preço Unitário': formatCurrency(p.preco_unitario),
        'Qtd Alugada': p.quantidadeAlugada || 0,
        'Receita Gerada': formatCurrency(p.receitaGerada || 0),
    }))
    const wsProdutos = XLSX.utils.json_to_sheet(produtosData)
    wsProdutos['!cols'] = [
        { wch: 30 }, { wch: 15 }, { wch: 14 }, { wch: 15 },
        { wch: 14 }, { wch: 15 }
    ]
    XLSX.utils.book_append_sheet(wb, wsProdutos, 'Produtos')

    // Nome do arquivo
    const fileName = mesAno
        ? `FestaLog_Relatorio_${mesAno.replace('/', '-')}.xlsx`
        : `FestaLog_Relatorio_${format(new Date(), 'yyyy-MM-dd')}.xlsx`

    // Download
    XLSX.writeFile(wb, fileName)
}
