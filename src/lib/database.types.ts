export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type StatusPedido =
    | 'orcamento'
    | 'contrato_enviado'
    | 'assinado'
    | 'pago_50'
    | 'entregue'
    | 'recolhido'
    | 'finalizado'

export type CategoriaProduto =
    | 'mesas'
    | 'cadeiras'
    | 'toalhas'
    | 'caixa_termica'
    | 'outros'

export interface Database {
    public: {
        Tables: {
            clientes: {
                Row: {
                    id: string
                    nome: string
                    whatsapp: string
                    endereco_completo: string
                    lat: number | null
                    lng: number | null
                    cpf: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    nome: string
                    whatsapp: string
                    endereco_completo: string
                    lat?: number | null
                    lng?: number | null
                    cpf?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    nome?: string
                    whatsapp?: string
                    endereco_completo?: string
                    lat?: number | null
                    lng?: number | null
                    cpf?: string | null
                    created_at?: string
                }
            }
            produtos: {
                Row: {
                    id: string
                    nome: string
                    quantidade_total: number
                    preco_unitario: number
                    categoria: CategoriaProduto
                    created_at: string
                }
                Insert: {
                    id?: string
                    nome: string
                    quantidade_total: number
                    preco_unitario: number
                    categoria: CategoriaProduto
                    created_at?: string
                }
                Update: {
                    id?: string
                    nome?: string
                    quantidade_total?: number
                    preco_unitario?: number
                    categoria?: CategoriaProduto
                    created_at?: string
                }
            }
            pedidos: {
                Row: {
                    id: string
                    cliente_id: string
                    data_evento: string
                    status: StatusPedido
                    total_pedido: number
                    data_entrega: string | null
                    data_recolhimento: string | null
                    observacoes: string | null
                    assinatura_url: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    cliente_id: string
                    data_evento: string
                    status?: StatusPedido
                    total_pedido?: number
                    data_entrega?: string | null
                    data_recolhimento?: string | null
                    observacoes?: string | null
                    assinatura_url?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    cliente_id?: string
                    data_evento?: string
                    status?: StatusPedido
                    total_pedido?: number
                    data_entrega?: string | null
                    data_recolhimento?: string | null
                    observacoes?: string | null
                    assinatura_url?: string | null
                    created_at?: string
                }
            }
            itens_pedido: {
                Row: {
                    id: string
                    pedido_id: string
                    produto_id: string
                    quantidade: number
                    preco_unitario: number
                }
                Insert: {
                    id?: string
                    pedido_id: string
                    produto_id: string
                    quantidade: number
                    preco_unitario: number
                }
                Update: {
                    id?: string
                    pedido_id?: string
                    produto_id?: string
                    quantidade?: number
                    preco_unitario?: number
                }
            }
            rotas: {
                Row: {
                    id: string
                    data: string
                    motorista: string | null
                    ordem_entregas: Json
                    status: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    data: string
                    motorista?: string | null
                    ordem_entregas?: Json
                    status?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    data?: string
                    motorista?: string | null
                    ordem_entregas?: Json
                    status?: string
                    created_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            calcular_disponibilidade: {
                Args: {
                    data_consulta: string
                }
                Returns: {
                    produto_id: string
                    nome: string
                    quantidade_total: number
                    quantidade_reservada: number
                    quantidade_disponivel: number
                }[]
            }
        }
        Enums: {
            status_pedido: StatusPedido
            categoria_produto: CategoriaProduto
        }
    }
}

// Types auxiliares
export type Cliente = Database['public']['Tables']['clientes']['Row']
export type ClienteInsert = Database['public']['Tables']['clientes']['Insert']

export type Produto = Database['public']['Tables']['produtos']['Row']
export type ProdutoInsert = Database['public']['Tables']['produtos']['Insert']

export type Pedido = Database['public']['Tables']['pedidos']['Row']
export type PedidoInsert = Database['public']['Tables']['pedidos']['Insert']

export type ItemPedido = Database['public']['Tables']['itens_pedido']['Row']
export type ItemPedidoInsert = Database['public']['Tables']['itens_pedido']['Insert']

export type Rota = Database['public']['Tables']['rotas']['Row']
export type RotaInsert = Database['public']['Tables']['rotas']['Insert']

// Types para joins
export type PedidoComCliente = Pedido & {
    clientes: Cliente
}

export type PedidoCompleto = Pedido & {
    clientes: Cliente
    itens_pedido: (ItemPedido & {
        produtos: Produto
    })[]
}

export type DisponibilidadeProduto = {
    produto_id: string
    nome: string
    quantidade_total: number
    quantidade_reservada: number
    quantidade_disponivel: number
}
