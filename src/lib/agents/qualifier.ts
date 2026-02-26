import { runAgentLoop, ToolHandler, AgentLoopResult } from './agent-loop'
import { QUALIFIER_TOOLS } from './tools'
import { buildQualifierPrompt } from '@/lib/utils/prompts'
import { Business, Lead, Conversation, Message } from '@/types'
import { logAgentAction } from './agent-actions'
import { createServiceClient } from '@/lib/supabase/server'
import { LEAD_SCORE_THRESHOLDS } from '@/lib/utils/constants'

interface QualifierInput {
  business: Business
  lead: Lead
  conversation: Conversation
  messages: Message[]
  incomingMessage: string
}

export async function runQualifierAgent(input: QualifierInput): Promise<AgentLoopResult> {
  const { business, lead, conversation, messages, incomingMessage } = input
  const supabase = createServiceClient()

  let finalMessage = ''

  const toolHandlers: ToolHandler = {
    save_qualification_answer: async (toolInput) => {
      const { field, value, lead_name } = toolInput as { field: string; value: string; lead_name?: string }

      const qualData = { ...lead.qualification_data, [field]: value }

      const updatePayload: Record<string, unknown> = {
        qualification_data: qualData,
        status: 'qualifying',
        last_interaction: new Date().toISOString(),
      }

      if (lead_name && !lead.name) {
        updatePayload.name = lead_name
      }

      const { error } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', lead.id)

      if (error) throw new Error(error.message)

      // Update local lead object
      lead.qualification_data = qualData
      if (lead_name) lead.name = lead_name

      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'qualifier',
        action_type: 'save_qualification_answer',
        description: `Respuesta guardada: ${field} = ${value}`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { saved: true },
      })

      return { success: true, field, value }
    },

    update_lead_score: async (toolInput) => {
      const { score, temperature, reason } = toolInput as {
        score: number
        temperature: 'hot' | 'warm' | 'cold'
        reason: string
      }

      const newStatus = score >= LEAD_SCORE_THRESHOLDS.HOT ? 'qualified' : 'qualifying'

      const { error } = await supabase
        .from('leads')
        .update({
          score,
          temperature,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)

      if (error) throw new Error(error.message)

      lead.score = score
      lead.temperature = temperature
      lead.status = newStatus

      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'qualifier',
        action_type: 'update_lead_score',
        description: `Lead calificado: Score ${score}/100, Temperatura: ${temperature}. ${reason}`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { score, temperature, status: newStatus },
      })

      return { success: true, score, temperature, status: newStatus }
    },

    send_qualifier_message: async (toolInput) => {
      const { message } = toolInput as { message: string }
      finalMessage = message
      return { success: true, message }
    },
  }

  const systemPrompt = buildQualifierPrompt(business, lead)
  const conversationContext = messages
    .slice(-8)
    .map((m) => ({
      role: m.sender === 'lead' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))
    .slice(0, -1) // Remove last to avoid duplicate

  const result = await runAgentLoop(
    systemPrompt,
    incomingMessage,
    QUALIFIER_TOOLS,
    toolHandlers,
    'qualifier',
    conversationContext
  )

  // Use tool message or LLM response
  return {
    ...result,
    finalResponse: finalMessage || result.finalResponse,
    agentType: 'qualifier',
  }
}
