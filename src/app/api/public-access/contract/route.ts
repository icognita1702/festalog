import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { resolvePublicAccessToken } from '@/lib/public-access'

function dataUrlToBuffer(dataUrl: string): Buffer {
  const [, base64Payload] = dataUrl.split(',')
  return Buffer.from(base64Payload, 'base64')
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const token = body.token as string
  const signatureDataUrl = body.signatureDataUrl as string

  if (!token || !signatureDataUrl?.startsWith('data:image/png;base64,')) {
    return NextResponse.json({ error: 'Assinatura invalida.' }, { status: 400 })
  }

  const payload = await resolvePublicAccessToken(token, 'contrato')

  if (!payload) {
    return NextResponse.json({ error: 'Link invalido ou expirado.' }, { status: 404 })
  }

  const admin = createAdminSupabaseClient()
  const fileName = `assinaturas/${payload.pedido.id}_${Date.now()}.png`
  const fileBuffer = dataUrlToBuffer(signatureDataUrl)

  const { error: uploadError } = await admin.storage
    .from('contratos')
    .upload(fileName, fileBuffer, { contentType: 'image/png', upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { error: updateError } = await admin
    .from('pedidos')
    .update({
      status: 'assinado',
      assinatura_url: fileName,
    })
    .eq('id', payload.pedido.id)
    .eq('tenant_id', payload.token.tenant_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
