import 'server-only'

import { createHash, randomBytes } from 'crypto'
import { createAdminSupabaseClient } from './supabase-admin'
import type { PedidoCompleto, PublicAccessToken } from './database.types'

type TokenKind = 'contrato' | 'orcamento'

export type PublicAccessPayload = {
  token: PublicAccessToken
  pedido: PedidoCompleto
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString('hex')
}

export async function issuePublicAccessToken(params: {
  tenantId: string
  pedidoId: string
  kind: TokenKind
  createdBy: string
  expiresInHours?: number
}) {
  const admin = createAdminSupabaseClient()
  const rawToken = createOpaqueToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + (params.expiresInHours ?? 24 * 7) * 60 * 60 * 1000).toISOString()

  const { error } = await admin.from('public_access_tokens').insert({
    tenant_id: params.tenantId,
    pedido_id: params.pedidoId,
    kind: params.kind,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_by: params.createdBy,
  })

  if (error) {
    throw error
  }

  return rawToken
}

export async function resolvePublicAccessToken(token: string, kind: TokenKind): Promise<PublicAccessPayload | null> {
  const admin = createAdminSupabaseClient()
  const tokenHash = hashToken(token)
  const nowIso = new Date().toISOString()

  const { data: tokenRow, error: tokenError } = await admin
    .from('public_access_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .eq('kind', kind)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle<PublicAccessToken>()

  if (tokenError || !tokenRow) {
    return null
  }

  const { data: pedido, error: pedidoError } = await admin
    .from('pedidos')
    .select('*, clientes(*), itens_pedido(*, produtos(*))')
    .eq('id', tokenRow.pedido_id)
    .eq('tenant_id', tokenRow.tenant_id)
    .single<PedidoCompleto>()

  if (pedidoError || !pedido) {
    return null
  }

  await admin
    .from('public_access_tokens')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  return {
    token: tokenRow,
    pedido,
  }
}
