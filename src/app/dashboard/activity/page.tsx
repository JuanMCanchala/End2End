'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import { AgentAction } from '@/types'

export default function ActivityPage() {
  const [actions, setActions] = useState<AgentAction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadActivity()
  }, [])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('activity-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_actions',
      }, (payload) => {
        setActions((prev) => [payload.new as AgentAction, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadActivity() {
    try {
      const supabase = createClient()
      const { data: business } = await supabase.from('businesses').select('id').single()
      if (!business) { setLoading(false); return }

      const { data } = await supabase
        .from('agent_actions')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(100)

      setActions(data || [])
    } catch (err) {
      console.error('Failed to load activity:', err)
    } finally {
      setLoading(false)
    }
  }

  const agents = ['all', 'orchestrator', 'qualifier', 'proposal', 'scheduler', 'followup']
  const agentLabels: Record<string, string> = {
    all: 'Todos',
    orchestrator: '🧠 Orquestador',
    qualifier: '🎯 Calificador',
    proposal: '📄 Propuestas',
    scheduler: '🗓️ Agenda',
    followup: '📅 Seguimiento',
  }

  const filtered = filter === 'all' ? actions : actions.filter((a) => a.agent_type === filter)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Actividad de Agentes</h1>
        <p className="text-slate-400 text-sm mt-1">
          Registro transparente de todas las decisiones y acciones de tus agentes IA
        </p>
      </div>

      {/* Filter by agent */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {agents.map((agent) => (
          <button
            key={agent}
            onClick={() => setFilter(agent)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === agent
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {agentLabels[agent]}
          </button>
        ))}
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-sm text-slate-400">En tiempo real · {filtered.length} acciones</span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500">Cargando actividad...</div>
      ) : (
        <ActivityFeed actions={filtered} />
      )}
    </div>
  )
}
