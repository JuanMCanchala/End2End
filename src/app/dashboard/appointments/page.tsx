'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Appointment, LeadTemperature } from '@/types'
import { TEMPERATURE_LABELS, TEMPERATURE_COLORS } from '@/lib/utils/constants'
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'

interface AppointmentWithLead extends Appointment {
  lead: {
    id: string
    name: string | null
    phone: string
    temperature: LeadTemperature
    score: number
  } | null
}

const APPOINTMENT_STATUS: Record<string, { label: string; class: string }> = {
  scheduled: { label: 'Agendada', class: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
  confirmed: { label: 'Confirmada', class: 'bg-green-500/20 text-green-300 border border-green-500/30' },
  cancelled: { label: 'Cancelada', class: 'bg-red-500/20 text-red-300 border border-red-500/30' },
  completed: { label: 'Completada', class: 'bg-slate-700 text-slate-400 border border-slate-600' },
}

function getDateLabel(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return { label: 'Hoy', class: 'text-purple-400 font-bold' }
  if (isTomorrow(date)) return { label: 'Mañana', class: 'text-amber-400 font-bold' }
  if (isPast(date)) return { label: 'Pasada', class: 'text-slate-500' }
  return { label: null, class: 'text-slate-300' }
}

type Filter = 'all' | 'upcoming' | 'past' | 'cancelled'

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentWithLead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [calendlyConnected, setCalendlyConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const searchParams = useSearchParams()
  const { toast } = useToast()

  useEffect(() => {
    loadAppointments()
    checkCalendlyStatus()

    // Show toast from OAuth redirect
    if (searchParams.get('calendly_connected')) {
      toast({ title: '✅ Calendly conectado', description: 'Tu cuenta de Calendly fue vinculada correctamente.' })
    } else if (searchParams.get('calendly_error')) {
      toast({ title: 'Error al conectar Calendly', description: 'Intenta de nuevo.', variant: 'destructive' })
    }
  }, [])

  async function checkCalendlyStatus() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: biz } = await supabase
      .from('businesses')
      .select('calendly_access_token')
      .eq('user_id', user.id)
      .single()
    setCalendlyConnected(!!biz?.calendly_access_token)
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/calendly/sync', { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      toast({ title: `✅ Sincronización completa`, description: `${data.synced} nuevas citas importadas de Calendly.` })
      loadAppointments()
    } catch {
      toast({ title: 'Error al sincronizar', variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('appointments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, loadAppointments)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadAppointments() {
    try {
      const res = await fetch('/api/appointments')
      const data = await res.json()
      setAppointments(data.appointments || [])
    } catch (err) {
      console.error('Failed to load appointments:', err)
    } finally {
      setLoading(false)
    }
  }

  const now = new Date()

  const filtered = appointments.filter((a) => {
    const date = new Date(a.scheduled_at)
    if (filter === 'upcoming') return !isPast(date) && a.status !== 'cancelled'
    if (filter === 'past') return isPast(date) || a.status === 'completed'
    if (filter === 'cancelled') return a.status === 'cancelled'
    return true
  })

  const upcomingCount = appointments.filter(
    (a) => !isPast(new Date(a.scheduled_at)) && a.status !== 'cancelled'
  ).length

  const filters: { key: Filter; label: string }[] = [
    { key: 'upcoming', label: `Próximas${upcomingCount > 0 ? ` (${upcomingCount})` : ''}` },
    { key: 'all', label: 'Todas' },
    { key: 'past', label: 'Pasadas' },
    { key: 'cancelled', label: 'Canceladas' },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Citas Agendadas</h1>
          <p className="text-slate-400 text-sm mt-1">
            {appointments.length} cita{appointments.length !== 1 ? 's' : ''} en total
            {upcomingCount > 0 && (
              <span className="text-purple-400 ml-2">· {upcomingCount} próxima{upcomingCount !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>

        {/* Calendly actions */}
        <div className="flex items-center gap-2">
          {calendlyConnected ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1.5 rounded-lg">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                Calendly conectado
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
              >
                {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar Calendly'}
              </button>
            </>
          ) : (
            <a
              href="/api/calendly/connect"
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 hover:text-blue-200 rounded-lg text-sm font-medium transition-colors"
            >
              🗓️ Conectar Calendly
            </a>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500">Cargando citas...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🗓️</div>
          <div className="text-slate-400 font-medium">No hay citas {filter !== 'all' ? 'en esta categoría' : ''}</div>
          <p className="text-slate-600 text-sm mt-1">
            Las citas agendadas por el Agente de Agenda aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((appt) => {
            const date = new Date(appt.scheduled_at)
            const past = isPast(date) && appt.status !== 'scheduled'
            const dateLabel = getDateLabel(appt.scheduled_at)
            const statusConfig = APPOINTMENT_STATUS[appt.status] || APPOINTMENT_STATUS.scheduled

            return (
              <div
                key={appt.id}
                className={`bg-slate-900 border rounded-xl p-4 flex gap-4 transition-colors ${
                  past ? 'border-slate-800 opacity-70' : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                {/* Date block */}
                <div className="flex-shrink-0 w-16 text-center bg-slate-800 rounded-lg p-2 flex flex-col items-center justify-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">
                    {format(date, 'MMM', { locale: es })}
                  </div>
                  <div className="text-2xl font-bold text-white leading-tight">
                    {format(date, 'd')}
                  </div>
                  <div className="text-xs text-slate-400">{format(date, 'HH:mm')}</div>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="text-white font-semibold text-sm">{appt.title}</h3>
                    {dateLabel.label && (
                      <span className={`text-xs ${dateLabel.class}`}>{dateLabel.label}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.class}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Lead info */}
                  {appt.lead && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-sm text-slate-300">
                        👤 {appt.lead.name || appt.lead.phone}
                      </span>
                      {appt.lead.name && (
                        <span className="text-xs text-slate-500">{appt.lead.phone}</span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${TEMPERATURE_COLORS[appt.lead.temperature]}`}>
                        {TEMPERATURE_LABELS[appt.lead.temperature]}
                      </span>
                      <span className="text-xs text-slate-500">Score: {appt.lead.score}/100</span>
                    </div>
                  )}

                  {/* Details row */}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      ⏱️ {appt.duration_minutes} min
                    </span>
                    {appt.location && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        📍 {appt.location}
                      </span>
                    )}
                    {appt.meeting_link && (
                      <a
                        href={appt.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        🔗 Unirse a reunión
                      </a>
                    )}
                    <span className="text-xs text-slate-600">
                      {isPast(date)
                        ? `Fue ${formatDistanceToNow(date, { addSuffix: true, locale: es })}`
                        : `En ${formatDistanceToNow(date, { locale: es })}`}
                    </span>
                  </div>

                  {appt.notes && (
                    <p className="text-xs text-slate-500 mt-2 italic">📝 {appt.notes}</p>
                  )}
                </div>

                {/* Action */}
                <div className="flex-shrink-0 flex items-center">
                  {appt.conversation_id ? (
                    <Link
                      href={`/dashboard/conversations/${appt.conversation_id}`}
                      className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-600/30 text-purple-300 hover:text-purple-200 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      💬 Ver chat
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-600 px-3 py-2">Sin chat</span>
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
