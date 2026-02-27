export const LEAD_SCORE_THRESHOLDS = {
  HOT: 70,
  WARM: 40,
  COLD: 0,
} as const

export const AGENT_DESCRIPTIONS = {
  orchestrator: '🧠 Orquestador',
  qualifier: '🎯 Calificador',
  followup: '📅 Seguimiento',
  proposal: '📄 Propuestas',
  scheduler: '🗓️ Agenda',
  system: '⚙️ Sistema',
  purchase: '🛒 Compras',
} as const

export const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  qualifying: 'Calificando',
  qualified: 'Calificado',
  proposal_sent: 'Propuesta enviada',
  meeting_scheduled: 'Reunión agendada',
  won: 'Ganado',
  lost: 'Perdido',
  sale_pending: '🧾 Venta por verificar',
}

export const TEMPERATURE_LABELS = {
  hot: '🔥 Caliente',
  warm: '🌡️ Tibio',
  cold: '❄️ Frío',
} as const

export const TEMPERATURE_COLORS = {
  hot: 'bg-red-100 text-red-800',
  warm: 'bg-orange-100 text-orange-800',
  cold: 'bg-blue-100 text-blue-800',
} as const
