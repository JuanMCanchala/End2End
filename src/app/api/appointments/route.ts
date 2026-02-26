import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single()
    if (!business) return NextResponse.json({ appointments: [] })

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*, lead:leads(name, phone)')
      .eq('business_id', business.id)
      .order('scheduled_at', { ascending: true })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ appointments: appointments || [] })
  } catch (error) {
    console.error('GET appointments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
