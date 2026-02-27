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
    const phone = from.replace('whatsapp:', '')

    // ─── PASO 1: ¿Está este número esperando seleccionar empresa? ───
    const { data: pending } = await supabase
      .from('pending_selections')
      .select('*')
      .eq('phone', phone)
      .single()

    if (pending) {
      // El lead respondió con un número de selección
      const options: Array<{ index: number; business_id: string; name: string }> = pending.options
      const selection = parseInt(messageBody.trim())
      const chosen = options.find((o) => o.index === selection)

      if (!chosen) {
        // Selección inválida — reenviar el menú
        const menu = buildBusinessMenu(options.map((o) => ({ id: o.business_id, name: o.name })))
        await sendWhatsAppMessage(from, `Opción inválida. Por favor elige un número:\n\n${menu}`)
        return new NextResponse(null, { status: 200 })
      }

      // Selección válida → obtener la empresa elegida
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', chosen.business_id)
        .single()

      if (!business) {
        return new NextResponse(null, { status: 200 })
      }

      // Eliminar el registro pendiente
      await supabase.from('pending_selections').delete().eq('phone', phone)

      // Crear lead y conversación con la empresa elegida
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          business_id: business.id,
          phone,
          name: pending.profile_name || null,
          status: 'new',
          temperature: 'cold',
          score: 0,
        })
        .select()
        .single()

      if (leadError || !newLead) {
        console.error('Failed to create lead after selection:', leadError)
        return new NextResponse(null, { status: 200 })
      }

      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          business_id: business.id,
          lead_id: newLead.id,
          status: 'active',
          channel: 'whatsapp',
        })
        .select()
        .single()

      if (convError || !newConv) {
        console.error('Failed to create conversation after selection:', convError)
        return new NextResponse(null, { status: 200 })
      }

      // Guardar el mensaje de selección
      await supabase.from('messages').insert({
        conversation_id: newConv.id,
        sender: 'lead',
        content: messageBody,
        metadata: { from, profile_name: pending.profile_name },
      })

      // Arrancar el flujo normal con el mensaje original siendo la selección
      const welcomeMessage = `¡Perfecto! Te conecto con *${business.name}* 🎉\n\n¿En qué te podemos ayudar hoy?`

      await supabase.from('messages').insert({
        conversation_id: newConv.id,
        sender: 'agent',
        agent_type: 'orchestrator',
        content: welcomeMessage,
        metadata: { system_event: true },
      })

      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString(),
      }).eq('id', newConv.id)

      await sendWhatsAppMessage(from, welcomeMessage)
      return new NextResponse(null, { status: 200 })
    }

    // ─── PASO 2: ¿Tiene este número una conversación activa? ───
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingLead) {
      // Lead conocido — usar su empresa asignada
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', existingLead.business_id)
        .single()

      if (!business) return new NextResponse(null, { status: 200 })

      await supabase.from('leads').update({ last_interaction: new Date().toISOString() }).eq('id', existingLead.id)

      return await processMessage({
        supabase, from, messageBody, profileName,
        business: business as Business,
        lead: existingLead as Lead,
        phone,
      })
    }

    // ─── PASO 3: Lead nuevo — mostrar menú de empresas ───
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('setup_completed', true)
      .order('created_at', { ascending: true })

    if (!businesses || businesses.length === 0) {
      console.log('No businesses with completed setup found.')
      return new NextResponse(null, { status: 200 })
    }

    if (businesses.length === 1) {
      // Solo hay una empresa — asignar directamente sin preguntar
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businesses[0].id)
        .single()

      if (!business) return new NextResponse(null, { status: 200 })

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

      if (error || !newLead) return new NextResponse(null, { status: 200 })

      return await processMessage({
        supabase, from, messageBody, profileName,
        business: business as Business,
        lead: newLead as Lead,
        phone,
      })
    }

    // Múltiples empresas — guardar selección pendiente y enviar menú
    const options = businesses.map((b: { id: string; name: string }, i: number) => ({ index: i + 1, business_id: b.id, name: b.name }))

    await supabase.from('pending_selections').upsert({
      phone,
      profile_name: profileName || null,
      options,
    }, { onConflict: 'phone' })

    const menu = buildBusinessMenu(businesses)
    const menuMessage = `¡Hola${profileName ? ` ${profileName}` : ''}! 👋\n\n¿Con cuál de nuestras empresas deseas hablar?\n\n${menu}\n\nResponde con el número de tu elección.`

    await sendWhatsAppMessage(from, menuMessage)
    return new NextResponse(null, { status: 200 })

  } catch (error) {
    console.error('Webhook error:', error)
    return new NextResponse(null, { status: 500 })
  }
}

// ─── Helper: procesar mensaje con empresa y lead ya asignados ───
async function processMessage({
  supabase, from, messageBody, profileName, business, lead, phone,
}: {
  supabase: ReturnType<typeof createServiceClient>
  from: string
  messageBody: string
  profileName: string
  business: Business
  lead: Lead
  phone: string
}) {
  // Buscar conversación activa
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

  // Human takeover — guardar mensaje sin responder
  if (conversation.status === 'human_takeover') {
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

  // Guardar mensaje entrante
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender: 'lead',
    content: messageBody,
    metadata: { from, profile_name: profileName },
  })

  // Historial de conversación
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(20)

  // Correr orquestador
  const result = await runOrchestratorAgent({
    business,
    lead,
    conversation,
    messages: (messages || []) as Message[],
    incomingMessage: messageBody,
  })

  if (result.finalResponse) {
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender: 'agent',
      agent_type: result.agentType,
      content: result.finalResponse,
      metadata: { tools_executed: result.toolsExecuted.map((t) => t.tool) },
    })

    await supabase.from('conversations').update({
      last_message_at: new Date().toISOString(),
    }).eq('id', conversation.id)

    await sendWhatsAppMessage(from, result.finalResponse)
  }

  return new NextResponse(null, { status: 200 })
}

function buildBusinessMenu(businesses: Array<{ id?: string; name: string }>): string {
  return businesses.map((b: { id?: string; name: string }, i: number) => `*${i + 1}.* ${b.name}`).join('\n')
}

export async function GET() {
  return Response.json({ status: 'End2End webhook active' })
}
