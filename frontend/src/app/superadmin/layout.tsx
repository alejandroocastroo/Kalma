'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredUser, logout } from '@/lib/auth'
import { Shield, Building2, LogOut } from 'lucide-react'

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const user = getStoredUser()
    if (!user || user.role !== 'superadmin') {
      router.replace('/login')
    }
  }, [router])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">Kalma</p>
              <p className="text-gray-400 text-xs mt-0.5">Superadmin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <a
            href="/superadmin/tenants"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Tenants
          </a>
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
