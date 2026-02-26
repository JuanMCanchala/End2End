import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { createServiceClient } from '@/lib/supabase/server'
import { runOrchestratorAgent } from '@/lib/agents/orchestrator'
import { sendWhatsAppMessage } from '@/lib/twilio/client'
import { Business, Lead, Conversation, Message } from '@/types'

// Manual trigger for processing - useful for testing and retries
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { conversation_id, message } = await req.json()

    const serviceSupabase = createServiceClient()

    const { data: conversation } = await serviceSupabase
      .from('conversations')
      .select('*, lead:leads(*)')
      .eq('id', conversation_id)
      .single()

    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

    const { data: business } = await serviceSupabase
      .from('businesses')
      .select('*')
      .eq('id', conversation.business_id)
      .single()

    const { data: messages } = await serviceSupabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(20)

    const result = await runOrchestratorAgent({
      business: business as Business,
      lead: conversation.lead as Lead,
      conversation: conversation as Conversation,
      messages: (messages || []) as Message[],
      incomingMessage: message,
    })

    if (result.finalResponse) {
      await serviceSupabase.from('messages').insert({
        conversation_id,
        sender: 'agent',
        agent_type: result.agentType,
        content: result.finalResponse,
        metadata: { tools_executed: result.toolsExecuted.map((t) => t.tool), manual_trigger: true },
      })

      await serviceSupabase.from('conversations').update({
        last_message_at: new Date().toISOString(),
      }).eq('id', conversation_id)

      const phone = (conversation.lead as Lead).phone
      await sendWhatsAppMessage(phone, result.finalResponse)
    }

    return NextResponse.json({
      success: true,
      response: result.finalResponse,
      agent_type: result.agentType,
      tools_executed: result.toolsExecuted.map((t) => t.tool),
    })
  } catch (error) {
    console.error('Process agent error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
