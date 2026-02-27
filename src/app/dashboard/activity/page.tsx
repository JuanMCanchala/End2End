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
  schedule_followup: '⏰',
  complete_setup: '✅',
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
                    {group.actions.map((action) => (
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
                          <div className="text-xs text-slate-600 mt-0.5">
                            {formatDistanceToNow(new Date(action.created_at), { addSuffix: true, locale: es })}
                          </div>
                        </div>
                      </div>
                    ))}
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
