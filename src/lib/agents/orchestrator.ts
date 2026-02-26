import { runAgentLoop, ToolHandler, AgentLoopResult } from './agent-loop'
import { ORCHESTRATOR_TOOLS } from './tools'
import { buildOrchestratorPrompt } from '@/lib/utils/prompts'
import { Business, Lead, Conversation, Message } from '@/types'
import { runQualifierAgent } from './qualifier'
import { runProposalAgent } from './proposal'
import { runSchedulerAgent } from './scheduler'
import { runFollowupAgent } from './followup'
import { logAgentAction } from './agent-actions'
import { createServiceClient } from '@/lib/supabase/server'

interface OrchestratorInput {
  business: Business
  lead: Lead
  conversation: Conversation
  messages: Message[]
  incomingMessage: string
}

export async function runOrchestratorAgent(input: OrchestratorInput): Promise<AgentLoopResult> {
  const { business, lead, conversation, messages, incomingMessage } = input
  const supabase = createServiceClient()

  let routedAgent: string | null = null
  let routedResult: AgentLoopResult | null = null

  const toolHandlers: ToolHandler = {
    route_to_qualifier: async (toolInput) => {
      routedAgent = 'qualifier'
      routedResult = await runQualifierAgent({ business, lead, conversation, messages, incomingMessage })
      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'orchestrator',
        action_type: 'route_to_qualifier',
        description: `Ruteado al Calificador: ${(toolInput as { reason: string }).reason}`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { routed_to: 'qualifier' },
      })
      return { success: true, routed_to: 'qualifier' }
    },

    route_to_proposal: async (toolInput) => {
      routedAgent = 'proposal'
      routedResult = await runProposalAgent({ business, lead, conversation, messages, incomingMessage })
      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'orchestrator',
        action_type: 'route_to_proposal',
        description: `Ruteado al Agente de Propuestas: ${(toolInput as { product_interest: string }).product_interest}`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { routed_to: 'proposal' },
      })
      return { success: true, routed_to: 'proposal' }
    },

    route_to_scheduler: async (toolInput) => {
      routedAgent = 'scheduler'
      routedResult = await runSchedulerAgent({ business, lead, conversation, messages, incomingMessage })
      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'orchestrator',
        action_type: 'route_to_scheduler',
        description: `Ruteado al Agente de Agenda: ${(toolInput as { meeting_type: string }).meeting_type}`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { routed_to: 'scheduler' },
      })
      return { success: true, routed_to: 'scheduler' }
    },

    route_to_followup: async (toolInput) => {
      routedAgent = 'followup'
      routedResult = await runFollowupAgent({ business, lead, conversation, messages, incomingMessage })
      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'orchestrator',
        action_type: 'route_to_followup',
        description: `Ruteado al Agente de Seguimiento`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { routed_to: 'followup' },
      })
      return { success: true, routed_to: 'followup' }
    },

    send_direct_response: async (toolInput) => {
      const { message } = toolInput as { message: string }
      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'orchestrator',
        action_type: 'send_direct_response',
        description: 'Respuesta directa del orquestador',
        input_data: toolInput as Record<string, unknown>,
        output_data: { message },
      })
      return { success: true, message }
    },
  }

  const systemPrompt = buildOrchestratorPrompt(business, lead, messages)

  const result = await runAgentLoop(
    systemPrompt,
    incomingMessage,
    ORCHESTRATOR_TOOLS,
    toolHandlers,
    'orchestrator'
  )

  // If we routed to a specialist, return that agent's result
  if (routedResult) {
    return routedResult
  }

  // Check if direct response was sent via tool
  const directResponseTool = result.toolsExecuted.find((t) => t.tool === 'send_direct_response')
  if (directResponseTool) {
    const output = directResponseTool.output as { message: string }
    return {
      ...result,
      finalResponse: output.message,
      agentType: 'orchestrator',
    }
  }

  return result
}
