'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Conversation } from '@/types'
import StatusBadge from '@/components/shared/StatusBadge'
import { TEMPERATURE_LABELS, TEMPERATURE_COLORS } from '@/lib/utils/constants'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('conversations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadConversations())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadConversations() {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (err) {
      console.error('Failed to load conversations:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter === 'all'
    ? conversations
    : conversations.filter((c) => c.status === filter)

  const humanTakeovers = conversations.filter((c) => c.status === 'human_takeover').length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Conversaciones</h1>
          <p className="text-slate-400 text-sm mt-1">
            {humanTakeovers > 0 && (
              <span className="text-blue-400 font-medium">{humanTakeovers} conversación(es) requieren atención humana · </span>
            )}
            {conversations.length} total
          </p>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'active', label: '🤖 Activas' },
          { key: 'human_takeover', label: '🧑 Con humano' },
          { key: 'closed', label: 'Cerradas' },
        ].map((f) => (
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
        <div className="text-center py-16 text-slate-500">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">💬</div>
          <div>No hay conversaciones</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((conv) => {
            const lead = conv.lead
            return (
              <Link
                key={conv.id}
                href={`/dashboard/conversations/${conv.id}`}
                className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg flex-shrink-0">
                  {conv.status === 'human_takeover' ? '🧑' : '🤖'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">
                      {lead?.name || lead?.phone || 'Desconocido'}
                    </span>
                    {lead?.temperature && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${TEMPERATURE_COLORS[lead.temperature]}`}>
                        {TEMPERATURE_LABELS[lead.temperature]}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 truncate">{lead?.phone}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={conv.status} />
                  <span className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: es })}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
