'use client'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from '@/components/admin/sidebar'
import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/agenda': 'Agenda',
  '/admin/clientes': 'Clientes',
  '/admin/caja': 'Caja',
  '/admin/clases': 'Tipos de Clase',
  '/admin/espacios': 'Espacios',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const title = Object.entries(pageTitles).find(([k]) => pathname.startsWith(k))?.[1] || 'Panel'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
