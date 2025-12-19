import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.length < 3) {
        return NextResponse.json({ suggestions: [] })
    }

    try {
        // Photon API - focado em Belo Horizonte
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=pt&lat=-19.92&lon=-43.94`

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'FestaLog/1.0'
            }
        })

        const data = await response.json()

        if (data.features && data.features.length > 0) {
            const suggestions = data.features
                .filter((f: any) => {
                    const country = f.properties?.country
                    return country === 'Brazil' || country === 'Brasil'
                })
                .map((f: any) => {
                    const props = f.properties
                    const parts: string[] = []

                    if (props.street) {
                        parts.push(props.housenumber ? `${props.street}, ${props.housenumber}` : props.street)
                    } else if (props.name) {
                        parts.push(props.name)
                    }

                    if (props.city) parts.push(props.city)
                    if (props.state) parts.push(props.state)

                    return parts.join(' - ')
                })
                .filter((addr: string) => addr.length > 0)

            return NextResponse.json({ suggestions })
        }

        return NextResponse.json({ suggestions: [] })
    } catch (error) {
        console.error('Erro ao buscar endereços:', error)
        return NextResponse.json({ suggestions: [] })
    }
}
