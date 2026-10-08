import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

function requireEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createSupabaseServerClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Server Components cannot always mutate cookies during render.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          } catch {
            // Server Components cannot always mutate cookies during render.
          }
        },
      },
    }
  )
}
