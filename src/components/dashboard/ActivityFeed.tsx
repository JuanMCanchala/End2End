'use client'

import { AgentAction } from '@/types'
import { AGENT_DESCRIPTIONS } from '@/lib/utils/constants'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface ActivityFeedProps {
  actions: AgentAction[]
}

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

export default function ActivityFeed({ actions }: ActivityFeedProps) {
  if (actions.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <div className="text-4xl mb-3">🤖</div>
        <div>Los agentes aún no han tomado acciones</div>
        <div className="text-sm mt-1">Envía un mensaje por WhatsApp para activarlos</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {actions.map((action) => (
        <div key={action.id} className="flex gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xl flex-shrink-0">{ACTION_ICONS[action.action_type] || '⚙️'}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-purple-300">
                {AGENT_DESCRIPTIONS[action.agent_type] || action.agent_type}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                action.status === 'success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
              }`}>
                {action.status}
              </span>
            </div>
            <div className="text-sm text-white">{action.description}</div>
            <div className="text-xs text-slate-500 mt-1">
              {formatDistanceToNow(new Date(action.created_at), { addSuffix: true, locale: es })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
