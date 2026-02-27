'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { formatDistanceToNow, format, isPast } from 'date-fns'
import { es } from 'date-fns/locale'

interface FollowupWithLead {
  id: string
  business_id: string
  lead_id: string
  conversation_id: string | null
  scheduled_at: string
  message: string
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  sent_at: string | null
  created_at: string
  leads: { id: string; name: string | null; phone: string } | null
}

const STATUS_CONFIG = {
  pending:   { label: 'Pendiente', color: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40' },
  sent:      { label: 'Enviado',   color: 'bg-green-900/40 text-green-300 border-green-700/40' },
  failed:    { label: 'Fallido',   color: 'bg-red-900/40 text-red-300 border-red-700/40' },
  cancelled: { label: 'Cancelado', color: 'bg-slate-700/60 text-slate-400 border-slate-600/40' },
}

type FilterType = 'all' | 'pending' | 'sent' | 'cancelled'

export default function FollowupsPage() {
  const [followups, setFollowups] = useState<FollowupWithLead[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const { toast } = useToast()

  useEffect(() => {
    loadFollowups()
  }, [])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('followups-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'followups' }, () => {
        loadFollowups()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadFollowups() {
    try {
      const res = await fetch('/api/followups')
      const data = await res.json()
      setFollowups(data.followups || [])
    } catch (err) {
      console.error('Failed to load followups:', err)
    } finally {
      setLoading(false)
    }
  }

  async function sendNow(id: string, leadName: string) {
    setSending(id)
    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'send' }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      setFollowups((prev) =>
        prev.map((f) => f.id === id ? { ...f, status: 'sent', sent_at: new Date().toISOString() } : f)
      )
      toast({ title: '✅ Enviado', description: `Mensaje enviado a ${leadName} por WhatsApp.` })
    } catch (err) {
      toast({ title: 'Error al enviar', description: String(err), variant: 'destructive' })
    } finally {
      setSending(null)
    }
  }

  async function cancelFollowup(id: string) {
    setCancelling(id)
    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'cancel' }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      setFollowups((prev) =>
        prev.map((f) => f.id === id ? { ...f, status: 'cancelled' } : f)
      )
      toast({ title: 'Cancelado', description: 'El follow-up fue cancelado.' })
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' })
    } finally {
      setCancelling(null)
    }
  }

  const filtered = followups.filter((f) => filter === 'all' || f.status === filter)
  const counts = {
    all: followups.length,
    pending: followups.filter((f) => f.status === 'pending').length,
    sent: followups.filter((f) => f.status === 'sent').length,
    cancelled: followups.filter((f) => f.status === 'cancelled').length,
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white">Follow-ups</h1>
            <span className="text-xs bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full font-medium">
              🧪 DEMO
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Seguimientos programados por los agentes IA · Envía cualquiera manualmente para demostración
          </p>
        </div>
        <button
          onClick={loadFollowups}
          className="text-slate-400 hover:text-white text-sm px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
        >
          ↺ Refrescar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {([
          { key: 'all', label: 'Todos' },
          { key: 'pending', label: '⏳ Pendientes' },
          { key: 'sent', label: '✅ Enviados' },
          { key: 'cancelled', label: '✕ Cancelados' },
        ] as { key: FilterType; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              filter === key
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              filter === key ? 'bg-white/20' : 'bg-slate-700 text-slate-500'
            }`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-20 text-slate-500">Cargando follow-ups...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📅</div>
          <div className="text-slate-400 text-lg font-medium mb-1">
            {filter === 'all' ? 'No hay follow-ups todavía' : `No hay follow-ups ${filter === 'pending' ? 'pendientes' : filter === 'sent' ? 'enviados' : 'cancelados'}`}
          </div>
          <div className="text-slate-600 text-sm">
            Los agentes crean follow-ups automáticamente cuando un lead dice "te contacto después" o necesita seguimiento.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((fu) => {
            const lead = fu.leads
            const leadLabel = lead?.name || lead?.phone || 'Lead desconocido'
            const isOverdue = fu.status === 'pending' && isPast(new Date(fu.scheduled_at))
            const isSending = sending === fu.id
            const isCancelling = cancelling === fu.id

            return (
              <div
                key={fu.id}
                className={`bg-slate-900 border rounded-xl p-4 transition-all ${
                  isOverdue ? 'border-orange-500/40' : 'border-slate-800'
                } ${fu.status === 'sent' || fu.status === 'cancelled' ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-purple-900/50 border border-purple-700/40 flex items-center justify-center text-base flex-shrink-0">
                    {fu.status === 'sent' ? '✅' : fu.status === 'cancelled' ? '✕' : isOverdue ? '🔴' : '⏰'}
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-sm font-semibold text-white">{leadLabel}</span>
                      {lead?.phone && lead.name && (
                        <span className="text-xs text-slate-500">{lead.phone}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_CONFIG[fu.status].color}`}>
                        {STATUS_CONFIG[fu.status].label}
                      </span>
                      {isOverdue && (
                        <span className="text-xs bg-orange-900/40 text-orange-300 border border-orange-700/40 px-2 py-0.5 rounded-full">
                          ⚠️ Vencido
                        </span>
                      )}
                    </div>

                    {/* Mensaje */}
                    <div className="bg-slate-800 rounded-lg px-3 py-2.5 mb-3 text-sm text-slate-200 leading-relaxed border border-slate-700/50">
                      "{fu.message}"
                    </div>

                    {/* Fechas */}
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <span>🗓️</span>
                        <span>
                          Programado:{' '}
                          <span className={`font-medium ${isOverdue ? 'text-orange-400' : 'text-slate-300'}`}>
                            {format(new Date(fu.scheduled_at), "d 'de' MMMM, HH:mm", { locale: es })}
                          </span>
                          {' '}({formatDistanceToNow(new Date(fu.scheduled_at), { addSuffix: true, locale: es })})
                        </span>
                      </div>
                      {fu.sent_at && (
                        <div className="flex items-center gap-1">
                          <span>✉️</span>
                          <span>
                            Enviado: <span className="text-green-400 font-medium">
                              {formatDistanceToNow(new Date(fu.sent_at), { addSuffix: true, locale: es })}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  {fu.status === 'pending' && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => sendNow(fu.id, leadLabel)}
                        disabled={isSending || isCancelling}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {isSending ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>📤 Enviar ahora</>
                        )}
                      </button>
                      <button
                        onClick={() => cancelFollowup(fu.id)}
                        disabled={isSending || isCancelling}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-400 hover:text-white text-xs rounded-lg transition-colors text-center"
                      >
                        {isCancelling ? 'Cancelando...' : 'Cancelar'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
