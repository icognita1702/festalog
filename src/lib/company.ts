import type { Configuracao } from './database.types'

export type CompanyProfile = {
  nomeEmpresa: string
  documento: string
  endereco: string
  telefone: string
  email: string
  pixTipo: string
  pixChave: string
  pixNome: string
  pixBanco: string
  googlePlaceId: string
  googleReviewLink: string
  whatsappProprietario: string
  precoKm: number
  freteMinimo: number
  cidade: string
  estado: string
  saudacaoWhatsApp: string
}

export function buildGoogleReviewLink(googlePlaceId: string): string {
  if (!googlePlaceId) {
    return ''
  }

  return `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
}

export function getCompanyProfile(configuracao: Configuracao | null | undefined): CompanyProfile {
  const cidade = configuracao?.cidade?.trim() || ''
  const estado = configuracao?.estado?.trim() || ''

  return {
    nomeEmpresa: configuracao?.nome_empresa?.trim() || 'Sua locadora',
    documento: configuracao?.cnpj?.trim() || '',
    endereco: configuracao?.endereco?.trim() || '',
    telefone: configuracao?.telefone?.trim() || '',
    email: configuracao?.email?.trim() || '',
    pixTipo: configuracao?.pix_tipo?.trim() || '',
    pixChave: configuracao?.pix_chave?.trim() || '',
    pixNome: configuracao?.pix_nome?.trim() || '',
    pixBanco: configuracao?.pix_banco?.trim() || '',
    googlePlaceId: configuracao?.google_place_id?.trim() || '',
    googleReviewLink: buildGoogleReviewLink(configuracao?.google_place_id?.trim() || ''),
    whatsappProprietario: configuracao?.whatsapp_proprietario?.trim() || '',
    precoKm: Number(configuracao?.preco_km ?? 0),
    freteMinimo: Number(configuracao?.frete_minimo ?? 0),
    cidade,
    estado,
    saudacaoWhatsApp:
      configuracao?.mensagem_boas_vindas?.trim() || 'Ola! Como posso ajudar com a sua locacao?',
  }
}

export function formatBaseAddress(profile: CompanyProfile): string {
  const parts = [profile.endereco, profile.cidade, profile.estado].filter(Boolean)
  return parts.join(', ')
}
