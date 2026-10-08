import { Sidebar } from '@/components/layout/sidebar'
import { isAuthEnabled } from '@/lib/auth-mode'
import { getAuthenticatedTenantContext } from '@/lib/tenant-context'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (isAuthEnabled()) {
    await getAuthenticatedTenantContext()
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <Sidebar />
      <main className="min-h-screen min-w-0 pt-[calc(4rem+env(safe-area-inset-top))] lg:ml-64 lg:pt-0">
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:p-8">{children}</div>
      </main>
    </div>
  )
}
