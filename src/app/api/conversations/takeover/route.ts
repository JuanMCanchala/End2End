import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { conversation_id, action } = await req.json()
    // action: 'takeover' | 'release'

    const newStatus = action === 'takeover' ? 'human_takeover' : 'active'

    const { data, error } = await supabase
      .from('conversations')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', conversation_id)
      .select()
      .single()

    if (error) throw error

    // Log action in messages
    const systemMsg = action === 'takeover'
      ? '🧑‍💼 Un agente humano ha tomado control de esta conversación.'
      : '🤖 El sistema IA ha retomado el control de esta conversación.'

    await supabase.from('messages').insert({
      conversation_id,
      sender: 'human',
      agent_type: 'system',
      content: systemMsg,
      metadata: { system_event: true, action },
    })

    return NextResponse.json({ conversation: data, status: newStatus })
  } catch (error) {
    console.error('Takeover error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
