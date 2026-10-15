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
      categorias: {
        Row: {
          id: string
          tenant_id: string
          nome: string
          cor: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string
          nome: string
          cor?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          nome?: string
          cor?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'categorias_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      clientes: {
        Row: {
          id: string
          tenant_id: string
          nome: string
          whatsapp: string
          endereco_completo: string
          lat: number | null
          lng: number | null
          cpf: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string
          nome: string
          whatsapp: string
          endereco_completo: string
          lat?: number | null
          lng?: number | null
          cpf?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          nome?: string
          whatsapp?: string
          endereco_completo?: string
          lat?: number | null
          lng?: number | null
          cpf?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'clientes_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      configuracoes: {
        Row: {
          id: string
          tenant_id: string
          nome_empresa: string | null
          cnpj: string | null
          endereco: string | null
          telefone: string | null
          email: string | null
          pix_tipo: string | null
          pix_chave: string | null
          pix_nome: string | null
          pix_banco: string | null
          google_place_id: string | null
          whatsapp_instance: string | null
          mensagem_boas_vindas: string | null
          whatsapp_proprietario: string | null
          preco_km: number | null
          frete_minimo: number | null
          cidade: string | null
          estado: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string
          nome_empresa?: string | null
          cnpj?: string | null
          endereco?: string | null
          telefone?: string | null
          email?: string | null
          pix_tipo?: string | null
          pix_chave?: string | null
          pix_nome?: string | null
          pix_banco?: string | null
          google_place_id?: string | null
          whatsapp_instance?: string | null
          mensagem_boas_vindas?: string | null
          whatsapp_proprietario?: string | null
          preco_km?: number | null
          frete_minimo?: number | null
          cidade?: string | null
          estado?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          nome_empresa?: string | null
          cnpj?: string | null
          endereco?: string | null
          telefone?: string | null
          email?: string | null
          pix_tipo?: string | null
          pix_chave?: string | null
          pix_nome?: string | null
          pix_banco?: string | null
          google_place_id?: string | null
          whatsapp_instance?: string | null
          mensagem_boas_vindas?: string | null
          whatsapp_proprietario?: string | null
          preco_km?: number | null
          frete_minimo?: number | null
          cidade?: string | null
          estado?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'configuracoes_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: true
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      despesas: {
        Row: {
          id: string
          tenant_id: string
          descricao: string
          categoria: string
          valor: number
          data: string
          pedido_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string
          descricao: string
          categoria?: string
          valor: number
          data: string
          pedido_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          descricao?: string
          categoria?: string
          valor?: number
          data?: string
          pedido_id?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'despesas_pedido_id_fkey'
            columns: ['pedido_id']
            isOneToOne: false
            referencedRelation: 'pedidos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'despesas_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      itens_pedido: {
        Row: {
          id: string
          tenant_id: string
          pedido_id: string
          produto_id: string
          quantidade: number
          preco_unitario: number
        }
        Insert: {
          id?: string
          tenant_id?: string
          pedido_id: string
          produto_id: string
          quantidade: number
          preco_unitario: number
        }
        Update: {
          id?: string
          tenant_id?: string
          pedido_id?: string
          produto_id?: string
          quantidade?: number
          preco_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: 'itens_pedido_pedido_id_fkey'
            columns: ['pedido_id']
            isOneToOne: false
            referencedRelation: 'pedidos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'itens_pedido_produto_id_fkey'
            columns: ['produto_id']
            isOneToOne: false
            referencedRelation: 'produtos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'itens_pedido_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      notificacoes: {
        Row: {
          id: string
          tenant_id: string
          tipo: string
          titulo: string
          mensagem: string | null
          pedido_id: string | null
          lida: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string
          tipo: string
          titulo: string
          mensagem?: string | null
          pedido_id?: string | null
          lida?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          tipo?: string
          titulo?: string
          mensagem?: string | null
          pedido_id?: string | null
          lida?: boolean | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'notificacoes_pedido_id_fkey'
            columns: ['pedido_id']
            isOneToOne: false
            referencedRelation: 'pedidos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notificacoes_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      pagamentos: {
        Row: {
          id: string
          tenant_id: string
          pedido_id: string
          valor: number
          metodo: string | null
          observacao: string | null
          data_pagamento: string
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string
          pedido_id: string
          valor: number
          metodo?: string | null
          observacao?: string | null
          data_pagamento: string
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          pedido_id?: string
          valor?: number
          metodo?: string | null
          observacao?: string | null
          data_pagamento?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'pagamentos_pedido_id_fkey'
            columns: ['pedido_id']
            isOneToOne: false
            referencedRelation: 'pedidos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pagamentos_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      pedidos: {
        Row: {
          id: string
          tenant_id: string
          cliente_id: string
          data_evento: string
          data_fim_evento: string
          hora_entrega: string | null
          status: StatusPedido
          total_pedido: number
          frete: number | null
          distancia_km: number | null
          data_entrega: string | null
          data_recolhimento: string | null
          observacoes: string | null
          assinatura_url: string | null
          usar_endereco_residencial: boolean | null
          endereco_evento: string | null
          valor_pago: number | null
          data_vencimento: string | null
          inadimplente: boolean | null
          desconto_tipo: 'percentual' | 'valor' | 'preco_final' | null
          desconto_valor: number | null
          desconto_escopo: 'pedido' | 'produto' | null
          desconto_produto_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string
          cliente_id: string
          data_evento: string
          data_fim_evento?: string
          hora_entrega?: string | null
          status?: StatusPedido
          total_pedido?: number
          frete?: number | null
          distancia_km?: number | null
          data_entrega?: string | null
          data_recolhimento?: string | null
          observacoes?: string | null
          assinatura_url?: string | null
          usar_endereco_residencial?: boolean | null
          endereco_evento?: string | null
          valor_pago?: number | null
          data_vencimento?: string | null
          inadimplente?: boolean | null
          desconto_tipo?: 'percentual' | 'valor' | 'preco_final' | null
          desconto_valor?: number | null
          desconto_escopo?: 'pedido' | 'produto' | null
          desconto_produto_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          cliente_id?: string
          data_evento?: string
          data_fim_evento?: string
          hora_entrega?: string | null
          status?: StatusPedido
          total_pedido?: number
          frete?: number | null
          distancia_km?: number | null
          data_entrega?: string | null
          data_recolhimento?: string | null
          observacoes?: string | null
          assinatura_url?: string | null
          usar_endereco_residencial?: boolean | null
          endereco_evento?: string | null
          valor_pago?: number | null
          data_vencimento?: string | null
          inadimplente?: boolean | null
          desconto_tipo?: 'percentual' | 'valor' | 'preco_final' | null
          desconto_valor?: number | null
          desconto_escopo?: 'pedido' | 'produto' | null
          desconto_produto_id?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'pedidos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pedidos_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string
          email: string | null
          full_name: string
          is_owner: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          tenant_id: string
          email?: string | null
          full_name?: string
          is_owner?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          email?: string | null
          full_name?: string
          is_owner?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      produtos: {
        Row: {
          id: string
          tenant_id: string
          nome: string
          quantidade_total: number
          preco_unitario: number
          categoria: string
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string
          nome: string
          quantidade_total: number
          preco_unitario: number
          categoria: string
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          nome?: string
          quantidade_total?: number
          preco_unitario?: number
          categoria?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'produtos_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      public_access_tokens: {
        Row: {
          id: string
          tenant_id: string
          pedido_id: string
          kind: 'contrato' | 'orcamento'
          token_hash: string
          expires_at: string
          revoked_at: string | null
          created_by: string | null
          last_accessed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          pedido_id: string
          kind: 'contrato' | 'orcamento'
          token_hash: string
          expires_at: string
          revoked_at?: string | null
          created_by?: string | null
          last_accessed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          pedido_id?: string
          kind?: 'contrato' | 'orcamento'
          token_hash?: string
          expires_at?: string
          revoked_at?: string | null
          created_by?: string | null
          last_accessed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'public_access_tokens_pedido_id_fkey'
            columns: ['pedido_id']
            isOneToOne: false
            referencedRelation: 'pedidos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'public_access_tokens_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      rotas: {
        Row: {
          id: string
          tenant_id: string
          data: string
          motorista: string | null
          ordem_entregas: Json
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string
          data: string
          motorista?: string | null
          ordem_entregas?: Json
          status?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          data?: string
          motorista?: string | null
          ordem_entregas?: Json
          status?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'rotas_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      tenants: {
        Row: {
          id: string
          slug: string
          display_name: string
          owner_name: string
          owner_email: string | null
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          display_name?: string
          owner_name?: string
          owner_email?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          display_name?: string
          owner_name?: string
          owner_email?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_disponibilidade_periodo: {
        Args: { p_data_inicio: string; p_data_fim: string }
        Returns: {
          produto_id: string
          nome: string
          quantidade_total: number
          quantidade_reservada: number
          quantidade_disponivel: number
        }[]
      }
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
      editar_pedido_transacional: {
        Args: {
          p_pedido_id: string
          p_data_evento: string
          p_hora_entrega: string | null
          p_observacoes: string | null
          p_usar_endereco_residencial: boolean
          p_endereco_evento: string | null
          p_itens: Json
        }
        Returns: number
      }
      editar_pedido_periodo_transacional: {
        Args: {
          p_pedido_id: string
          p_data_evento: string
          p_data_fim_evento: string
          p_hora_entrega: string | null
          p_observacoes: string | null
          p_usar_endereco_residencial: boolean
          p_endereco_evento: string | null
          p_itens: Json
        }
        Returns: number
      }
      criar_pedido_transacional: {
        Args: {
          p_cliente_id: string
          p_data_evento: string
          p_hora_entrega: string | null
          p_observacoes: string | null
          p_frete: number
          p_distancia_km: number
          p_usar_endereco_residencial: boolean
          p_endereco_evento: string | null
          p_itens: Json
          p_pagamento_valor?: number
          p_pagamento_metodo?: string | null
        }
        Returns: string
      }
      criar_pedido_periodo_transacional: {
        Args: {
          p_cliente_id: string
          p_data_evento: string
          p_data_fim_evento: string
          p_hora_entrega: string | null
          p_observacoes: string | null
          p_frete: number
          p_distancia_km: number
          p_usar_endereco_residencial: boolean
          p_endereco_evento: string | null
          p_itens: Json
          p_pagamento_valor?: number
          p_pagamento_metodo?: string | null
        }
        Returns: string
      }
      atualizar_status_pedido_transacional: {
        Args: { p_pedido_id: string; p_status: StatusPedido }
        Returns: undefined
      }
      assinar_pedido_transacional: {
        Args: { p_pedido_id: string; p_assinatura_url: string; p_tenant_id?: string | null }
        Returns: undefined
      }
      registrar_pagamento_com_desconto: {
        Args: {
          p_pedido_id: string
          p_valor: number
          p_metodo: string
          p_observacao: string | null
          p_data_pagamento: string
          p_desconto_tipo: 'percentual' | 'valor' | 'preco_final' | null
          p_desconto_valor: number | null
          p_desconto_escopo: 'pedido' | 'produto' | null
          p_desconto_produto_id: string | null
        }
        Returns: number
      }
      calcular_saldo_devedor: {
        Args: {
          p_pedido_id: string
        }
        Returns: number
      }
      current_tenant_id: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      ensure_current_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
    }
    Enums: {
      status_pedido: StatusPedido
      categoria_produto: CategoriaProduto
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type TableName = keyof Database['public']['Tables']
export type TableRow<T extends TableName> = Database['public']['Tables'][T]['Row']
export type TableInsert<T extends TableName> = Database['public']['Tables'][T]['Insert']
export type TableUpdate<T extends TableName> = Database['public']['Tables'][T]['Update']

export type Categoria = TableRow<'categorias'>
export type CategoriaInsert = TableInsert<'categorias'>

export type Cliente = TableRow<'clientes'>
export type ClienteInsert = TableInsert<'clientes'>

export type Configuracao = TableRow<'configuracoes'>
export type ConfiguracaoInsert = TableInsert<'configuracoes'>
export type ConfiguracaoUpdate = TableUpdate<'configuracoes'>

export type Despesa = TableRow<'despesas'>
export type DespesaInsert = TableInsert<'despesas'>

export type ItemPedido = TableRow<'itens_pedido'>
export type ItemPedidoInsert = TableInsert<'itens_pedido'>

export type Notificacao = TableRow<'notificacoes'>
export type NotificacaoInsert = TableInsert<'notificacoes'>

export type Pagamento = TableRow<'pagamentos'>
export type PagamentoInsert = TableInsert<'pagamentos'>

export type Pedido = TableRow<'pedidos'>
export type PedidoInsert = TableInsert<'pedidos'>

export type Profile = TableRow<'profiles'>
export type Produto = TableRow<'produtos'>
export type ProdutoInsert = TableInsert<'produtos'>

export type PublicAccessToken = TableRow<'public_access_tokens'>
export type Rota = TableRow<'rotas'>
export type RotaInsert = TableInsert<'rotas'>
export type Tenant = TableRow<'tenants'>

export type PedidoComCliente = Pedido & {
  clientes: Cliente | null
}

export type PedidoCompleto = Pedido & {
  clientes: Cliente | null
  itens_pedido: (ItemPedido & {
    produtos: Produto | null
  })[]
}

export type DisponibilidadeProduto = {
  produto_id: string
  nome: string
  quantidade_total: number
  quantidade_reservada: number
  quantidade_disponivel: number
}

export type TenantContext = {
  profile: Profile
  tenant: Tenant
  configuracao: Configuracao | null
}
