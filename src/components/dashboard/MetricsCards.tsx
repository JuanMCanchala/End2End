'use client'

import { DashboardMetrics } from '@/types'

interface MetricsCardsProps {
  metrics: DashboardMetrics | null
}

function MetricCard({ icon, label, value, sub, color }: {
  icon: string
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${color || 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  if (!metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-2/3 mb-3" />
            <div className="h-8 bg-slate-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard
        icon="👥"
        label="Total Leads"
        value={metrics.total_leads}
        sub={`+${metrics.leads_today} hoy`}
      />
      <MetricCard
        icon="🔥"
        label="Leads Calientes"
        value={metrics.hot_leads}
        color="text-red-400"
        sub={`${metrics.warm_leads} tibios`}
      />
      <MetricCard
        icon="💬"
        label="Conversaciones Activas"
        value={metrics.active_conversations}
        sub={`${metrics.human_takeover_conversations} con humano`}
      />
      <MetricCard
        icon="⚡"
        label="Tiempo de Respuesta"
        value={`${metrics.avg_response_time_seconds}s`}
        color="text-green-400"
        sub="promedio IA"
      />
      <MetricCard
        icon="📄"
        label="Propuestas Enviadas"
        value={metrics.proposals_sent}
        color="text-blue-400"
      />
      <MetricCard
        icon="🗓️"
        label="Citas Agendadas"
        value={metrics.appointments_scheduled}
        color="text-purple-400"
      />
      <MetricCard
        icon="📈"
        label="Conversión"
        value={`${metrics.conversion_rate}%`}
        color="text-emerald-400"
      />
      <MetricCard
        icon="💌"
        label="Mensajes Hoy"
        value={metrics.messages_today}
        sub="enviados por IA"
      />
    </div>
  )
}
