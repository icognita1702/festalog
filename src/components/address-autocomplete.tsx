'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2, MapPin } from 'lucide-react'

interface AddressAutocompleteProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    required?: boolean
    disabled?: boolean
    className?: string
    id?: string
}

interface PhotonFeature {
    properties: {
        name?: string
        street?: string
        housenumber?: string
        city?: string
        state?: string
        country?: string
        postcode?: string
    }
    geometry: {
        coordinates: [number, number]
    }
}

export function AddressAutocomplete({
    value,
    onChange,
    placeholder = 'Digite o endereço...',
    required = false,
    disabled = false,
    className = '',
    id,
}: AddressAutocompleteProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    const formatAddress = (feature: PhotonFeature): string => {
        const props = feature.properties
        const parts: string[] = []

        // Street + number
        if (props.street) {
            parts.push(props.housenumber ? `${props.street}, ${props.housenumber}` : props.street)
        } else if (props.name) {
            parts.push(props.name)
        }

        // City
        if (props.city) {
            parts.push(props.city)
        }

        // State
        if (props.state) {
            parts.push(props.state)
        }

        return parts.join(' - ')
    }

    const fetchSuggestions = useCallback(async (input: string) => {
        if (!input || input.length < 3) {
            setSuggestions([])
            return
        }

        setIsLoading(true)

        try {
            // Photon API - gratuito, sem chave necessária
            const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(input)}&limit=5&lang=pt&lat=-19.92&lon=-43.94`

            const response = await fetch(url)
            const data = await response.json()

            if (data.features && data.features.length > 0) {
                const formattedAddresses = data.features
                    .filter((f: PhotonFeature) => f.properties.country === 'Brazil' || f.properties.country === 'Brasil')
                    .map((f: PhotonFeature) => formatAddress(f))
                    .filter((addr: string) => addr.length > 0)

                setSuggestions(formattedAddresses)
                setShowSuggestions(true)
            } else {
                setSuggestions([])
            }
        } catch (error) {
            console.error('Erro ao buscar sugestões:', error)
            setSuggestions([])
        } finally {
            setIsLoading(false)
        }
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        onChange(newValue)

        // Debounce para não fazer muitas requisições
        if (debounceRef.current) {
            clearTimeout(debounceRef.current)
        }

        debounceRef.current = setTimeout(() => {
            fetchSuggestions(newValue)
        }, 300)
    }

    const handleSelect = (address: string) => {
        onChange(address)
        setSuggestions([])
        setShowSuggestions(false)
    }

    const handleBlur = () => {
        setTimeout(() => {
            setShowSuggestions(false)
        }, 200)
    }

    const handleFocus = () => {
        if (suggestions.length > 0) {
            setShowSuggestions(true)
        }
    }

    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }
        }
    }, [])

    return (
        <div className="relative">
            <Input
                id={id}
                value={value}
                onChange={handleInputChange}
                onBlur={handleBlur}
                onFocus={handleFocus}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                className={`pl-8 ${className}`}
                autoComplete="off"
            />
            <MapPin className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            {isLoading && (
                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}

            {/* Dropdown de sugestões */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((address, index) => (
                        <button
                            key={index}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                            onClick={() => handleSelect(address)}
                        >
                            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span>{address}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
