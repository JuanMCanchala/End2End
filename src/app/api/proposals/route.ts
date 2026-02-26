import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single()
    if (!business) return NextResponse.json({ proposals: [] })

    const { searchParams } = new URL(req.url)
    const leadId = searchParams.get('lead_id')

    let query = supabase
      .from('proposals')
      .select('*, lead:leads(name, phone)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })

    if (leadId) query = query.eq('lead_id', leadId)

    const { data: proposals, error } = await query.limit(50)
    if (error) throw error

    return NextResponse.json({ proposals: proposals || [] })
  } catch (error) {
    console.error('GET proposals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
