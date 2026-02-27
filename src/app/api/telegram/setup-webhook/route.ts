import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/telegram/setup-webhook
// Registra la URL del webhook de Telegram automáticamente.
// Llama a este endpoint una vez desde el navegador después de desplegar.
export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN no configurado' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`
  const webhookUrl = `${appUrl}/api/webhook/telegram`

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  })

  const data = await res.json()
  return NextResponse.json({ webhookUrl, telegram_response: data })
}
