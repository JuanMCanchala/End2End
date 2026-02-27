import { runAgentLoop, ToolHandler, AgentLoopResult } from './agent-loop'
import { SCHEDULER_TOOLS } from './tools'
import { buildSchedulerPrompt } from '@/lib/utils/prompts'
import { Business, Lead, Conversation, Message, LeadTemperature } from '@/types'
import { logAgentAction } from './agent-actions'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getEventTypes,
  getAvailableTimes,
  createSchedulingLink,
  refreshAccessToken,
  CalendlyEventType,
} from '@/lib/calendly/client'

interface SchedulerInput {
  business: Business
  lead: Lead
  conversation: Conversation
  messages: Message[]
  incomingMessage: string
}

export async function runSchedulerAgent(input: SchedulerInput): Promise<AgentLoopResult> {
  const { business, lead, conversation, messages, incomingMessage } = input
  const supabase = createServiceClient()

  let confirmationMessage = ''

  // Fetch Calendly event types upfront if connected
  let calendlyToken: string | null = business.calendly_access_token || null
  let calendlyEventTypes: CalendlyEventType[] = []

  if (calendlyToken && business.calendly_user_uri) {
    try {
      // Refresh token if needed
      if (business.calendly_token_expires_at && business.calendly_refresh_token) {
        const expiresAt = new Date(business.calendly_token_expires_at)
        if (expiresAt < new Date(Date.now() + 5 * 60 * 1000)) {
          const refreshed = await refreshAccessToken(business.calendly_refresh_token)
          calendlyToken = refreshed.access_token
          await supabase.from('businesses').update({
            calendly_access_token: refreshed.access_token,
            calendly_refresh_token: refreshed.refresh_token,
            calendly_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          }).eq('id', business.id)
        }
      }
      calendlyEventTypes = await getEventTypes(calendlyToken, business.calendly_user_uri)
    } catch (err) {
      console.error('Failed to fetch Calendly event types:', err)
      calendlyToken = null
    }
  }

  const toolHandlers: ToolHandler = {
    save_contact_info: async (toolInput) => {
      const { email, phone } = toolInput as { email?: string; phone?: string }
      const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (email) updatePayload.email = email
      if (phone && phone !== lead.phone) updatePayload.phone = phone

      await supabase.from('leads').update(updatePayload).eq('id', lead.id)
      if (email) lead.email = email

      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'scheduler',
        action_type: 'save_contact_info',
        description: `Datos de contacto guardados: ${[email && `email: ${email}`, phone && `tel: ${phone}`].filter(Boolean).join(', ')}`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { email, phone },
      })
      return { success: true, email, phone }
    },

    check_calendly_availability: async (toolInput) => {
      const { event_type_uri, days_ahead = 3 } = toolInput as { event_type_uri: string; days_ahead?: number }
      if (!calendlyToken) return { error: 'Calendly no conectado. Usa create_appointment manualmente.' }

      const startTime = new Date().toISOString()
      const endTime = new Date(Date.now() + Math.min(days_ahead, 5) * 24 * 60 * 60 * 1000).toISOString()

      const slots = await getAvailableTimes(calendlyToken, event_type_uri, startTime, endTime)
      const available = slots.filter((s) => s.status === 'available').slice(0, 8)

      const formatted = available.map((s) => {
        const d = new Date(s.start_time)
        return d.toLocaleString('es-CO', {
          weekday: 'long', day: 'numeric', month: 'long',
          hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
        })
      })

      return { available_slots: formatted, total_available: available.length }
    },

    send_calendly_scheduling_link: async (toolInput) => {
      const { event_type_uri, message } = toolInput as { event_type_uri: string; message: string }
      if (!calendlyToken) return { error: 'Calendly no conectado. Usa create_appointment manualmente.' }

      const bookingUrl = await createSchedulingLink(calendlyToken, event_type_uri)
      const fullMessage = message.replace('{link}', bookingUrl).replace('{url}', bookingUrl)
      const finalMsg = fullMessage.includes('http') ? fullMessage : `${fullMessage}\n\n🗓️ ${bookingUrl}`

      confirmationMessage = finalMsg

      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'scheduler',
        action_type: 'send_calendly_scheduling_link',
        description: `Link de Calendly enviado para tipo de evento: ${event_type_uri}`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { booking_url: bookingUrl },
      })

      return { success: true, booking_url: bookingUrl, message: finalMsg }
    },

    cancel_appointment: async (toolInput) => {
      const { reason, cancellation_message } = toolInput as {
        reason: string
        cancellation_message: string
      }

      confirmationMessage = cancellation_message

      // Buscar la cita activa más reciente del lead
      const { data: appt } = await supabase
        .from('appointments')
        .select('id')
        .eq('lead_id', lead.id)
        .in('status', ['scheduled', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (appt) {
        await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id)
      }

      // Bajar score: cancelación = señal negativa (-30 puntos, mínimo 0)
      const reducedScore = Math.max(0, lead.score - 30)
      const newTemp: LeadTemperature = reducedScore >= 70 ? 'hot' : reducedScore >= 40 ? 'warm' : 'cold'

      await supabase.from('leads').update({
        status: 'qualifying',
        score: reducedScore,
        temperature: newTemp,
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id)
      lead.score = reducedScore
      lead.temperature = newTemp
      lead.status = 'qualifying'

      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'scheduler',
        action_type: 'cancel_appointment',
        description: `Cita cancelada. Razón: ${reason}. Score reducido a ${reducedScore}/100`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { cancelled_appointment_id: appt?.id, new_score: reducedScore, new_temp: newTemp },
      })

      return { success: true, cancellation_message }
    },

    create_appointment: async (toolInput) => {
      const { title, scheduled_at, duration_minutes, location, meeting_link, notes, confirmation_message } = toolInput as {
        title: string
        scheduled_at: string
        duration_minutes?: number
        location?: string
        meeting_link?: string
        notes?: string
        confirmation_message: string
      }

      confirmationMessage = confirmation_message

      const { data, error } = await supabase.from('appointments').insert({
        business_id: business.id,
        lead_id: lead.id,
        conversation_id: conversation.id,
        title,
        scheduled_at,
        duration_minutes: duration_minutes || 30,
        location: location || null,
        meeting_link: meeting_link || null,
        notes: notes || null,
        status: 'scheduled',
      }).select().single()

      if (error) throw new Error(error.message)

      // Update lead status + boost score
      // Agendar reunión = máxima señal de interés → mínimo 80 (hot)
      const boostedScore = Math.max(lead.score, 80)
      await supabase.from('leads').update({
        status: 'meeting_scheduled',
        temperature: 'hot',
        score: boostedScore,
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id)
      lead.score = boostedScore
      lead.temperature = 'hot'

      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'scheduler',
        action_type: 'create_appointment',
        description: `Cita agendada: "${title}" para ${new Date(scheduled_at).toLocaleString('es-CO')}`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { appointment_id: data?.id, scheduled_at },
      })

      return { success: true, appointment_id: data?.id, confirmation_message }
    },
  }

  const systemPrompt = buildSchedulerPrompt(business, lead, calendlyEventTypes)
  const conversationContext = messages
    .slice(-8)
    .map((m) => ({
      role: m.sender === 'lead' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))
    .slice(0, -1)

  const result = await runAgentLoop(
    systemPrompt,
    incomingMessage,
    SCHEDULER_TOOLS,
    toolHandlers,
    'scheduler',
    conversationContext
  )

  return {
    ...result,
    finalResponse: confirmationMessage || result.finalResponse,
    agentType: 'scheduler',
  }
}
