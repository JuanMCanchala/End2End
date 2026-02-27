import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseTelegramUpdate, sendMessageToTelegram } from '@/lib/telegram/client'
import { runOrchestratorAgent } from '@/lib/agents/orchestrator'
import { ACTIVE_CHANNEL } from '@/lib/channel/config'
import { generateSummary, parseAdminCommand, ADMIN_HELP } from '@/lib/utils/summary'
import { Business, Lead, Conversation, Message } from '@/types'

export const dynamic = 'force-dynamic'

type PendingOption = { index: number; business_id: string; name: string }

export async function POST(req: NextRequest) {
  // Solo procesar si Telegram está activo
  if (ACTIVE_CHANNEL !== 'telegram') {
    return new NextResponse(null, { status: 200 })
  }

  try {
    const update = await req.json()
    console.log('[Telegram] Update recibido:', JSON.stringify(update).slice(0, 300))

    const parsed = parseTelegramUpdate(update)
    if (!parsed) {
      console.log('[Telegram] Update sin texto — ignorado')
      return new NextResponse(null, { status: 200 })
    }

    const { from, body: messageBody, profileName, chatId } = parsed
    console.log(`[Telegram] Mensaje de chatId=${chatId} phone="${from}": "${messageBody}"`)

    const supabase = createServiceClient()
    const phone = from // 'telegram:123456789'

    // ─── COMANDO /salida — cerrar chat y volver al selector de empresa ───
    if (messageBody.trim().toLowerCase() === '/salida') {
      const { data: currentLeads } = await supabase.from('leads').select('id').eq('phone', phone)
      if (currentLeads && currentLeads.length > 0) {
        await supabase.from('conversations').update({ status: 'closed' }).in('lead_id', currentLeads.map((l: { id: string }) => l.id))
      }
      await supabase.from('leads').delete().eq('phone', phone)
      await supabase.from('pending_selections').delete().eq('phone', phone)

      const { data: businesses } = await supabase.from('businesses').select('id, name').eq('setup_completed', true)
      if (!businesses || businesses.length === 0) return new NextResponse(null, { status: 200 })

      if (businesses.length === 1) {
        return await assignBusinessAndStart({ supabase, from, chatId, messageBody: 'hola', profileName, phone, businessId: businesses[0].id, businessName: businesses[0].name, pendingProfileName: profileName })
      }

      await supabase.from('pending_selections').upsert({ phone, profile_name: profileName || null, options: [] }, { onConflict: 'phone' })
      await sendMessageToTelegram(from, `¡Hasta luego! 👋\n\n¿Con qué empresa deseas hablar? Escribe su nombre o parte de él.`)
      return new NextResponse(null, { status: 200 })
    }

    // ─── ADMIN: ¿Es el dueño de alguna empresa? ───────────────────────────────
    const { data: adminBusiness } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('admin_telegram_chat_id', String(chatId))
      .eq('setup_completed', true)
      .single()

    if (adminBusiness) {
      console.log(`[Telegram] Admin detectado para negocio: ${adminBusiness.name}`)
      const command = parseAdminCommand(messageBody)

      if (command === 'ayuda' || command === null) {
        await sendMessageToTelegram(String(chatId), ADMIN_HELP)
        return new NextResponse(null, { status: 200 })
      }

      await sendMessageToTelegram(String(chatId), `_Generando resumen ${command === 'dia' ? 'de hoy' : command === 'semana' ? 'de esta semana' : 'de este mes'}..._`)
      const summary = await generateSummary(adminBusiness.id, command, adminBusiness.name)
      await sendMessageToTelegram(String(chatId), summary)
      return new NextResponse(null, { status: 200 })
    }

    // ─── PASO 1: ¿Está esperando seleccionar empresa? ───
    const { data: pending, error: pendingErr } = await supabase
      .from('pending_selections')
      .select('*')
      .eq('phone', phone)
      .single()

    if (pendingErr && pendingErr.code !== 'PGRST116') {
      console.error('[Telegram] Error leyendo pending_selections:', pendingErr)
    }

    if (pending) {
      const options: PendingOption[] = pending.options || []

      // Estado A: options vacío → el lead está escribiendo el nombre a buscar
      if (options.length === 0) {
        const searchTerm = messageBody.trim().toLowerCase()

        const { data: allBusinesses } = await supabase
          .from('businesses')
          .select('id, name')
          .eq('setup_completed', true)

        const matches = (allBusinesses || []).filter((b: { id: string; name: string }) =>
          b.name.toLowerCase().includes(searchTerm)
        )

        if (matches.length === 0) {
          await sendMessageToTelegram(from,
            `No encontré ninguna empresa con "${messageBody}". Intenta con otro nombre.`
          )
          return new NextResponse(null, { status: 200 })
        }

        if (matches.length === 1) {
          await supabase.from('pending_selections').delete().eq('phone', phone)
          return await assignBusinessAndStart({ supabase, from, chatId, messageBody, profileName, phone, businessId: matches[0].id, businessName: matches[0].name, pendingProfileName: pending.profile_name })
        }

        const newOptions: PendingOption[] = matches.map((b: { id: string; name: string }, i: number) => ({
          index: i + 1,
          business_id: b.id,
          name: b.name,
        }))

        await supabase.from('pending_selections').update({ options: newOptions }).eq('phone', phone)

        const list = newOptions.map((o) => `*${o.index}.* ${o.name}`).join('\n')
        await sendMessageToTelegram(from,
          `Encontré varias empresas:\n\n${list}\n\nResponde con el número de tu elección.`
        )
        return new NextResponse(null, { status: 200 })
      }

      // Estado B: options con datos → el lead está eligiendo un número
      const selection = parseInt(messageBody.trim())
      const chosen = options.find((o) => o.index === selection)

      if (!chosen) {
        const list = options.map((o: PendingOption) => `*${o.index}.* ${o.name}`).join('\n')
        await sendMessageToTelegram(from,
          `Opción inválida. Responde con un número:\n\n${list}`
        )
        return new NextResponse(null, { status: 200 })
      }

      await supabase.from('pending_selections').delete().eq('phone', phone)
      return await assignBusinessAndStart({ supabase, from, chatId, messageBody, profileName, phone, businessId: chosen.business_id, businessName: chosen.name, pendingProfileName: pending.profile_name })
    }

    // ─── PASO 2: ¿Lead conocido con empresa asignada? ───
    const { data: existingLead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    console.log(`[Telegram] PASO 2 — existingLead: ${existingLead?.id ?? 'null'} | error: ${leadErr?.code ?? 'none'}`)

    if (existingLead) {
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', existingLead.business_id)
        .single()

      if (!business) return new NextResponse(null, { status: 200 })

      await supabase.from('leads').update({ last_interaction: new Date().toISOString() }).eq('id', existingLead.id)

      return await processMessage({ supabase, from, messageBody, profileName, business: business as Business, lead: existingLead as Lead, phone })
    }

    // ─── PASO 3: Lead nuevo — iniciar búsqueda ───
    console.log('[Telegram] PASO 3 — buscando empresas disponibles')
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('setup_completed', true)

    if (!businesses || businesses.length === 0) {
      console.log('[Telegram] No businesses with completed setup.')
      return new NextResponse(null, { status: 200 })
    }

    if (businesses.length === 1) {
      return await assignBusinessAndStart({ supabase, from, chatId, messageBody, profileName, phone, businessId: businesses[0].id, businessName: businesses[0].name, pendingProfileName: profileName })
    }

    // Varias empresas — pedir que escriba el nombre
    await supabase.from('pending_selections').upsert({
      phone,
      profile_name: profileName || null,
      options: [],
    }, { onConflict: 'phone' })

    await sendMessageToTelegram(from,
      `¡Hola${profileName ? ` ${profileName}` : ''}! 👋\n\nSomos *End2End*, plataforma multi-empresa.\n\n¿Con qué empresa deseas hablar? Escribe su nombre o parte de él.`
    )
    return new NextResponse(null, { status: 200 })

  } catch (error) {
    console.error('[Telegram] Webhook error:', error)
    return new NextResponse(null, { status: 200 }) // Siempre 200 a Telegram
  }
}

// ─── Asignar empresa, crear lead+conversación y dar bienvenida ───
async function assignBusinessAndStart({
  supabase, from, chatId, messageBody, profileName, phone, businessId, businessName, pendingProfileName,
}: {
  supabase: ReturnType<typeof createServiceClient>
  from: string
  chatId: number
  messageBody: string
  profileName: string
  phone: string
  businessId: string
  businessName: string
  pendingProfileName?: string | null
}) {
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single()

  if (!business) return new NextResponse(null, { status: 200 })

  // Verificar si ya existe un lead con este phone (evita duplicados en reintentos)
  const { data: existingLeadCheck } = await supabase
    .from('leads')
    .select('*')
    .eq('phone', phone)
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existingLeadCheck) {
    console.log(`[Telegram] Lead ya existe (${existingLeadCheck.id}), redirigiendo a processMessage`)
    return await processMessage({ supabase, from, messageBody, profileName, business: business as Business, lead: existingLeadCheck as Lead, phone })
  }

  const { data: newLead, error: leadError } = await supabase
    .from('leads')
    .insert({
      business_id: business.id,
      phone,
      name: pendingProfileName || profileName || null,
      status: 'new',
      temperature: 'cold',
      score: 0,
    })
    .select()
    .single()

  if (leadError || !newLead) {
    console.error('[Telegram] Failed to create lead:', leadError)
    return new NextResponse(null, { status: 200 })
  }
  console.log(`[Telegram] Lead creado: ${newLead.id}`)

  const { data: newConv, error: convError } = await supabase
    .from('conversations')
    .insert({ business_id: business.id, lead_id: newLead.id, status: 'active', channel: 'telegram' })
    .select()
    .single()

  if (convError || !newConv) {
    console.error('[Telegram] Failed to create conversation:', convError)
    return new NextResponse(null, { status: 200 })
  }

  const welcomeMessage = `¡Perfecto! Te conecto con *${businessName}* 🎉\n\n¿En qué te podemos ayudar hoy?`

  await supabase.from('messages').insert([
    { conversation_id: newConv.id, sender: 'lead', content: messageBody, metadata: { from, chat_id: chatId } },
    { conversation_id: newConv.id, sender: 'agent', agent_type: 'orchestrator', content: welcomeMessage, metadata: { system_event: true } },
  ])

  await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', newConv.id)
  await sendMessageToTelegram(from, welcomeMessage)

  return new NextResponse(null, { status: 200 })
}

