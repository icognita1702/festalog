'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from '@/components/ui/sheet'
import { NotificationBell } from '@/components/notification-bell'
import {
    LayoutDashboard,
    Users,
    Package,
    FileText,
    MapPin,
    MessageCircle,
    Settings,
    PartyPopper,
    Menu,
    TrendingUp,
    TrendingDown,
    Calculator
} from 'lucide-react'

const menuItems = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard
    },
    {
        title: 'Clientes',
        href: '/clientes',
        icon: Users
    },
    {
        title: 'Produtos',
        href: '/produtos',
        icon: Package
    },
    {
        title: 'Pedidos',
        href: '/pedidos',
        icon: FileText
    },
    {
        title: 'Orçamento',
        href: '/orcamento',
        icon: Calculator
    },
    {
        title: 'Rotas',
        href: '/rotas',
        icon: MapPin
    },
    {
        title: 'WhatsApp',
        href: '/whatsapp',
        icon: MessageCircle
    },
    {
        title: 'Financeiro',
        href: '/financeiro',
        icon: TrendingUp
    },
    {
        title: 'Despesas',
        href: '/despesas',
        icon: TrendingDown
    },
]

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
    const pathname = usePathname()

    return (
        <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-24 items-center justify-center border-b p-4">
                <div className="relative w-full h-full flex items-center justify-center">
                    {/* Usando img tag simples para garantir carregamento local sem problemas de config do next/image inicialmente, 
                         mas o ideal é next/image. Vou usar img por segurança no dev server local. */}
                    <img
                        src="/logo.jpg"
                        alt="Lu Festas"
                        className="max-h-full max-w-full object-contain"
                    />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-4">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onLinkClick}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent",
                                isActive
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.title}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="border-t p-4">
                <Link
                    href="/configuracoes"
                    onClick={onLinkClick}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                >
                    <Settings className="h-5 w-5" />
                    Configurações
                </Link>
            </div>
        </div>
    )
}

export function Sidebar() {
    const [open, setOpen] = useState(false)

    return (
        <>
            {/* Desktop Sidebar - Hidden on mobile */}
            <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card hidden lg:block">
                <SidebarContent />
            </aside>

            {/* Mobile Header with Hamburger */}
            <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b bg-card lg:hidden">
                <div className="flex h-full items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="relative w-32 h-12 flex items-center">
                            <img
                                src="/logo.jpg"
                                alt="Lu Festas"
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>
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
