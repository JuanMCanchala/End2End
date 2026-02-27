'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AgentAction } from '@/types'
import { AGENT_DESCRIPTIONS } from '@/lib/utils/constants'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const ACTION_ICONS: Record<string, string> = {
  route_to_qualifier: '➡️',
  route_to_proposal: '📄',
  route_to_scheduler: '🗓️',
  route_to_followup: '📅',
  send_direct_response: '💬',
  save_qualification_answer: '✏️',
  update_lead_score: '🎯',
  send_qualifier_message: '❓',
  create_proposal: '💰',
  create_appointment: '📆',
  cancel_appointment: '❌',
  send_calendly_scheduling_link: '🔗',
  schedule_followup: '⏰',
  save_contact_info: '📧',
  complete_setup: '✅',
}

interface DbChange {
  label: string
  value: string
  color?: 'green' | 'red' | 'blue' | 'yellow' | 'purple'
}

function getDbChanges(action: AgentAction): DbChange[] {
  const i = action.input_data as Record<string, unknown>
  const o = action.output_data as Record<string, unknown>
  const changes: DbChange[] = []

  const tempColor = (t: string): DbChange['color'] =>
    t === 'hot' ? 'red' : t === 'warm' ? 'yellow' : 'blue'
  const tempLabel = (t: string) =>
    t === 'hot' ? '🔥 Caliente' : t === 'warm' ? '🌡️ Tibio' : '❄️ Frío'
  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-CO', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
      })
    } catch { return iso }
  }

  switch (action.action_type) {
    case 'save_qualification_answer':
      changes.push({ label: 'Campo', value: String(i.field || ''), color: 'purple' })
      changes.push({ label: 'Valor guardado', value: String(i.value || ''), color: 'green' })
      if (o.auto_score !== undefined)
        changes.push({ label: 'Score auto', value: `${o.auto_score}/100`, color: 'blue' })
      if (o.temperature)
        changes.push({ label: 'Temperatura', value: tempLabel(String(o.temperature)), color: tempColor(String(o.temperature)) })
      break

    case 'update_lead_score':
      changes.push({ label: 'Score', value: `${i.score}/100`, color: 'purple' })
      if (i.temperature)
        changes.push({ label: 'Temperatura', value: tempLabel(String(i.temperature)), color: tempColor(String(i.temperature)) })
      if (i.reason)
        changes.push({ label: 'Razón', value: String(i.reason), color: 'blue' })
      break

    case 'save_contact_info':
      if (i.email) changes.push({ label: 'Email', value: String(i.email), color: 'green' })
      if (i.phone) changes.push({ label: 'Teléfono', value: String(i.phone), color: 'green' })
      break

    case 'create_proposal':
      if (o.total_amount !== undefined)
        changes.push({ label: 'Monto', value: `$${Number(o.total_amount).toLocaleString('es-CO')} COP`, color: 'green' })
      if (o.items_count !== undefined)
        changes.push({ label: 'Items', value: `${o.items_count} producto(s)`, color: 'blue' })
      if (o.proposal_id)
        changes.push({ label: 'Propuesta ID', value: String(o.proposal_id).slice(0, 8) + '...', color: 'purple' })
      break

    case 'create_appointment':
      if (o.scheduled_at)
        changes.push({ label: 'Fecha', value: fmtDate(String(o.scheduled_at)), color: 'green' })
      if (o.appointment_id)
        changes.push({ label: 'Cita ID', value: String(o.appointment_id).slice(0, 8) + '...', color: 'purple' })
      break

    case 'cancel_appointment':
      if (o.new_score !== undefined)
        changes.push({ label: 'Nuevo score', value: `${o.new_score}/100 (−30)`, color: 'red' })
      if (o.new_temp)
        changes.push({ label: 'Temperatura', value: tempLabel(String(o.new_temp)), color: tempColor(String(o.new_temp)) })
      if (o.cancelled_appointment_id)
        changes.push({ label: 'Cita cancelada', value: String(o.cancelled_appointment_id).slice(0, 8) + '...', color: 'red' })
      break

    case 'send_calendly_scheduling_link':
      if (o.booking_url)
        changes.push({ label: 'Link generado', value: String(o.booking_url).slice(0, 40) + '...', color: 'blue' })
      break

    case 'schedule_followup':
      if (o.scheduled_at)
        changes.push({ label: 'Seguimiento para', value: fmtDate(String(o.scheduled_at)), color: 'yellow' })
      if (o.followup_id)
        changes.push({ label: 'Followup ID', value: String(o.followup_id).slice(0, 8) + '...', color: 'purple' })
      break

    case 'route_to_qualifier':
    case 'route_to_proposal':
    case 'route_to_scheduler':
    case 'route_to_followup':
      if (i.reason) changes.push({ label: 'Motivo', value: String(i.reason), color: 'blue' })
      if (i.product_interest) changes.push({ label: 'Interés', value: String(i.product_interest), color: 'blue' })
      if (i.meeting_type) changes.push({ label: 'Tipo reunión', value: String(i.meeting_type), color: 'blue' })
      if (i.days_until_followup) changes.push({ label: 'Días hasta followup', value: String(i.days_until_followup), color: 'yellow' })
      break
  }

  return changes
}

