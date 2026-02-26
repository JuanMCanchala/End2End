import { SupabaseClient } from '@supabase/supabase-js'
import { AgentType } from '@/types'

interface LogActionInput {
  business_id: string
  conversation_id?: string | null
  lead_id?: string | null
  agent_type: AgentType
  action_type: string
  description: string
  input_data?: Record<string, unknown>
  output_data?: Record<string, unknown>
  status?: 'success' | 'failed' | 'pending'
}

export async function logAgentAction(
  supabase: SupabaseClient,
  action: LogActionInput
): Promise<void> {
  try {
    await supabase.from('agent_actions').insert({
      business_id: action.business_id,
      conversation_id: action.conversation_id || null,
      lead_id: action.lead_id || null,
      agent_type: action.agent_type,
      action_type: action.action_type,
      description: action.description,
      input_data: action.input_data || {},
      output_data: action.output_data || {},
      status: action.status || 'success',
    })
  } catch (error) {
    console.error('Failed to log agent action:', error)
  }
}
