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

      // Preparar finalMessage ANTES de cualquier envío externo
      // Para WhatsApp/demo: incluir número de factura y total en el mensaje
      // Para Telegram: el PDF llega por separado, el closing_message es suficiente
      finalMessage = isTelegram
        ? closing_message
        : `📄 *Factura ${invoiceNumber}*\n${closing_message}\n\n💰 Total: $${total_amount.toLocaleString('es-CO')} ${currency}`

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

      // Enviar PDF por Telegram (único canal que soporta documentos directamente)
      // El texto de cierre lo envía el webhook vía result.finalResponse
      // Para WhatsApp el webhook envía result.finalResponse como texto (no hay PDF nativo)
      // Para demo no se envía nada externo
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
        agent_type: 'proposal',
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
    agentType: 'proposal',
    toolsExecuted: [],
  }
}
