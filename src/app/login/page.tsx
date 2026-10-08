import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { isAuthEnabled } from '@/lib/auth-mode'
import { AuthForm } from '@/components/auth-form'

export default function LoginPage() {
  if (!isAuthEnabled()) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-10">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  )
}
