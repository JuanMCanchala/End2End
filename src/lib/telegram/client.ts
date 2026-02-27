// Telegram Bot API client

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

export async function sendTelegramMessage(chatId: string | number, text: string): Promise<boolean> {
  try {
    // Intentar con Markdown; si falla, enviar como texto plano
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
    const data = await res.json()

    if (!data.ok) {
      // Reintentar sin formato si hay error de parseo
      if (data.error_code === 400) {
        const res2 = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        })
        const data2 = await res2.json()
        if (!data2.ok) {
          console.error('[Telegram] sendMessage failed:', data2)
          return false
        }
      } else {
        console.error('[Telegram] sendMessage failed:', data)
        return false
      }
    }

    console.log(`[Telegram] Message sent OK → chat_id: ${chatId}`)
    return true
  } catch (error) {
    console.error('[Telegram] FAILED:', error)
    return false
  }
}

/** Wrapper de la misma firma que sendWhatsAppMessage para compatibilidad */
export async function sendMessageToTelegram(to: string, body: string): Promise<string | null> {
  const chatId = to.replace('telegram:', '')
  const ok = await sendTelegramMessage(chatId, body)
  return ok ? chatId : null
}

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      first_name: string
      last_name?: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    text?: string
  }
}

export function parseTelegramUpdate(update: TelegramUpdate) {
  const message = update.message
  if (!message || !message.text) return null

  const chatId = message.chat.id
  const text = message.text
  const firstName = message.from.first_name || ''
  const lastName = message.from.last_name || ''
  const profileName = [firstName, lastName].filter(Boolean).join(' ')

  return {
    chatId,
    from: `telegram:${chatId}`,
    body: text,
    profileName,
  }
}

/** Registra el webhook de Telegram (llamar una vez al configurar) */
export async function setTelegramWebhook(url: string) {
  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return res.json()
}
