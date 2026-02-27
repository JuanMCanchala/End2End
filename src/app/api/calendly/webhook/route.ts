import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { getEventInvitees } from '@/lib/calendly/client'

export const dynamic = 'force-dynamic'

function verifySignature(signatureHeader: string, rawBody: string): boolean {
  try {
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((p) => {
        const idx = p.indexOf('=')
        return [p.slice(0, idx), p.slice(idx + 1)]
      })
    )
    const { t: timestamp, v1 } = parts
    if (!timestamp || !v1) return false

    const toSign = `${timestamp}.${rawBody}`
    const expected = createHmac('sha256', process.env.CALENDLY_WEBHOOK_SIGNING_KEY!)
      .update(toSign)
      .digest('hex')

    return expected === v1
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signatureHeader = req.headers.get('Calendly-Webhook-Signature') || ''

  if (!verifySignature(signatureHeader, rawBody)) {
    console.error('Calendly webhook: invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = payload.event as string
  const data = payload.payload as Record<string, unknown>

  const supabase = createServiceClient()

  try {
    if (event === 'invitee.created') {
      await handleInviteeCreated(supabase, data)
    } else if (event === 'invitee.canceled') {
      await handleInviteeCanceled(supabase, data)
    }
  } catch (err) {
    console.error(`Calendly webhook handler error (${event}):`, err)
    // Return 200 to prevent Calendly from retrying indefinitely
  }

  return NextResponse.json({ received: true })
}

async function handleInviteeCreated(
  supabase: ReturnType<typeof createServiceClient>,
  data: Record<string, unknown>
) {
  const scheduledEvent = data.scheduled_event as Record<string, unknown>
  if (!scheduledEvent) return

  const eventUri = scheduledEvent.uri as string
  const startTime = scheduledEvent.start_time as string
  const endTime = scheduledEvent.end_time as string
  const eventName = scheduledEvent.name as string
  const memberships = scheduledEvent.event_memberships as Array<{ user: string }>
  const location = scheduledEvent.location as { join_url?: string; type?: string } | undefined

  // Find the business by calendly_user_uri
  const ownerUserUri = memberships?.[0]?.user
  if (!ownerUserUri) return

  const { data: business } = await supabase
    .from('businesses')
    .select('id, calendly_access_token')
    .eq('calendly_user_uri', ownerUserUri)
    .single()

  if (!business) return

  // Get invitee details from webhook payload
  const inviteeName = data.name as string
  const inviteeEmail = data.email as string
  const inviteeUri = data.uri as string

  // Find or create lead by email
  let lead = null
  if (inviteeEmail) {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .eq('business_id', business.id)
      .eq('email', inviteeEmail)
      .single()

    if (existingLead) {
      lead = existingLead
    } else {
      // Try by phone if no email match — not possible here, create new lead
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          business_id: business.id,
          name: inviteeName,
          email: inviteeEmail,
          phone: `calendly_${Date.now()}`, // placeholder, no phone from Calendly
          status: 'meeting_scheduled',
          temperature: 'hot',
          score: 80,
          qualification_data: {},
        })
        .select()
        .single()
      lead = newLead
    }
  }

  if (!lead) return

  // Update lead status
  await supabase
    .from('leads')
    .update({
      status: 'meeting_scheduled',
      temperature: 'hot',
      score: Math.max(lead.score, 80),
      name: lead.name || inviteeName,
      email: lead.email || inviteeEmail,
      last_interaction: new Date().toISOString(),
    })
    .eq('id', lead.id)

  // Find or create conversation
  let { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('lead_id', lead.id)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!conversation) {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        business_id: business.id,
        lead_id: lead.id,
        status: 'active',
        channel: 'calendly',
      })
      .select()
      .single()
    conversation = newConv
  }

  if (!conversation) return

  // Check if appointment already exists for this Calendly event
  const { data: existing } = await supabase
    .from('appointments')
    .select('id')
    .eq('calendly_event_uri', eventUri)
    .single()

  if (existing) return // already recorded

  // Create appointment
  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime()
  const durationMinutes = Math.round(durationMs / 60000)

  await supabase.from('appointments').insert({
    business_id: business.id,
    lead_id: lead.id,
    conversation_id: conversation.id,
    title: eventName || 'Reunión agendada',
    scheduled_at: startTime,
    duration_minutes: durationMinutes,
    meeting_link: location?.join_url || null,
    location: location?.type && location.type !== 'zoom' ? location.type : null,
    status: 'confirmed',
    calendly_event_uri: eventUri,
    calendly_invitee_uri: inviteeUri,
  })
}

async function handleInviteeCanceled(
  supabase: ReturnType<typeof createServiceClient>,
  data: Record<string, unknown>
) {
  const scheduledEvent = data.scheduled_event as Record<string, unknown>
  const eventUri = scheduledEvent?.uri as string
  if (!eventUri) return

  // Find appointment by calendly_event_uri
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, lead_id')
    .eq('calendly_event_uri', eventUri)
    .single()

  if (!appointment) return

  // Cancel appointment
  await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointment.id)

  // Reduce lead score
  const { data: lead } = await supabase
    .from('leads')
    .select('score, temperature')
    .eq('id', appointment.lead_id)
    .single()

  if (lead) {
    const reducedScore = Math.max(0, lead.score - 30)
    const newTemp = reducedScore >= 70 ? 'hot' : reducedScore >= 40 ? 'warm' : 'cold'
    await supabase
      .from('leads')
      .update({ score: reducedScore, temperature: newTemp, status: 'qualifying' })
      .eq('id', appointment.lead_id)
  }
}
