import { runAgentLoop, ToolHandler, AgentLoopResult } from './agent-loop'
import { SCHEDULER_TOOLS } from './tools'
import { buildSchedulerPrompt } from '@/lib/utils/prompts'
import { Business, Lead, Conversation, Message } from '@/types'
import { logAgentAction } from './agent-actions'
import { createServiceClient } from '@/lib/supabase/server'

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

  const toolHandlers: ToolHandler = {
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

  const systemPrompt = buildSchedulerPrompt(business, lead)
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
