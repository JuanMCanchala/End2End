import twilio from 'twilio'

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

export async function sendWhatsAppMessage(to: string, body: string): Promise<string | null> {
  try {
    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`

    const message = await twilioClient.messages.create({
      from: TWILIO_FROM,
      to: toFormatted,
      body,
    })

    return message.sid
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
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
