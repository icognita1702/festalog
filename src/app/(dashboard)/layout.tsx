import { Sidebar } from '@/components/layout/sidebar'
import { GoogleMapsProvider } from '@/components/google-maps-provider'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <GoogleMapsProvider>
            <div className="min-h-screen bg-background">
                <Sidebar />
                {/* Responsive: pt-16 for mobile header, lg:pt-0 lg:ml-64 for desktop sidebar */}
                <main className="min-h-screen pt-16 lg:pt-0 lg:ml-64">
                    <div className="p-4 lg:p-8">
                        {children}
                    </div>
                </main>
            </div>
        </GoogleMapsProvider>
    )
}
