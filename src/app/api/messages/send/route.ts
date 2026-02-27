import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/twilio/client'
import { sendMessageToTelegram } from '@/lib/telegram/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { conversation_id, message } = await req.json()

    if (!conversation_id || !message) {
      return NextResponse.json({ error: 'conversation_id and message required' }, { status: 400 })
    }

    // Get conversation + lead for phone number
    const { data: conversation } = await supabase
      .from('conversations')
      .select('*, lead:leads(*)')
      .eq('id', conversation_id)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Save message to DB
    const { data: savedMessage, error } = await supabase.from('messages').insert({
      conversation_id,
      sender: 'human',
      content: message,
      metadata: { sent_by: user.id },
    }).select().single()

    if (error) throw error

    // Update conversation last_message_at
    await supabase.from('conversations').update({
      last_message_at: new Date().toISOString(),
    }).eq('id', conversation_id)

    // Enviar por el canal correcto según el prefijo del teléfono
    const phone = (conversation.lead as { phone: string }).phone
    let channelResult: string | null = null

    if (phone.startsWith('telegram:')) {
      channelResult = await sendMessageToTelegram(phone, message)
    } else {
      channelResult = await sendWhatsAppMessage(phone, message)
    }

    return NextResponse.json({ message: savedMessage, channel_result: channelResult })
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
