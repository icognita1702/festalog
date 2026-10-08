export interface FreightConfig {
  storeAddress: string
  pricePerKm: number
  minimumFreight: number
  city?: string
  state?: string
}

const coordinatesCache = new Map<string, [number, number]>()

function buildSearchAddress(address: string, config: FreightConfig): string {
  if (address.toLowerCase().includes('brasil')) {
    return address
  }

  const suffix = [config.city, config.state, 'Brasil'].filter(Boolean).join(', ')
  return suffix ? `${address}, ${suffix}` : address
}

export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const cached = coordinatesCache.get(address)
  if (cached) {
    return cached
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=br&limit=1`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FestaLog/1.0',
      },
    })
    const data = (await response.json()) as Array<{ lon: string; lat: string }>

    if (!data.length) {
      return null
    }

    const coordinates: [number, number] = [Number(data[0].lon), Number(data[0].lat)]
    coordinatesCache.set(address, coordinates)
    return coordinates
  } catch (error) {
    console.error('Error geocoding address:', error)
    return null
  }
}

export async function calculateDistance(
  origin: [number, number],
  destination: [number, number]
): Promise<number | null> {
  try {
    const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`

    const response = await fetch(url)
    const data = (await response.json()) as {
      code?: string
      routes?: Array<{ distance: number }>
    }

    if (data.code !== 'Ok' || !data.routes?.length) {
      return null
    }

    const distanceKm = data.routes[0].distance / 1000
    return Math.round(distanceKm * 10) / 10
  } catch (error) {
    console.error('Error calculating distance:', error)
    return null
  }
}

export function calculateFreightFromDistance(distanceKm: number, config: FreightConfig): number {
  const calculated = distanceKm * config.pricePerKm
  return Math.max(calculated, config.minimumFreight)
}

export async function calculateFreightForAddress(
  customerAddress: string,
  config: FreightConfig
): Promise<{ distanceKm: number; freight: number } | null> {
  try {
    const storeCoords = await geocodeAddress(buildSearchAddress(config.storeAddress, config))
    if (!storeCoords) {
      return null
    }

    const customerCoords = await geocodeAddress(buildSearchAddress(customerAddress, config))
    if (!customerCoords) {
      return null
    }

    const distanceKm = await calculateDistance(storeCoords, customerCoords)
    if (distanceKm === null) {
      return null
    }

    return {
      distanceKm,
      freight: calculateFreightFromDistance(distanceKm, config),
    }
  } catch (error) {
    console.error('Error calculating freight:', error)
    return null
  }
}

export function getDefaultFreightConfig(): FreightConfig {
  return {
    storeAddress: '',
    pricePerKm: 0,
    minimumFreight: 0,
    city: '',
    state: '',
  }
}
