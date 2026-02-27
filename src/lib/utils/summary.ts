// Generador de resúmenes para admins via Telegram

import { createServiceClient } from '@/lib/supabase/server'

export type SummaryPeriod = 'dia' | 'semana' | 'mes'

function getPeriodStart(period: SummaryPeriod): string {
  const now = new Date()
  // Zona Colombia UTC-5
  const colombia = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))

  if (period === 'dia') {
    colombia.setHours(0, 0, 0, 0)
  } else if (period === 'semana') {
    const day = colombia.getDay() // 0=Dom
    colombia.setDate(colombia.getDate() - day)
    colombia.setHours(0, 0, 0, 0)
  } else {
    colombia.setDate(1)
    colombia.setHours(0, 0, 0, 0)
  }

  // Convertir de vuelta a UTC para la query
  const offset = -5 * 60 // Colombia UTC-5
  const utc = new Date(colombia.getTime() - offset * 60 * 1000)
  return utc.toISOString()
}

const periodLabel: Record<SummaryPeriod, string> = {
  dia: 'de hoy',
  semana: 'de esta semana',
  mes: 'de este mes',
}

export async function generateSummary(businessId: string, period: SummaryPeriod): Promise<string> {
  const supabase = createServiceClient()
  const since = getPeriodStart(period)
  const label = periodLabel[period]

  // Leads nuevos en el período
  const { data: newLeads } = await supabase
    .from('leads')
    .select('id, name, temperature, score, status')
    .eq('business_id', businessId)
    .gte('created_at', since)

  // Total leads activos (todos)
  const { data: allLeads } = await supabase
    .from('leads')
    .select('temperature, status')
    .eq('business_id', businessId)

  // Conversaciones activas
  const { data: conversations } = await supabase
    .from('conversations')
    .select('status')
    .eq('business_id', businessId)
    .neq('status', 'closed')

  // Citas del período
  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, title, scheduled_at, status')
    .eq('business_id', businessId)
    .gte('created_at', since)

  // Propuestas del período
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, status, total_amount, currency')
    .eq('business_id', businessId)
    .gte('created_at', since)

  // Calcular métricas
  const leads = newLeads || []
  const all = allLeads || []
  const convs = conversations || []
  const appts = appointments || []
  const props = proposals || []

  type LeadRow = { id: string; name: string | null; temperature: string; score: number; status: string }
  type ConvRow = { status: string }
  type ProposalRow = { id: string; status: string; total_amount: number | null; currency: string }
  type ApptRow = { id: string; title: string; scheduled_at: string; status: string }

  const hot = (all as LeadRow[]).filter(l => l.temperature === 'hot').length
  const warm = (all as LeadRow[]).filter(l => l.temperature === 'warm').length
  const cold = (all as LeadRow[]).filter(l => l.temperature === 'cold').length

  const wonLeads = (all as LeadRow[]).filter(l => l.status === 'won').length
  const humanTakeover = (convs as ConvRow[]).filter(c => c.status === 'human_takeover').length

  const proposalsSent = (props as ProposalRow[]).filter(p => p.status === 'sent' || p.status === 'accepted').length
  const proposalsAccepted = (props as ProposalRow[]).filter(p => p.status === 'accepted').length

  const apptScheduled = (appts as ApptRow[]).filter(a => a.status !== 'cancelled').length
  const apptCancelled = (appts as ApptRow[]).filter(a => a.status === 'cancelled').length

  // Leads con mejor score del período
  const topLeads = (leads as LeadRow[])
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(l => `  • ${l.name || 'Sin nombre'} — score ${l.score} (${l.temperature})`)
    .join('\n')

  const now = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'America/Bogota',
  })

  return `📊 *Resumen ${label}*
📅 ${now}
${'─'.repeat(28)}

👥 *Leads nuevos ${label}:* ${leads.length}
${topLeads ? `\nTop leads:\n${topLeads}\n` : ''}
📈 *Estado general del pipeline:*
  🔴 Calientes: ${hot}
  🟡 Tibios: ${warm}
  🔵 Fríos: ${cold}
  ✅ Ganados: ${wonLeads}

💬 *Conversaciones activas:* ${convs.length}${humanTakeover > 0 ? ` (${humanTakeover} en modo humano ⚠️)` : ''}

📄 *Propuestas ${label}:* ${props.length}
  Enviadas: ${proposalsSent}
  Aceptadas: ${proposalsAccepted}

🗓️ *Citas ${label}:* ${apptScheduled}${apptCancelled > 0 ? ` (${apptCancelled} canceladas)` : ''}

${'─'.repeat(28)}
_End2End · Sistema Multi-Agente_`
}

/** Detecta si el mensaje es un comando de resumen admin */
export function parseAdminCommand(text: string): SummaryPeriod | 'ayuda' | null {
  const t = text.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes

  if (t === 'ayuda' || t === '/ayuda' || t === 'help') return 'ayuda'

  if (t.includes('dia') || t.includes('hoy') || t === 'resumen') return 'dia'
  if (t.includes('semana')) return 'semana'
  if (t.includes('mes')) return 'mes'

  return null
}

export const ADMIN_HELP = `🤖 *Comandos disponibles:*

📊 *resumen dia* — Resumen de hoy
📊 *resumen semana* — Resumen de esta semana
📊 *resumen mes* — Resumen de este mes
❓ *ayuda* — Ver este mensaje

_Eres reconocido como administrador de tu empresa._`
