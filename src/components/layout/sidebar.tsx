'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Calculator,
  FileText,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  Settings,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/notification-bell'
import { SignOutButton } from '@/components/sign-out-button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { isAuthEnabled } from '@/lib/auth-mode'

const menuItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Clientes', href: '/clientes', icon: Users },
  { title: 'Produtos', href: '/produtos', icon: Package },
  { title: 'Pedidos', href: '/pedidos', icon: FileText },
  { title: 'Orcamento', href: '/orcamento', icon: Calculator },
  { title: 'Rotas', href: '/rotas', icon: MapPin },
  { title: 'WhatsApp', href: '/whatsapp', icon: MessageCircle },
  { title: 'Financeiro', href: '/financeiro', icon: TrendingUp },
  { title: 'Despesas', href: '/despesas', icon: TrendingDown },
]

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-24 items-center justify-center border-b p-4">
        <div className="relative h-full w-full">
          <Image src="/logo.jpg" alt="FestaLog" fill className="object-contain" />
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent',
                isActive
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.title}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-4">
        <Link
          href="/configuracoes"
          onClick={onLinkClick}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
          Configuracoes
        </Link>
        {isAuthEnabled() ? (
          <div className="mt-2">
            <SignOutButton />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r bg-card lg:block">
        <SidebarContent />
      </aside>

      <header className="fixed left-0 right-0 top-0 z-50 h-[calc(4rem+env(safe-area-inset-top))] border-b bg-card pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex h-full items-center justify-between px-4">
          <div className="relative h-12 w-32">
            <Image src="/logo.jpg" alt="FestaLog" fill className="object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SidebarContent onLinkClick={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  )
}
