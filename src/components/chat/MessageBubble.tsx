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

  const agentLabel = message.agent_type ? AGENT_DESCRIPTIONS[message.agent_type] : '🤖 IA'

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
