import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single()
    if (!business) return NextResponse.json({ conversations: [] })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('conversations')
      .select(`
        *,
        lead:leads(*)
      `)
      .eq('business_id', business.id)
      .order('last_message_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data: conversations, error } = await query.limit(50)

    if (error) throw error

    return NextResponse.json({ conversations: conversations || [] })
  } catch (error) {
    console.error('GET conversations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
