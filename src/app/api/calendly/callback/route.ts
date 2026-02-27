import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/calendly/client'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const dashboardUrl = new URL('/dashboard/appointments', req.url)

  if (error || !code) {
    dashboardUrl.searchParams.set('calendly_error', error || 'no_code')
    return NextResponse.redirect(dashboardUrl)
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/login', req.url))

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${new URL(req.url).host}`
    const redirectUri = `${appUrl}/api/calendly/callback`

    // Exchange code for tokens
    const tokenRes = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.CALENDLY_CLIENT_ID!,
        client_secret: process.env.CALENDLY_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        code,
      }),
    })

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`)
    }

    const tokens = await tokenRes.json()
    const { access_token, refresh_token, expires_in } = tokens

    // Get Calendly user info to store URIs
    const userInfo = await getCurrentUser(access_token)
    const calendlyUser = userInfo.resource
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    // Store in businesses table
    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        calendly_access_token: access_token,
        calendly_refresh_token: refresh_token,
        calendly_user_uri: calendlyUser.uri,
        calendly_org_uri: calendlyUser.current_organization,
        calendly_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (updateError) throw updateError

    dashboardUrl.searchParams.set('calendly_connected', '1')
    return NextResponse.redirect(dashboardUrl)
  } catch (err) {
    console.error('Calendly callback error:', err)
    dashboardUrl.searchParams.set('calendly_error', 'connection_failed')
    return NextResponse.redirect(dashboardUrl)
  }
}
