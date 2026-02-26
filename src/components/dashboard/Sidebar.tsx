'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Métricas', icon: '📊' },
  { href: '/dashboard/leads', label: 'Leads', icon: '🎯' },
  { href: '/dashboard/conversations', label: 'Conversaciones', icon: '💬' },
  { href: '/dashboard/activity', label: 'Actividad IA', icon: '🤖' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-screen">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="text-xl font-bold text-white">End2End</div>
        <div className="text-xs text-purple-400 mt-0.5">Sistema Multi-Agente</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Agents status */}
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Agentes activos</div>
        {['🧠 Orquestador', '🎯 Calificador', '📄 Propuestas', '🗓️ Agenda', '📅 Seguimiento'].map((agent) => (
          <div key={agent} className="flex items-center gap-2 py-0.5">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-slate-400">{agent}</span>
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-slate-800">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-slate-400 hover:text-white hover:bg-slate-800 justify-start"
          onClick={handleLogout}
        >
          🚪 Cerrar sesión
        </Button>
      </div>
    </aside>
  )
}
