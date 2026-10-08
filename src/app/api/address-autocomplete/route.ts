import { NextRequest, NextResponse } from 'next/server'

type PhotonFeature = {
  properties?: {
    country?: string
    street?: string
    housenumber?: string
    name?: string
    city?: string
    state?: string
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')

  if (!query || query.length < 3) {
    return NextResponse.json({ suggestions: [] })
  }

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=pt`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FestaLog/1.0',
      },
    })

    const data = (await response.json()) as { features?: PhotonFeature[] }
    const suggestions =
      data.features
        ?.filter((feature) => {
          const country = feature.properties?.country
          return !country || country === 'Brazil' || country === 'Brasil'
        })
        .map((feature) => {
          const props = feature.properties
          const parts: string[] = []

          if (props?.street) {
            parts.push(props.housenumber ? `${props.street}, ${props.housenumber}` : props.street)
          } else if (props?.name) {
            parts.push(props.name)
          }

          if (props?.city) {
            parts.push(props.city)
          }

          if (props?.state) {
            parts.push(props.state)
          }

          return parts.join(' - ')
        })
        .filter((address) => address.length > 0) ?? []

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Erro ao buscar enderecos:', error)
    return NextResponse.json({ suggestions: [] })
  }
}
