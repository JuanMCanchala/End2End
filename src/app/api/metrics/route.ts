import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single()
    if (!business) return NextResponse.json({ metrics: null })

    const businessId = business.id
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Run queries in parallel
    const [
      { count: totalLeads },
      { data: leadsByTemp },
      { data: conversations },
      { count: proposalsSent },
      { count: appointmentsScheduled },
      { count: messagesToday },
      { count: leadsToday },
      { data: agentActions },
    ] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
      supabase.from('leads').select('temperature').eq('business_id', businessId),
      supabase.from('conversations').select('status').eq('business_id', businessId),
      supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'sent'),
      supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('business_id', businessId).in('status', ['scheduled', 'confirmed']),
      supabase.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', today.toISOString()),
      supabase.from('agent_actions').select('created_at').eq('business_id', businessId).order('created_at', { ascending: false }).limit(7),
    ])

    const tempCounts = (leadsByTemp || []).reduce((acc: Record<string, number>, l: { temperature: string }) => {
      acc[l.temperature] = (acc[l.temperature] || 0) + 1
      return acc
    }, {})

    const convCounts = (conversations || []).reduce((acc: Record<string, number>, c: { status: string }) => {
      acc[c.status] = (acc[c.status] || 0) + 1
      return acc
    }, {})

    const wonLeads = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'won')

    const conversionRate = totalLeads && totalLeads > 0
      ? Math.round(((wonLeads.count || 0) / totalLeads) * 100)
      : 0

    // Calculate avg response time from agent_actions
    const avgResponseTime = agentActions && agentActions.length > 1
      ? Math.round(
          agentActions.slice(0, -1).reduce((sum: number, action: { created_at: string }, i: number) => {
            const diff = new Date(action.created_at).getTime() - new Date(agentActions[i + 1].created_at).getTime()
            return sum + Math.abs(diff)
          }, 0) / (agentActions.length - 1) / 1000
        )
      : 3

    return NextResponse.json({
      metrics: {
        total_leads: totalLeads || 0,
        hot_leads: tempCounts.hot || 0,
        warm_leads: tempCounts.warm || 0,
        cold_leads: tempCounts.cold || 0,
        active_conversations: convCounts.active || 0,
        human_takeover_conversations: convCounts.human_takeover || 0,
        proposals_sent: proposalsSent || 0,
        appointments_scheduled: appointmentsScheduled || 0,
        conversion_rate: conversionRate,
        avg_response_time_seconds: avgResponseTime,
        messages_today: messagesToday || 0,
        leads_today: leadsToday || 0,
      },
    })
  } catch (error) {
    console.error('Metrics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
