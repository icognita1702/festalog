'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Users,
    Package,
    FileText,
    MapPin,
    MessageCircle,
    Settings,
    PartyPopper,
    Smartphone
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
        title: 'Conexão Bot',
        href: '/conexao',
        icon: Smartphone
    },
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
            <div className="flex h-full flex-col">
                {/* Logo */}
                <div className="flex h-16 items-center gap-2 border-b px-6">
                    <PartyPopper className="h-8 w-8 text-primary" />
                    <span className="text-xl font-bold">FestaLog</span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1 p-4">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
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
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                    >
                        <Settings className="h-5 w-5" />
                        Configurações
                    </Link>
                </div>
            </div>
        </aside>
    )
}
