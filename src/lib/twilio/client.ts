import twilio from 'twilio'

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

export async function sendWhatsAppMessage(to: string, body: string): Promise<string | null> {
  try {
    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
    const fromFormatted = TWILIO_FROM.startsWith('whatsapp:') ? TWILIO_FROM : `whatsapp:${TWILIO_FROM}`

    console.log(`[Twilio] Sending to: ${toFormatted} | from: ${fromFormatted} | body length: ${body.length}`)

    const message = await twilioClient.messages.create({
      from: fromFormatted,
      to: toFormatted,
      body,
    })

    console.log(`[Twilio] Message sent OK — SID: ${message.sid}`)
    return message.sid
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number; status?: number }
    console.error(`[Twilio] FAILED — code: ${err.code} | status: ${err.status} | message: ${err.message}`)
    return null
  }
}

export function parseTwilioWebhook(body: Record<string, string>) {
  return {
    messageSid: body.MessageSid || '',
    from: body.From || '',
    to: body.To || '',
    body: body.Body || '',
    numMedia: parseInt(body.NumMedia || '0'),
    profileName: body.ProfileName || '',
  }
}
