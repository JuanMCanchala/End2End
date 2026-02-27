import { runAgentLoop, ToolHandler, AgentLoopResult } from './agent-loop'
import { QUALIFIER_TOOLS } from './tools'
import { buildQualifierPrompt } from '@/lib/utils/prompts'
import { Business, Lead, Conversation, Message, LeadTemperature } from '@/types'
import { logAgentAction } from './agent-actions'
import { createServiceClient } from '@/lib/supabase/server'
import { LEAD_SCORE_THRESHOLDS } from '@/lib/utils/constants'

function calcScore(qualData: Record<string, string>, questions: Business['qualification_questions']): { score: number; temperature: LeadTemperature } {
  if (questions.length === 0) {
    // Sin preguntas configuradas: puntúa por cantidad de campos respondidos (máx 60)
    const answered = Object.keys(qualData).length
    const score = Math.min(answered * 20, 60)
    const temperature: LeadTemperature = score >= LEAD_SCORE_THRESHOLDS.HOT ? 'hot' : score >= LEAD_SCORE_THRESHOLDS.WARM ? 'warm' : 'cold'
    return { score, temperature }
  }

  const totalWeight = questions.reduce((sum, q) => sum + q.weight, 0)
  if (totalWeight === 0) return { score: 0, temperature: 'cold' }

  const answeredWeight = questions
    .filter((q) => qualData[q.field] !== undefined && qualData[q.field] !== '')
    .reduce((sum, q) => sum + q.weight, 0)

  // Base score va de 0 a 80 según preguntas respondidas; los 20 restantes los asigna Claude con update_lead_score
  const score = Math.round((answeredWeight / totalWeight) * 80)
  const temperature: LeadTemperature = score >= LEAD_SCORE_THRESHOLDS.HOT ? 'hot' : score >= LEAD_SCORE_THRESHOLDS.WARM ? 'warm' : 'cold'
  return { score, temperature }
}

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

      // Auto-calcular score cada vez que se guarda una respuesta
      const { score, temperature } = calcScore(qualData, business.qualification_questions)
      const newScore = Math.max(lead.score, score) // nunca bajar el score
      const newStatus = newScore >= LEAD_SCORE_THRESHOLDS.HOT ? 'qualified' : 'qualifying'

      const updatePayload: Record<string, unknown> = {
        qualification_data: qualData,
        score: newScore,
        temperature,
        status: newStatus,
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

      // Actualizar objeto local
      lead.qualification_data = qualData
      lead.score = newScore
      lead.temperature = temperature
      lead.status = newStatus
      if (lead_name) lead.name = lead_name

      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'qualifier',
        action_type: 'save_qualification_answer',
        description: `Respuesta guardada: ${field} = "${value}" → Score auto: ${newScore}/100`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { saved: true, auto_score: newScore, temperature },
      })

      return { success: true, field, value, current_score: newScore }
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
