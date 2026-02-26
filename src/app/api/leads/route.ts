import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single()
    if (!business) return NextResponse.json({ leads: [] })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const temperature = searchParams.get('temperature')

    let query = supabase
      .from('leads')
      .select('*')
      .eq('business_id', business.id)
      .order('last_interaction', { ascending: false })

    if (status) query = query.eq('status', status)
    if (temperature) query = query.eq('temperature', temperature)

    const { data: leads, error } = await query

    if (error) throw error

    return NextResponse.json({ leads: leads || [] })
  } catch (error) {
    console.error('GET leads error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
