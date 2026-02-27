import { runAgentLoop, ToolHandler, AgentLoopResult } from './agent-loop'
import { PURCHASE_TOOLS } from './tools'
import { buildPurchasePrompt } from '@/lib/utils/prompts'
import { Business, Lead, Conversation, Message } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'
import { generateInvoicePDF, InvoiceItem } from '@/lib/pdf/invoice'
import { sendTelegramDocument } from '@/lib/telegram/client'
import { logAgentAction } from './agent-actions'

interface PurchaseInput {
  business: Business
  lead: Lead
  conversation: Conversation
  messages: Message[]
  incomingMessage: string
}

export async function runPurchaseAgent(input: PurchaseInput): Promise<AgentLoopResult> {
  const { business, lead, conversation, messages, incomingMessage } = input
  const supabase = createServiceClient()

  console.log(`[Purchase] Iniciado — lead: ${lead.phone}, conv: ${conversation.id}, msg: "${incomingMessage.slice(0, 60)}"`)

  let finalMessage = ''

  const toolHandlers: ToolHandler = {
    confirm_order: async (toolInput) => {
      const { confirmation_message } = toolInput as {
        items: InvoiceItem[]
        total_amount: number
        currency: string
        confirmation_message: string
      }
      finalMessage = confirmation_message

      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'proposal',
        action_type: 'confirm_order',
        description: 'Pedido presentado al cliente para confirmación',
        input_data: toolInput as Record<string, unknown>,
        output_data: { message: confirmation_message },
      })

      return { success: true, awaiting_confirmation: true }
    },

    send_invoice_and_close: async (toolInput) => {
      const { items, total_amount, currency = 'COP', closing_message } = toolInput as {
        items: InvoiceItem[]
        total_amount: number
        currency: string
        closing_message: string
      }

      // Generar número de factura
      const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`
      const dateStr = new Date().toLocaleDateString('es-CO', {
        day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'America/Bogota',
      })

      // Generar PDF
      const pdfBuffer = await generateInvoicePDF({
        invoiceNumber,
        date: dateStr,
        businessName: business.name,
        businessDescription: business.description,
        clientName: lead.name || 'Cliente',
        clientPhone: lead.phone,
        items,
        totalAmount: total_amount,
        currency,
      })

      const isDemo = lead.phone === '__demo__'
      const isTelegram = lead.phone.startsWith('telegram:')

      // Guardar el PDF como base64 en la tabla messages para que el dashboard pueda descargarlo.
      // Nota: el CHECK constraint de messages.agent_type requiere correr la migración 006 en Supabase
      // para aceptar 'purchase'. Mientras tanto, el campo is_invoice:true en metadata sirve como señal.
      const { error: insertError } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender: 'agent',
        agent_type: 'purchase',
        content: `📄 Factura ${invoiceNumber} — $${total_amount.toLocaleString('es-CO')} ${currency}`,
        metadata: {
          is_invoice: true,
          invoice_number: invoiceNumber,
          total_amount,
          currency,
          items,
          pdf_base64: pdfBuffer.toString('base64'),
          filename: `factura-${invoiceNumber}.pdf`,
        },
      })

      if (insertError) {
        // Si falla (e.g. migración 006 no corrida aún), intentar con agent_type 'proposal'
        console.error('[Purchase] Error insertando mensaje con agent_type purchase, reintentando con proposal:', insertError.message)
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          sender: 'agent',
          agent_type: 'proposal',
          content: `📄 Factura ${invoiceNumber} — $${total_amount.toLocaleString('es-CO')} ${currency}`,
          metadata: {
            is_invoice: true,
            invoice_number: invoiceNumber,
            total_amount,
            currency,
            items,
            pdf_base64: pdfBuffer.toString('base64'),
            filename: `factura-${invoiceNumber}.pdf`,
          },
        })
      }

      console.log(`[Purchase] Factura ${invoiceNumber} guardada en DB. PDF size: ${pdfBuffer.length} bytes`)

      // El mensaje de texto que verán los leads (en WhatsApp/Telegram) y el demo
      // Para Telegram: el webhook enviará closing_message como texto; el PDF llega por separado
      // Para WhatsApp y demo: el webhook envía el mensaje formateado con número de factura
      finalMessage = isTelegram
        ? closing_message
        : `📄 Factura ${invoiceNumber}\n\n${closing_message}\n\n💰 Total: $${total_amount.toLocaleString('es-CO')} ${currency}`

      // Actualizar lead → sale_pending
      await supabase.from('leads').update({
        status: 'sale_pending',
        temperature: 'hot',
        score: 100,
        last_interaction: new Date().toISOString(),
      }).eq('id', lead.id)

      // Cerrar conversación → sale_pending
      await supabase.from('conversations').update({
        status: 'sale_pending',
        last_message_at: new Date().toISOString(),
      }).eq('id', conversation.id)

      // Enviar PDF por Telegram (único canal con soporte nativo de documentos)
      // El texto de cierre lo envía el webhook vía result.finalResponse
      let pdfSent = false
      if (!isDemo && isTelegram) {
        try {
          const chatId = lead.phone.replace('telegram:', '')
          pdfSent = await sendTelegramDocument(
            chatId,
            pdfBuffer,
            `factura-${invoiceNumber}.pdf`,
            `📄 Factura ${invoiceNumber} — ${business.name}`
          )
        } catch (err) {
          console.error('Failed to send Telegram document:', err)
        }
      }

      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'purchase',
        action_type: 'send_invoice',
        description: `Factura ${invoiceNumber} generada. Total: ${total_amount} ${currency}`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { invoice_number: invoiceNumber, pdf_sent: pdfSent, is_demo: isDemo },
      })

      return { success: true, invoice_number: invoiceNumber, pdf_sent: pdfSent }
    },
  }

  const systemPrompt = buildPurchasePrompt(business, lead, messages)

  await runAgentLoop(
    systemPrompt,
    incomingMessage,
    PURCHASE_TOOLS,
    toolHandlers,
    'proposal',
    [], // conversationHistory
    ['confirm_order', 'send_invoice_and_close'] // terminalTools
  )

  return {
    finalResponse: finalMessage,
    agentType: 'purchase',
    toolsExecuted: [],
  }
}
