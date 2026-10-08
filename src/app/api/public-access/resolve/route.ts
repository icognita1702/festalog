import { NextRequest, NextResponse } from 'next/server'
import { resolvePublicAccessToken } from '@/lib/public-access'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const kind = request.nextUrl.searchParams.get('kind') as 'contrato' | 'orcamento' | null

  if (!token || (kind !== 'contrato' && kind !== 'orcamento')) {
    return NextResponse.json({ error: 'Token invalido.' }, { status: 400 })
  }

  const payload = await resolvePublicAccessToken(token, kind)

  if (!payload) {
    return NextResponse.json({ error: 'Link invalido ou expirado.' }, { status: 404 })
  }

  const admin = createAdminSupabaseClient()
  const { data: configuracao } = await admin
    .from('configuracoes')
    .select('*')
    .eq('tenant_id', payload.token.tenant_id)
    .maybeSingle()

  return NextResponse.json({
    pedido: payload.pedido,
    configuracao,
    expiresAt: payload.token.expires_at,
  })
}