const COLOR_CLASSES: Record<string, string> = {
  green:  'bg-green-900/40 text-green-300 border-green-700/40',
  red:    'bg-red-900/40 text-red-300 border-red-700/40',
  blue:   'bg-blue-900/40 text-blue-300 border-blue-700/40',
  yellow: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  purple: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
}

interface ConversationGroup {
  conversation_id: string | null
  lead_name: string
  lead_phone: string
  actions: AgentAction[]
  last_action_at: string
}

export default function ActivityPage() {
  const [groups, setGroups] = useState<ConversationGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [agentFilter, setAgentFilter] = useState('all')

  useEffect(() => {
    loadActivity()
  }, [])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('activity-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_actions' }, () => {
        loadActivity()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadActivity() {
    try {
      const supabase = createClient()
      const { data: business } = await supabase.from('businesses').select('id').single()
      if (!business) { setLoading(false); return }

      const { data: actions } = await supabase
        .from('agent_actions')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (!actions) { setLoading(false); return }

      // Obtener leads para mostrar nombres
      const leadIds = Array.from(new Set(actions.map((a: AgentAction) => a.lead_id).filter(Boolean)))
      const { data: leads } = await supabase
        .from('leads')
        .select('id, name, phone')
        .in('id', leadIds as string[])

      const leadMap = Object.fromEntries((leads || []).map((l) => [l.id, l]))

      // Agrupar por conversation_id
      const groupMap = new Map<string, ConversationGroup>()

      for (const action of actions as AgentAction[]) {
        const key = action.conversation_id || 'sin-conversacion'
        if (!groupMap.has(key)) {
          const lead = action.lead_id ? leadMap[action.lead_id] : null
          groupMap.set(key, {
            conversation_id: action.conversation_id,
            lead_name: lead?.name || lead?.phone || 'Sin lead',
            lead_phone: lead?.phone || '',
            actions: [],
            last_action_at: action.created_at,
          })
        }
        groupMap.get(key)!.actions.push(action)
      }

      const sorted = Array.from(groupMap.values()).sort(
        (a, b) => new Date(b.last_action_at).getTime() - new Date(a.last_action_at).getTime()
      )

      setGroups(sorted)

      // Abrir el primer grupo por defecto
      if (sorted.length > 0) {
        setOpenGroups({ [sorted[0].conversation_id || 'sin-conversacion']: true })
      }
    } catch (err) {
      console.error('Failed to load activity:', err)
    } finally {
      setLoading(false)
    }
  }

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const agentLabels: Record<string, string> = {
    all: 'Todos',
    orchestrator: '🧠 Orquestador',
    qualifier: '🎯 Calificador',
    proposal: '📄 Propuestas',
    scheduler: '🗓️ Agenda',
    followup: '📅 Seguimiento',
  }

  const filteredGroups = groups.map((g) => ({
    ...g,
    actions: agentFilter === 'all' ? g.actions : g.actions.filter((a) => a.agent_type === agentFilter),
  })).filter((g) => g.actions.length > 0)

  const totalActions = filteredGroups.reduce((sum, g) => sum + g.actions.length, 0)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Actividad de Agentes</h1>
        <p className="text-slate-400 text-sm mt-1">
          Registro transparente de decisiones por conversación
        </p>
      </div>

      {/* Filtro por agente */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {Object.entries(agentLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setAgentFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              agentFilter === key ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-sm text-slate-400">
          En tiempo real · {filteredGroups.length} conversaciones · {totalActions} acciones
        </span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500">Cargando actividad...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">🤖</div>
          <div>Los agentes aún no han tomado acciones</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const key = group.conversation_id || 'sin-conversacion'
            const isOpen = !!openGroups[key]
            return (
              <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {/* Header de la conversación */}
                <button
                  onClick={() => toggleGroup(key)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-900/50 border border-purple-700/50 flex items-center justify-center text-sm">
                      👤
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">{group.lead_name}</div>
                      {group.lead_phone && group.lead_phone !== group.lead_name && (
                        <div className="text-xs text-slate-500">{group.lead_phone}</div>
                      )}
                    </div>
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                      {group.actions.length} acciones
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(group.last_action_at), { addSuffix: true, locale: es })}
                    </span>
                    <span className="text-slate-500 text-sm">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Acciones de la conversación */}
                {isOpen && (
                  <div className="border-t border-slate-800 divide-y divide-slate-800/50">
                    {group.actions.map((action) => {
                      const dbChanges = getDbChanges(action)
                      return (
                        <div key={action.id} className="flex gap-3 px-4 py-3">
                          <div className="text-lg flex-shrink-0 mt-0.5">
                            {ACTION_ICONS[action.action_type] || '⚙️'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-purple-300">
                                {AGENT_DESCRIPTIONS[action.agent_type] || action.agent_type}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                action.status === 'success'
                                  ? 'bg-green-900/50 text-green-400'
                                  : 'bg-red-900/50 text-red-400'
                              }`}>
                                {action.status}
                              </span>
                            </div>
                            <div className="text-sm text-white">{action.description}</div>

                            {/* DB changes */}
                            {dbChanges.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {dbChanges.map((change, ci) => (
                                  <span
                                    key={ci}
                                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${COLOR_CLASSES[change.color || 'blue']}`}
                                  >
                                    <span className="opacity-60">{change.label}:</span>
                                    <span className="font-medium">{change.value}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="text-xs text-slate-600 mt-1.5">
                              {formatDistanceToNow(new Date(action.created_at), { addSuffix: true, locale: es })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
