'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Calendar, CalendarDays, Users, DollarSign, Dumbbell, Building2, Settings, LogOut, X, CreditCard, Users2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout, getStoredUser } from '@/lib/auth'
import { getInitials } from '@/lib/utils'

const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/agenda', icon: Calendar, label: 'Agenda' },
  { href: '/admin/clientes', icon: Users, label: 'Clientes' },
  { href: '/admin/planes', icon: CreditCard, label: 'Planes' },
  { href: '/admin/membresias', icon: Users2, label: 'Membresías' },
  { href: '/admin/caja', icon: DollarSign, label: 'Caja' },
  { href: '/admin/clases', icon: Dumbbell, label: 'Clases' },
  { href: '/admin/espacios', icon: Building2, label: 'Espacios' },
  { href: '/admin/horarios', icon: CalendarDays, label: 'Horarios' },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  // Defer localStorage reads to after mount to avoid server/client hydration mismatch.
  // On the server getStoredUser() returns null; on the client it returns real data,
  // so we must not read it during the initial render pass.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const user = mounted ? getStoredUser() : null

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-100 z-40 flex flex-col transition-transform duration-200',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Kalma</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition',
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className={cn('w-5 h-5', active ? 'text-primary-600' : 'text-gray-400')} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer - user */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-sm font-semibold">
              {user?.full_name ? getInitials(user.full_name) : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name || 'Usuario'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 transition"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
