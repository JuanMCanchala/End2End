import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runOrchestratorAgent } from '@/lib/agents/orchestrator'
import { Business, Lead, Conversation, Message } from '@/types'

export const dynamic = 'force-dynamic'

const DEMO_PHONE = '__demo__'

// GET /api/demo/chat — devuelve los mensajes y lead del demo actual
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    const { data: business } = await service
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!business) return NextResponse.json({ messages: [], lead: null })

    const { data: lead } = await service
      .from('leads')
      .select('*')
      .eq('business_id', business.id)
      .eq('phone', DEMO_PHONE)
      .single()

    if (!lead) return NextResponse.json({ messages: [], lead: null })

    const { data: conversation } = await service
      .from('conversations')
      .select('id')
      .eq('lead_id', lead.id)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!conversation) return NextResponse.json({ messages: [], lead })

    const { data: messages } = await service
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(100)

    return NextResponse.json({ messages: messages || [], lead })
  } catch (error) {
    console.error('Demo GET error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST /api/demo/chat — envía un mensaje y recibe la respuesta del agente
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { message } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const service = createServiceClient()

    const { data: business } = await service
      .from('businesses')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Negocio no configurado. Completa el setup primero.' }, { status: 404 })
    }

    // ─── COMANDO /salida — reiniciar demo ───
    if (message.trim().toLowerCase() === '/salida') {
      const { data: demoLead } = await service.from('leads').select('id').eq('business_id', business.id).eq('phone', DEMO_PHONE).single()
      if (demoLead) {
        await service.from('conversations').update({ status: 'closed' }).eq('lead_id', demoLead.id)
        await service.from('leads').update({ score: 0, temperature: 'cold', status: 'new', qualification_data: {}, name: 'Cliente Demo' }).eq('id', demoLead.id)
      }
      const { data: updatedLead } = await service.from('leads').select('*').eq('business_id', business.id).eq('phone', DEMO_PHONE).single()
      return NextResponse.json({
        response: '👋 ¡Hasta luego! La conversación fue cerrada. Escribe un mensaje para iniciar una nueva sesión.',
        agentType: 'system',
        toolsExecuted: [],
        lead: updatedLead,
      })
    }

    // Buscar o crear el lead demo
    let { data: lead } = await service
      .from('leads')
      .select('*')
      .eq('business_id', business.id)
      .eq('phone', DEMO_PHONE)
      .single()

    if (!lead) {
      const { data: newLead, error } = await service
        .from('leads')
        .insert({
          business_id: business.id,
          phone: DEMO_PHONE,
          name: 'Cliente Demo',
          status: 'new',
          temperature: 'cold',
          score: 0,
          qualification_data: {},
        })
        .select()
        .single()
      if (error || !newLead) return NextResponse.json({ error: 'Error creando lead demo' }, { status: 500 })
      lead = newLead
    }

    // Buscar conversación demo activa o crear una
    let { data: conversation } = await service
      .from('conversations')
      .select('*')
      .eq('lead_id', lead.id)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!conversation) {
      const { data: newConv, error } = await service
        .from('conversations')
        .insert({
          business_id: business.id,
          lead_id: lead.id,
          status: 'active',
          channel: 'demo',
        })
        .select()
        .single()
      if (error || !newConv) return NextResponse.json({ error: 'Error creando conversación demo' }, { status: 500 })
      conversation = newConv
    }

    // Guardar mensaje del "cliente"
    await service.from('messages').insert({
      conversation_id: conversation.id,
      sender: 'lead',
      content: message.trim(),
      metadata: { demo: true },
    })

    // Historial de mensajes
    const { data: messages } = await service
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(20)

    // Correr el pipeline de agentes completo (igual que el webhook, sin Twilio)
    const result = await runOrchestratorAgent({
      business: business as Business,
      lead: lead as Lead,
      conversation: conversation as Conversation,
      messages: (messages || []) as Message[],
      incomingMessage: message.trim(),
    })

    // Guardar respuesta del agente
    if (result.finalResponse) {
      await service.from('messages').insert({
        conversation_id: conversation.id,
        sender: 'agent',
        agent_type: result.agentType,
        content: result.finalResponse,
        metadata: { tools_executed: result.toolsExecuted.map((t) => t.tool), demo: true },
      })

      await service
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id)
    }

    // Traer el lead actualizado (score, temperatura, etc. pueden haber cambiado)
    const { data: updatedLead } = await service.from('leads').select('*').eq('id', lead.id).single()

    return NextResponse.json({
      response: result.finalResponse,
      agentType: result.agentType,
      toolsExecuted: result.toolsExecuted.map((t) => t.tool),
      lead: updatedLead,
      conversationId: conversation.id,
    })
  } catch (error) {
    console.error('Demo chat error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE /api/demo/chat — reinicia el demo (nuevo lead en blanco)
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    const { data: business } = await service
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: lead } = await service
      .from('leads')
      .select('id')
      .eq('business_id', business.id)
      .eq('phone', DEMO_PHONE)
      .single()

    if (lead) {
      // Cerrar conversaciones demo activas
      await service.from('conversations').update({ status: 'closed' }).eq('lead_id', lead.id)

      // Resetear el lead a estado inicial
      await service.from('leads').update({
        score: 0,
        temperature: 'cold',
        status: 'new',
        qualification_data: {},
        name: 'Cliente Demo',
      }).eq('id', lead.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Demo reset error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
