import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { issuePublicAccessToken } from '@/lib/public-access'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  await supabase.rpc('ensure_current_user_profile')

  const body = await request.json()
  const kind = body.kind as 'contrato' | 'orcamento'
  const pedidoId = body.pedidoId as string

  if (!pedidoId || (kind !== 'contrato' && kind !== 'orcamento')) {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil do tenant nao encontrado.' }, { status: 403 })
  }

  try {
    const token = await issuePublicAccessToken({
      tenantId: profile.tenant_id,
      pedidoId,
      kind,
      createdBy: user.id,
    })

    const pathname =
      kind === 'contrato'
        ? `/contrato/acesso/${token}`
        : `/templates/orcamento/acesso/${token}`

    return NextResponse.json({
      token,
      url: new URL(pathname, request.nextUrl.origin).toString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Nao foi possivel gerar o link publico.',
      },
      { status: 500 }
    )
  }
}
