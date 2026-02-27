'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Métricas', icon: '📊', demo: false },
  { href: '/dashboard/leads', label: 'Leads', icon: '🎯', demo: false },
  { href: '/dashboard/conversations', label: 'Conversaciones', icon: '💬', demo: false },
  { href: '/dashboard/appointments', label: 'Citas', icon: '🗓️', demo: false },
  { href: '/dashboard/activity', label: 'Actividad IA', icon: '🤖', demo: false },
  { href: '/dashboard/business', label: 'Mi Empresa', icon: '🏢', demo: false },
  { href: '/dashboard/followups', label: 'Follow-ups', icon: '📅', demo: true },
  { href: '/dashboard/demo', label: 'Demo Chat', icon: '🧪', demo: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showDebug, setShowDebug] = useState(false)
  const [pending, setPending] = useState<Array<{ phone: string; profile_name: string | null; options: unknown[]; created_at: string }>>([])

  useEffect(() => {
    if (!showDebug) return
    supabase.from('pending_selections').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setPending(data || []))
  }, [showDebug])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-screen">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-xl font-bold text-white">End2End</div>
          <div className="text-xs text-purple-400 mt-0.5">Sistema Multi-Agente</div>
        </div>
        <button
          onClick={() => setShowDebug((v) => !v)}
          title="Debug: mensajes sin asignar"
          className="text-slate-600 hover:text-slate-300 transition-colors text-base"
        >
          ⚙️
        </button>
      </div>

      {/* Debug panel */}
      {showDebug && (
        <div className="mx-2 my-2 bg-slate-950 border border-yellow-700/40 rounded-lg p-2 text-xs">
          <div className="text-yellow-400 font-bold mb-1">🐛 Pending selections ({pending.length})</div>
          {pending.length === 0 ? (
            <div className="text-slate-500">Ninguno</div>
          ) : (
            pending.map((p) => (
              <div key={p.phone} className="border-t border-slate-800 pt-1 mt-1">
                <div className="text-white">{p.profile_name || '—'}</div>
                <div className="text-slate-400">{p.phone}</div>
                <div className="text-slate-500">
                  {(p.options as unknown[]).length === 0 ? 'Esperando búsqueda' : `${(p.options as unknown[]).length} opciones mostradas`}
                </div>
              </div>
            ))
          )}
          <button
            onClick={() => supabase.from('pending_selections').select('*').order('created_at', { ascending: false }).then(({ data }) => setPending(data || []))}
            className="mt-1 text-slate-500 hover:text-slate-300"
          >
            ↻ refrescar
          </button>
        </div>
      )}


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
                item.demo
                  ? isActive
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:bg-amber-500/10 hover:text-amber-300'
                  : isActive
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <span>{item.icon}</span>
              {item.label}
              {item.demo && !isActive && (
                <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">TEST</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Agents status */}
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Agentes activos</div>
        {['🧠 Orquestador', '🎯 Calificador', '📄 Propuestas', '🗓️ Agenda', '📅 Seguimiento', '🛒 Compras'].map((agent) => (
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
