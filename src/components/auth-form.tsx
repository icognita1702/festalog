'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Lock, Mail } from 'lucide-react'
import { isAuthEnabled } from '@/lib/auth-mode'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

type AuthMode = 'login' | 'signup'

interface AuthFormProps {
  mode: AuthMode
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/dashboard'
  const authEnabled = isAuthEnabled()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authEnabled) {
      router.replace('/dashboard')
      router.refresh()
    }
  }, [authEnabled, router])

  const content = useMemo(() => {
    if (mode === 'signup') {
      return {
        title: 'Criar conta',
        description: 'Cadastre sua locadora e comece pelo onboarding seguro do tenant.',
        submitLabel: 'Criar conta',
        switchLabel: 'Já tem conta?',
        switchHref: '/login',
        switchCta: 'Entrar',
      }
    }

    return {
      title: 'Entrar',
      description: 'Acesse sua locadora com autenticação por sessão.',
      submitLabel: 'Entrar',
      switchLabel: 'Ainda não tem conta?',
      switchHref: '/signup',
      switchCta: 'Criar conta',
    }
  }, [mode])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!authEnabled) {
      router.replace('/dashboard')
      router.refresh()
      return
    }

    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              name: fullName,
            },
          },
        })

        if (signUpError) {
          throw signUpError
        }

        if (!data.session) {
          setMessage('Conta criada. Verifique seu e-mail para confirmar o acesso antes de entrar.')
          return
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          throw signInError
        }
      }

      router.replace(nextPath)
      router.refresh()
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error ? caughtError.message : 'Nao foi possivel concluir a autenticacao.'
      setError(nextError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{content.title}</CardTitle>
        <CardDescription>{content.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' ? (
            <div className="grid gap-2">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nome do locador responsavel"
                required
              />
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@empresa.com"
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimo de 6 caracteres"
                className="pl-9"
                minLength={6}
                required
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {message ? (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {content.submitLabel}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {content.switchLabel}{' '}
          <Link href={content.switchHref} className="font-medium text-primary hover:underline">
            {content.switchCta}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
