import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getScheduledEvents, getEventInvitees, refreshAccessToken } from '@/lib/calendly/client'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!business?.calendly_access_token || !business?.calendly_org_uri) {
      return NextResponse.json({ error: 'Calendly no conectado' }, { status: 400 })
    }

    let token = business.calendly_access_token

    // Refresh token if expired
    if (business.calendly_token_expires_at) {
      const expiresAt = new Date(business.calendly_token_expires_at)
      if (expiresAt < new Date() && business.calendly_refresh_token) {
        const refreshed = await refreshAccessToken(business.calendly_refresh_token)
        token = refreshed.access_token
        await supabase
          .from('businesses')
          .update({
            calendly_access_token: refreshed.access_token,
            calendly_refresh_token: refreshed.refresh_token,
            calendly_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          })
          .eq('id', business.id)
      }
    }

    const minStartTime = new Date().toISOString()
    const events = await getScheduledEvents(token, business.calendly_org_uri, minStartTime)

    let synced = 0

    for (const event of events) {
      // Skip if already in DB
      const { data: existing } = await supabase
        .from('appointments')
        .select('id')
        .eq('calendly_event_uri', event.uri)
        .single()

      if (existing) continue

      // Get invitee details
      const invitees = await getEventInvitees(token, event.uri).catch(() => [])
      const invitee = invitees[0]

      // Find lead by email
      let leadId: string | null = null
      if (invitee?.email) {
        const { data: lead } = await supabase
          .from('leads')
          .select('id')
          .eq('business_id', business.id)
          .eq('email', invitee.email)
          .single()
        leadId = lead?.id || null
      }

      if (!leadId) continue // skip events without matching lead

      // Find conversation
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('lead_id', leadId)
        .neq('status', 'closed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const durationMs = new Date(event.end_time).getTime() - new Date(event.start_time).getTime()

      await supabase.from('appointments').insert({
        business_id: business.id,
        lead_id: leadId,
        conversation_id: conversation?.id || null,
        title: event.name,
        scheduled_at: event.start_time,
        duration_minutes: Math.round(durationMs / 60000),
        meeting_link: event.location?.join_url || null,
        status: 'confirmed',
        calendly_event_uri: event.uri,
      })

      synced++
    }

    return NextResponse.json({ synced, total: events.length })
  } catch (err) {
    console.error('Calendly sync error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
