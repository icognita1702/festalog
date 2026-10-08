'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Configuracao } from '@/lib/database.types'

export function useTenantConfig() {
  const [config, setConfig] = useState<Configuracao | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      const { data } = await supabase.from('configuracoes').select('*').maybeSingle()

      if (active) {
        setConfig(data ?? null)
        setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [])

  return { config, loading, setConfig }
}
