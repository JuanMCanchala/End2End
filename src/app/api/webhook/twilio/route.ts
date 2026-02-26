import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseTwilioWebhook, sendWhatsAppMessage } from '@/lib/twilio/client'
import { runOrchestratorAgent } from '@/lib/agents/orchestrator'
import { Business, Lead, Conversation, Message } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const body: Record<string, string> = {}
    formData.forEach((value, key) => { body[key] = value.toString() })

    const { from, body: messageBody, profileName } = parseTwilioWebhook(body)

    if (!messageBody || !from) {
      return new NextResponse(null, { status: 200 })
    }

    const supabase = createServiceClient()

    // Get the business (for demo: first business or by whatsapp number)
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!business) {
      console.log('No business found. Setup required.')
      return new NextResponse(null, { status: 200 })
    }

    // Normalize phone number
    const phone = from.replace('whatsapp:', '')

    // Find or create lead
    let lead: Lead
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .eq('business_id', business.id)
      .eq('phone', phone)
      .single()

    if (existingLead) {
      lead = existingLead
      // Update last interaction
      await supabase.from('leads').update({ last_interaction: new Date().toISOString() }).eq('id', lead.id)
    } else {
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          business_id: business.id,
          phone,
          name: profileName || null,
          status: 'new',
          temperature: 'cold',
          score: 0,
        })
        .select()
        .single()

      if (error || !newLead) {
        console.error('Failed to create lead:', error)
        return new NextResponse(null, { status: 200 })
      }
      lead = newLead
    }

    // Find or create conversation
    let conversation: Conversation
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', lead.id)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingConv) {
      conversation = existingConv
    } else {
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          business_id: business.id,
          lead_id: lead.id,
          status: 'active',
          channel: 'whatsapp',
        })
        .select()
        .single()

      if (error || !newConv) {
        console.error('Failed to create conversation:', error)
        return new NextResponse(null, { status: 200 })
      }
      conversation = newConv
    }

    // Check if human takeover is active
    if (conversation.status === 'human_takeover') {
      // Save the message but don't auto-respond
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender: 'lead',
        content: messageBody,
        metadata: { from, profile_name: profileName },
      })

      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString(),
      }).eq('id', conversation.id)

      return new NextResponse(null, { status: 200 })
    }

    // Save incoming message
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender: 'lead',
      content: messageBody,
      metadata: { from, profile_name: profileName },
    })

    // Get conversation history
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(20)

    // Run orchestrator agent
    const result = await runOrchestratorAgent({
      business: business as Business,
      lead,
      conversation,
      messages: (messages || []) as Message[],
      incomingMessage: messageBody,
    })

    // Save agent response
    if (result.finalResponse) {
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender: 'agent',
        agent_type: result.agentType,
        content: result.finalResponse,
        metadata: { tools_executed: result.toolsExecuted.map((t) => t.tool) },
      })

      // Update conversation last message
      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString(),
      }).eq('id', conversation.id)

      // Send WhatsApp response
      await sendWhatsAppMessage(from, result.finalResponse)
    }

    return new NextResponse(null, { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return new NextResponse('Error', { status: 500 })
  }
}

// Twilio verification for GET (health check)
export async function GET() {
  return NextResponse.json({ status: 'VentasIA webhook active' })
}
