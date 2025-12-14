/**
 * Freight Calculator
 * Calculates shipping cost based on distance from store to customer
 * Uses free APIs: Nominatim (geocoding) and OSRM (routing)
 */

// Configuration
const STORE_ADDRESS = 'Rua Ariramba 121, Belo Horizonte, MG, Brasil'
const PRICE_PER_KM = 2.00  // R$ per km
const MINIMUM_FREIGHT = 15.00  // Minimum freight charge (never free)

// Store coordinates cache
let storeCoordinates: [number, number] | null = null

/**
 * Geocode an address to coordinates using Nominatim (OpenStreetMap)
 * @param address - Full address string
 * @returns [longitude, latitude] or null if not found
 */
export async function geocodeAddress(address: string): Promise<[number, number] | null> {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=br&limit=1`
        const response = await fetch(url, {
            headers: { 'User-Agent': 'FestaLog/1.0' }
        })
        const data = await response.json()

        if (data && data.length > 0) {
            // Nominatim returns [lat, lon], we return [lon, lat] for OSRM
            return [parseFloat(data[0].lon), parseFloat(data[0].lat)]
        }
        return null
    } catch (error) {
        console.error('Error geocoding address:', error)
        return null
    }
}

/**
 * Get store coordinates (cached)
 */
async function getStoreCoordinates(): Promise<[number, number] | null> {
    if (storeCoordinates) return storeCoordinates

    storeCoordinates = await geocodeAddress(STORE_ADDRESS)
    return storeCoordinates
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
 * Formula: max(distance * PRICE_PER_KM, MINIMUM_FREIGHT)
 * Freight is never free
 * @param distanceKm - Distance in kilometers
 * @returns Freight cost in BRL
 */
export function calculateFreightFromDistance(distanceKm: number): number {
    const calculated = distanceKm * PRICE_PER_KM
    return Math.max(calculated, MINIMUM_FREIGHT)
}

/**
 * Calculate freight for a customer address
 * Main function to be used by the order form
 * @param customerAddress - Full customer address
 * @returns { distanceKm, freight } or null if calculation fails
 */
export async function calculateFreightForAddress(customerAddress: string): Promise<{
    distanceKm: number
    freight: number
} | null> {
    try {
        // Get store coordinates
        const storeCoords = await getStoreCoordinates()
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
        const freight = calculateFreightFromDistance(distanceKm)

        return { distanceKm, freight }
    } catch (error) {
        console.error('Error calculating freight:', error)
        return null
    }
}

/**
 * Get freight configuration for display purposes
 */
export function getFreightConfig() {
    return {
        pricePerKm: PRICE_PER_KM,
        minimumFreight: MINIMUM_FREIGHT,
        storeAddress: STORE_ADDRESS
    }
}
