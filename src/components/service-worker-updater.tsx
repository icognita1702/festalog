'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

export function ServiceWorkerUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | undefined
    let watchedRegistration: ServiceWorkerRegistration | undefined
    let hadController = Boolean(navigator.serviceWorker.controller)
    let disposed = false

    const checkForUpdate = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none',
        })

        if (disposed) return

        if (registration !== watchedRegistration) {
          watchedRegistration = registration
          registration.addEventListener('updatefound', handleUpdateFound)
        }

        if (registration.waiting && navigator.serviceWorker.controller) {
          setUpdateAvailable(true)
        }

        await registration.update()
      } catch (error) {
        console.warn('Não foi possível verificar atualizações do FestaLog:', error)
      }
    }

    const handleControllerChange = () => {
      if (hadController) setUpdateAvailable(true)
      hadController = true
    }

    const handleUpdateFound = () => {
      const installingWorker = registration?.installing
      if (!installingWorker) return

      installingWorker.addEventListener('statechange', () => {
        if (
          installingWorker.state === 'activated' &&
          navigator.serviceWorker.controller
        ) {
          setUpdateAvailable(true)
        }
      })
    }

    void checkForUpdate()
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    window.addEventListener('focus', checkForUpdate)
    window.addEventListener('online', checkForUpdate)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForUpdate()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      disposed = true
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      watchedRegistration?.removeEventListener('updatefound', handleUpdateFound)
      window.removeEventListener('focus', checkForUpdate)
      window.removeEventListener('online', checkForUpdate)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  if (!updateAvailable) return null

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border bg-background p-3 shadow-lg sm:inset-x-auto sm:right-4 sm:bottom-4"
      role="status"
    >
      <p className="text-sm font-medium">Uma nova versão do FestaLog está pronta.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <RefreshCw className="h-4 w-4" />
        Atualizar
      </button>
    </div>
  )
}
