import { runAgentLoop, ToolHandler, AgentLoopResult } from './agent-loop'
import { PURCHASE_TOOLS } from './tools'
import { buildPurchasePrompt } from '@/lib/utils/prompts'
import { Business, Lead, Conversation, Message } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'
import { InvoiceItem } from '@/lib/pdf/invoice'
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

      const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`
      const paymentLink = `https://pagos.end2end.co/demo/${invoiceNumber}`

      // Construir líneas del detalle de la compra
      const itemLines = items.map(
        (it) => `• ${it.product_name} x${it.quantity} — $${(it.unit_price * it.quantity).toLocaleString('es-CO')} ${currency}`
      ).join('\n')

      finalMessage = `📄 Factura ${invoiceNumber}\n\n${itemLines}\n\n💰 Total: $${total_amount.toLocaleString('es-CO')} ${currency}\n\n${closing_message}\n\n🔗 Paga aquí: ${paymentLink}`

      // Guardar mensaje en DB con metadata de factura
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender: 'agent',
        agent_type: 'proposal', // 'proposal' para evitar problemas de CHECK constraint sin migración
        content: finalMessage,
        metadata: {
          is_invoice: true,
          invoice_number: invoiceNumber,
          total_amount,
          currency,
          items,
          payment_link: paymentLink,
        },
      })

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

      await logAgentAction(supabase, {
        business_id: business.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        agent_type: 'purchase',
        action_type: 'send_invoice',
        description: `Factura ${invoiceNumber} generada. Total: ${total_amount} ${currency}`,
        input_data: toolInput as Record<string, unknown>,
        output_data: { invoice_number: invoiceNumber, payment_link: paymentLink },
      })

      return { success: true, invoice_number: invoiceNumber, payment_link: paymentLink }
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
