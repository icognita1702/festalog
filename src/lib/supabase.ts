import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type TypedSupabaseClient = SupabaseClient<Database>

function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!anonKey) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return { url, anonKey }
}

export function createBrowserClient(): TypedSupabaseClient {
  const { url, anonKey } = getPublicSupabaseEnv()

  return createSupabaseClient<Database>(
    url,
    anonKey
  )
}

export const supabase = createBrowserClient()