// ─── Procesar mensaje con lead y empresa ya asignados ───
async function processMessage({
  supabase, from, messageBody, profileName, business, lead,
}: {
  supabase: ReturnType<typeof createServiceClient>
  from: string
  messageBody: string
  profileName: string
  business: Business
  lead: Lead
  phone: string
}) {
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
      .insert({ business_id: business.id, lead_id: lead.id, status: 'active', channel: 'telegram' })
      .select()
      .single()

    if (error || !newConv) return new NextResponse(null, { status: 200 })
    conversation = newConv
  }

  if (conversation.status === 'human_takeover') {
    await supabase.from('messages').insert({
      conversation_id: conversation.id, sender: 'lead', content: messageBody, metadata: { from, profile_name: profileName },
    })
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id)
    return new NextResponse(null, { status: 200 })
  }

  await supabase.from('messages').insert({
    conversation_id: conversation.id, sender: 'lead', content: messageBody, metadata: { from, profile_name: profileName },
  })

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(20)

  console.log(`[Telegram] Ejecutando orquestador para lead ${lead.id}...`)
  const result = await runOrchestratorAgent({
    business, lead, conversation,
    messages: (messages || []) as Message[],
    incomingMessage: messageBody,
  })

  console.log(`[Telegram] Orquestador terminó — agente: ${result.agentType} | respuesta: ${result.finalResponse ? result.finalResponse.slice(0, 80) : 'VACÍA'}`)

  if (result.finalResponse) {
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender: 'agent',
      agent_type: result.agentType,
      content: result.finalResponse,
      metadata: { tools_executed: result.toolsExecuted.map((t) => t.tool) },
    })
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id)
    await sendMessageToTelegram(from, result.finalResponse)
  }

  return new NextResponse(null, { status: 200 })
}

export async function GET() {
  return Response.json({ status: 'End2End Telegram webhook active', channel: ACTIVE_CHANNEL })
}
