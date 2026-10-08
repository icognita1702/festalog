import { redirect } from 'next/navigation'
import { isAuthEnabled } from '@/lib/auth-mode'
import { getAuthenticatedTenantContext } from '@/lib/tenant-context'

export default async function Home() {
  if (!isAuthEnabled()) {
    redirect('/dashboard')
  }

  const context = await getAuthenticatedTenantContext({
    allowUnauthenticated: true,
    requireOnboarding: false,
  })

  if (!context) {
    redirect('/login')
  }

  if (!context.tenant.onboarding_completed) {
    redirect('/onboarding')
  }

  redirect('/dashboard')
}
