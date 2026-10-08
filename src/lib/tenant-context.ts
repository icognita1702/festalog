import 'server-only'

import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createServerSupabaseClient } from './supabase-server'
import type { Configuracao, Profile, Tenant, TenantContext } from './database.types'

export type AuthenticatedTenantContext = TenantContext & {
  user: User
}

export async function getAuthenticatedTenantContext(options?: {
  requireOnboarding?: boolean
  allowUnauthenticated?: boolean
}): Promise<AuthenticatedTenantContext | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (options?.allowUnauthenticated) {
      return null
    }

    redirect('/login')
  }

  await supabase.rpc('ensure_current_user_profile')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile) {
    redirect('/login')
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', profile.tenant_id)
    .single<Tenant>()

  if (!tenant) {
    redirect('/login')
  }

  if (options?.requireOnboarding !== false && !tenant.onboarding_completed) {
    redirect('/onboarding')
  }

  const { data: configuracao } = await supabase
    .from('configuracoes')
    .select('*')
    .eq('tenant_id', tenant.id)
    .maybeSingle<Configuracao>()

  return {
    user,
    profile,
    tenant,
    configuracao,
  }
}
