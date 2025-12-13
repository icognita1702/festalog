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
                <div className="flex h-16 items-center gap-3 border-b px-6">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 shadow-md">
                        <PartyPopper className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
                            FestaLog
                        </span>
                        <span className="text-[10px] text-muted-foreground -mt-1">Lú Festas</span>
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
