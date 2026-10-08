import { redirect } from 'next/navigation'
import { isAuthEnabled } from '@/lib/auth-mode'
import { OnboardingForm } from '@/components/onboarding-form'
import { getAuthenticatedTenantContext } from '@/lib/tenant-context'

export default async function OnboardingPage() {
  if (!isAuthEnabled()) {
    redirect('/dashboard')
  }

  const context = await getAuthenticatedTenantContext({ requireOnboarding: false })

  if (!context) {
    redirect('/login')
  }

  if (context.tenant.onboarding_completed) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-10">
      <OnboardingForm tenant={context.tenant} configuracao={context.configuracao} />
    </main>
  )
}
