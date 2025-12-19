'use client'

import { useLoadScript, Libraries } from '@react-google-maps/api'
import { ReactNode } from 'react'

const libraries: Libraries = ['places']

interface GoogleMapsProviderProps {
    children: ReactNode
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries,
    })

    if (loadError) {
        console.error('Erro ao carregar Google Maps:', loadError)
        return <>{children}</>
    }

    if (!isLoaded) {
        return <>{children}</>
    }

    return <>{children}</>
}

export function useGoogleMapsLoaded() {
    const { isLoaded } = useLoadScript({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries,
    })
    return isLoaded
}
