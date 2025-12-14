/**
 * Freight Calculator
 * Calculates shipping cost based on distance from store to customer
 * Uses free APIs: Nominatim (geocoding) and OSRM (routing)
 */

export interface FreightConfig {
    storeAddress: string
    pricePerKm: number
    minimumFreight: number
}

// Store coordinates cache (keyed by address for multi-tenant support)
const coordinatesCache: Map<string, [number, number]> = new Map()

/**
 * Geocode an address to coordinates using Nominatim (OpenStreetMap)
 * @param address - Full address string
 * @returns [longitude, latitude] or null if not found
 */
export async function geocodeAddress(address: string): Promise<[number, number] | null> {
    // Check cache first
    const cached = coordinatesCache.get(address)
    if (cached) return cached

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=br&limit=1`
        const response = await fetch(url, {
            headers: { 'User-Agent': 'FestaLog/1.0' }
        })
        const data = await response.json()

        if (data && data.length > 0) {
            // Nominatim returns [lat, lon], we return [lon, lat] for OSRM
            const coords: [number, number] = [parseFloat(data[0].lon), parseFloat(data[0].lat)]
            coordinatesCache.set(address, coords)
            return coords
        }
        return null
    } catch (error) {
        console.error('Error geocoding address:', error)
        return null
    }
}

/**
 * Calculate driving distance between two points using OSRM
 * @param origin - [longitude, latitude]
 * @param destination - [longitude, latitude]
 * @returns Distance in kilometers or null if error
 */
export async function calculateDistance(
    origin: [number, number],
    destination: [number, number]
): Promise<number | null> {
    try {
        const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`

        const response = await fetch(url)
        const data = await response.json()

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            // OSRM returns distance in meters
            const distanceKm = data.routes[0].distance / 1000
            return Math.round(distanceKm * 10) / 10 // Round to 1 decimal
        }
        return null
    } catch (error) {
        console.error('Error calculating distance:', error)
        return null
    }
}

/**
 * Calculate freight cost based on distance
 * Formula: max(distance * pricePerKm, minimumFreight)
 * Freight is never free
 * @param distanceKm - Distance in kilometers
 * @param config - Freight configuration
 * @returns Freight cost in BRL
 */
export function calculateFreightFromDistance(distanceKm: number, config: FreightConfig): number {
    const calculated = distanceKm * config.pricePerKm
    return Math.max(calculated, config.minimumFreight)
}

/**
 * Calculate freight for a customer address
 * Main function to be used by the order form
 * @param customerAddress - Full customer address
 * @param config - Freight configuration (storeAddress, pricePerKm, minimumFreight)
 * @returns { distanceKm, freight } or null if calculation fails
 */
export async function calculateFreightForAddress(
    customerAddress: string,
    config: FreightConfig
): Promise<{
    distanceKm: number
    freight: number
} | null> {
    try {
        // Get store coordinates
        const storeCoords = await geocodeAddress(config.storeAddress)
        if (!storeCoords) {
            console.error('Could not geocode store address')
            return null
        }

        // Ensure address includes city/country for better geocoding
        const fullAddress = customerAddress.toLowerCase().includes('belo horizonte')
            ? customerAddress
            : `${customerAddress}, Belo Horizonte, MG, Brasil`

        // Get customer coordinates
        const customerCoords = await geocodeAddress(fullAddress)
        if (!customerCoords) {
            console.error('Could not geocode customer address:', customerAddress)
            return null
        }

        // Calculate driving distance
        const distanceKm = await calculateDistance(storeCoords, customerCoords)
        if (distanceKm === null) {
            console.error('Could not calculate distance')
            return null
        }

        // Calculate freight
        const freight = calculateFreightFromDistance(distanceKm, config)

        return { distanceKm, freight }
    } catch (error) {
        console.error('Error calculating freight:', error)
        return null
    }
}

/**
 * Get default freight configuration for fallback purposes
 */
export function getDefaultFreightConfig(): FreightConfig {
    return {
        storeAddress: 'Rua Ariramba 121, Belo Horizonte, MG, Brasil',
        pricePerKm: 2.00,
        minimumFreight: 15.00
    }
}
