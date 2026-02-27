import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${new URL(req.url).host}`
  const redirectUri = `${appUrl}/api/calendly/callback`

  const params = new URLSearchParams({
    client_id: process.env.CALENDLY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri,
  })

  return NextResponse.redirect(`https://auth.calendly.com/oauth/authorize?${params}`)
}
