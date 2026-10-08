'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { isAuthEnabled } from '@/lib/auth-mode'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    if (!isAuthEnabled()) {
      router.replace('/dashboard')
      router.refresh()
      return
    }

    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <Button variant="ghost" className="w-full justify-start gap-3 px-3 py-2.5" onClick={handleSignOut}>
      <LogOut className="h-5 w-5" />
      Sair
    </Button>
  )
}
