import { runAgentLoop, ToolHandler, AgentLoopResult } from './agent-loop'
import { FOLLOWUP_TOOLS } from './tools'
import { buildFollowupPrompt } from '@/lib/utils/prompts'
import { Business, Lead, Conversation, Message } from '@/types'
import { logAgentAction } from './agent-actions'
import { createServiceClient } from '@/lib/supabase/server'

interface FollowupInput {
  business: Business
  lead: Lead
  conversation: Conversation
  messages: Message[]
  incomingMessage: string
}

export async function runFollowupAgent(input: FollowupInput): Promise<AgentLoopResult> {
  const { business, lead, conversation, messages, incomingMessage } = input
  const supabase = createServiceClient()

  let confirmationToLead = ''

  const toolHandlers: ToolHandler = {
    schedule_followup: async (toolInput) => {
      const { scheduled_at, message, confirmation_to_lead } = toolInput as {
        scheduled_at: string
        message: string
        confirmation_to_lead: string
      }

      confirmationToLead = confirmation_to_lead

      const { data, error } = await supabase.from('followups').insert({
        business_id: business.id,
        lead_id: lead.id,
        conversation_id: conversation.id,
        scheduled_at,
        message,
        status: 'pending',
      }).select().single()

      if (error) throw new Error(error.message)

      const scheduledDate = new Date(scheduled_at).toLocaleString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })

      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'followup',
        action_type: 'schedule_followup',
        description: `Seguimiento programado para ${scheduledDate}`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { followup_id: data?.id, scheduled_at },
      })

      return { success: true, followup_id: data?.id, scheduled_at }
    },
  }

  const systemPrompt = buildFollowupPrompt(business, lead)
  const conversationContext = messages
    .slice(-6)
    .map((m) => ({
      role: m.sender === 'lead' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))
    .slice(0, -1)

  const result = await runAgentLoop(
    systemPrompt,
    incomingMessage,
    FOLLOWUP_TOOLS,
    toolHandlers,
    'followup',
    conversationContext
  )

  return {
    ...result,
    finalResponse: confirmationToLead || result.finalResponse,
    agentType: 'followup',
  }
}
