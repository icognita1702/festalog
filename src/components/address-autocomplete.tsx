'use client'

import { useEffect, useRef, useState } from 'react'
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
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isGoogleLoaded, setIsGoogleLoaded] = useState(false)

    useEffect(() => {
        // Verifica se o Google Maps já foi carregado
        const checkGoogleLoaded = () => {
            if (typeof window !== 'undefined' && window.google?.maps?.places) {
                setIsGoogleLoaded(true)
                return true
            }
            return false
        }

        if (checkGoogleLoaded()) return

        // Polling para esperar o carregamento
        const interval = setInterval(() => {
            if (checkGoogleLoaded()) {
                clearInterval(interval)
            }
        }, 100)

        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (!isGoogleLoaded || !inputRef.current || autocompleteRef.current) return

        try {
            // Cria o autocomplete
            autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
                componentRestrictions: { country: 'br' },
                fields: ['formatted_address', 'geometry', 'name', 'address_components'],
                types: ['address'],
            })

            // Listener para quando um lugar é selecionado
            autocompleteRef.current.addListener('place_changed', () => {
                const place = autocompleteRef.current?.getPlace()
                if (place?.formatted_address) {
                    onChange(place.formatted_address)
                } else if (place?.name) {
                    onChange(place.name)
                }
                setIsLoading(false)
            })
        } catch (error) {
            console.error('Erro ao inicializar autocomplete:', error)
        }
    }, [isGoogleLoaded, onChange])

    // Sincroniza o valor externo com o input
    useEffect(() => {
        if (inputRef.current && inputRef.current.value !== value) {
            inputRef.current.value = value
        }
    }, [value])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value)
        if (e.target.value.length > 2) {
            setIsLoading(true)
        }
    }

    const handleBlur = () => {
        setIsLoading(false)
    }

    if (!isGoogleLoaded) {
        // Fallback para input normal se Google não carregou
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
                defaultValue={value}
                onChange={handleInputChange}
                onBlur={handleBlur}
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
        </div>
    )
}
