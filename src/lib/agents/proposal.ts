import { runAgentLoop, ToolHandler, AgentLoopResult } from './agent-loop'
import { PROPOSAL_TOOLS } from './tools'
import { buildProposalPrompt } from '@/lib/utils/prompts'
import { Business, Lead, Conversation, Message } from '@/types'
import { logAgentAction } from './agent-actions'
import { createServiceClient } from '@/lib/supabase/server'

interface ProposalInput {
  business: Business
  lead: Lead
  conversation: Conversation
  messages: Message[]
  incomingMessage: string
}

export async function runProposalAgent(input: ProposalInput): Promise<AgentLoopResult> {
  const { business, lead, conversation, messages, incomingMessage } = input
  const supabase = createServiceClient()

  let proposalMessage = ''

  const toolHandlers: ToolHandler = {
    create_proposal: async (toolInput) => {
      const { title, items, total_amount, currency, message } = toolInput as {
        title: string
        items: Array<{ name: string; description: string; quantity: number; unit_price: number; total: number }>
        total_amount: number
        currency?: string
        message: string
      }

      proposalMessage = message

      const { data, error } = await supabase.from('proposals').insert({
        business_id: business.id,
        lead_id: lead.id,
        conversation_id: conversation.id,
        title,
        content: message,
        items,
        total_amount,
        currency: currency || 'COP',
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).select().single()

      if (error) throw new Error(error.message)

      // Update lead status + boost score
      // Pedir cotización directamente = intención de compra muy alta → mínimo 75 (hot)
      const boostedScore = Math.max(lead.score, 75)
      await supabase.from('leads').update({
        status: 'proposal_sent',
        score: boostedScore,
        temperature: 'hot',
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id)
      lead.score = boostedScore
      lead.temperature = 'hot'

      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'proposal',
        action_type: 'create_proposal',
        description: `Propuesta generada: "${title}" por $${total_amount.toLocaleString()} ${currency || 'COP'}`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { proposal_id: data?.id, total_amount, items_count: items.length },
      })

      return { success: true, proposal_id: data?.id, message }
    },
  }

  const systemPrompt = buildProposalPrompt(business, lead)
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
    PROPOSAL_TOOLS,
    toolHandlers,
    'proposal',
    conversationContext
  )

  return {
    ...result,
    finalResponse: proposalMessage || result.finalResponse,
    agentType: 'proposal',
  }
}
