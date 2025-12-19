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

interface Suggestion {
    placeId: string
    description: string
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
    const inputRef = useRef<HTMLInputElement>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [isGoogleLoaded, setIsGoogleLoaded] = useState(false)
    const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
    const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null)
    const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)

    useEffect(() => {
        const checkGoogleLoaded = () => {
            if (typeof window !== 'undefined' && window.google?.maps?.places) {
                setIsGoogleLoaded(true)
                autocompleteServiceRef.current = new google.maps.places.AutocompleteService()
                // PlacesService needs a div element
                const div = document.createElement('div')
                placesServiceRef.current = new google.maps.places.PlacesService(div)
                sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken()
                return true
            }
            return false
        }

        if (checkGoogleLoaded()) return

        const interval = setInterval(() => {
            if (checkGoogleLoaded()) {
                clearInterval(interval)
            }
        }, 100)

        return () => clearInterval(interval)
    }, [])

    const fetchSuggestions = useCallback(async (input: string) => {
        if (!input || input.length < 3 || !autocompleteServiceRef.current) {
            setSuggestions([])
            return
        }

        setIsLoading(true)

        try {
            const request: google.maps.places.AutocompletionRequest = {
                input,
                componentRestrictions: { country: 'br' },
                sessionToken: sessionTokenRef.current!,
            }

            autocompleteServiceRef.current.getPlacePredictions(request, (predictions, status) => {
                setIsLoading(false)
                if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                    setSuggestions(predictions.map(p => ({
                        placeId: p.place_id,
                        description: p.description,
                    })))
                    setShowSuggestions(true)
                } else {
                    setSuggestions([])
                }
            })
        } catch (error) {
            console.error('Erro ao buscar sugestões:', error)
            setIsLoading(false)
            setSuggestions([])
        }
    }, [])

    const handleSelect = useCallback((suggestion: Suggestion) => {
        if (!placesServiceRef.current) {
            onChange(suggestion.description)
            setSuggestions([])
            setShowSuggestions(false)
            return
        }

        placesServiceRef.current.getDetails(
            {
                placeId: suggestion.placeId,
                fields: ['formatted_address'],
                sessionToken: sessionTokenRef.current!,
            },
            (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && place?.formatted_address) {
                    onChange(place.formatted_address)
                } else {
                    onChange(suggestion.description)
                }
                // Reset session token after selection
                sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken()
                setSuggestions([])
                setShowSuggestions(false)
            }
        )
    }, [onChange])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        onChange(newValue)
        fetchSuggestions(newValue)
    }

    const handleBlur = () => {
        // Delay to allow click on suggestion
        setTimeout(() => {
            setShowSuggestions(false)
        }, 200)
    }

    const handleFocus = () => {
        if (suggestions.length > 0) {
            setShowSuggestions(true)
        }
    }

    if (!isGoogleLoaded) {
        return (
            <div className="relative">
                <Input
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    className={`pl-8 ${className}`}
                />
                <MapPin className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="relative">
            <Input
                ref={inputRef}
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

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((suggestion) => (
                        <button
                            key={suggestion.placeId}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                            onClick={() => handleSelect(suggestion)}
                        >
                            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span>{suggestion.description}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
