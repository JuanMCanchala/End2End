import { Message } from '@/types'
import { AGENT_DESCRIPTIONS } from '@/lib/utils/constants'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isLead = message.sender === 'lead'
  const isSystem = message.agent_type === 'system'

  if (isSystem) {
    return (
      <div className="text-center py-1">
        <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  // Tarjeta especial para facturas — detecta por metadata.is_invoice
  const isInvoice = !!message.metadata?.is_invoice
  if (isInvoice) {
    const meta = message.metadata as {
      invoice_number: string
      total_amount: number
      currency: string
      payment_link: string
    }
    return (
      <div className="flex justify-start gap-2">
        <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-xs flex-shrink-0 mt-1">
          🛒
        </div>
        <div className="flex flex-col items-start max-w-[75%]">
          <div className="text-xs text-slate-500 mb-1 ml-1">🛒 Compras</div>
          <div className="bg-gradient-to-br from-purple-900/60 to-slate-800 border border-purple-600/40 rounded-2xl rounded-bl-none px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📄</span>
              <div>
                <div className="text-sm font-semibold text-white">Factura de compra</div>
                <div className="text-xs text-purple-300">{meta.invoice_number}</div>
              </div>
            </div>
            <div className="text-xs text-slate-300 bg-slate-900/60 rounded-lg px-3 py-2 whitespace-pre-wrap">
              {message.content}
            </div>
            <a
              href={meta.payment_link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              💳 Pagar ahora
            </a>
          </div>
          <div className="text-xs text-slate-600 mt-0.5 mx-1">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: es })}
          </div>
        </div>
      </div>
    )
  }

  const agentLabel = message.agent_type ? (AGENT_DESCRIPTIONS[message.agent_type] ?? '🤖 IA') : '🤖 IA'

  return (
    <div className={`flex ${isLead ? 'justify-end' : 'justify-start'} gap-2`}>
      {!isLead && (
        <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-xs flex-shrink-0 mt-1">
          {message.sender === 'human' ? '👤' : '🤖'}
        </div>
      )}
      <div className={`max-w-[75%] ${isLead ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isLead && (
          <div className="text-xs text-slate-500 mb-1 ml-1">
            {message.sender === 'human' ? 'Agente humano' : agentLabel}
          </div>
        )}
        <div
          className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
            isLead
              ? 'bg-purple-600 text-white rounded-br-none'
              : message.sender === 'human'
              ? 'bg-blue-900/50 border border-blue-700 text-blue-100 rounded-bl-none'
              : 'bg-slate-800 text-white rounded-bl-none'
          }`}
        >
          {message.content}
        </div>
        <div className="text-xs text-slate-600 mt-0.5 mx-1">
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: es })}
        </div>
      </div>
      {isLead && (
        <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs flex-shrink-0 mt-1">
          👤
        </div>
      )}
    </div>
  )
}
