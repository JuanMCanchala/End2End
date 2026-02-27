import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/twilio/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!business) return NextResponse.json({ followups: [] })

    const { data: followups } = await supabase
      .from('followups')
      .select('*, leads(id, name, phone)')
      .eq('business_id', business.id)
      .order('scheduled_at', { ascending: true })

    return NextResponse.json({ followups: followups || [] })
  } catch (error) {
    console.error('Followups GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, action } = await req.json() as { id: string; action: 'send' | 'cancel' }

    // Verify ownership
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const { data: followup } = await supabase
      .from('followups')
      .select('*, leads(id, name, phone)')
      .eq('id', id)
      .eq('business_id', business.id)
      .single()

    if (!followup) return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 })

    if (action === 'cancel') {
      await supabase
        .from('followups')
        .update({ status: 'cancelled' })
        .eq('id', id)
      return NextResponse.json({ success: true, status: 'cancelled' })
    }

    if (action === 'send') {
      const lead = followup.leads as { id: string; name: string | null; phone: string }
      const to = `whatsapp:${lead.phone}`

      await sendWhatsAppMessage(to, followup.message)

      await supabase
        .from('followups')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', id)

      // Log in messages table
      if (followup.conversation_id) {
        await supabase.from('messages').insert({
          conversation_id: followup.conversation_id,
          sender: 'agent',
          agent_type: 'followup',
          content: followup.message,
          metadata: { sent_by: 'manual_demo', followup_id: id },
        })
      }

      return NextResponse.json({ success: true, status: 'sent' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Followups POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
