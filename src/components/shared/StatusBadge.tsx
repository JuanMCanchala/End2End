import { ConversationStatus, LeadTemperature } from '@/types'

interface StatusBadgeProps {
  status: ConversationStatus
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  active: { label: 'Activo', class: 'bg-green-900/50 text-green-400 border-green-700' },
  human_takeover: { label: '🧑 Humano', class: 'bg-blue-900/50 text-blue-400 border-blue-700' },
  paused: { label: 'Pausado', class: 'bg-yellow-900/50 text-yellow-400 border-yellow-700' },
  closed: { label: 'Cerrado', class: 'bg-slate-800 text-slate-500 border-slate-700' },
  sale_pending: { label: '🧾 Venta por verificar', class: 'bg-amber-900/50 text-amber-400 border-amber-700' },
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.closed
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.class}`}>
      {config.label}
    </span>
  )
}
