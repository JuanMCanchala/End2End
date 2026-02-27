'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { Conversation, Message, Lead } from '@/types'
import MessageBubble from '@/components/chat/MessageBubble'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { TEMPERATURE_LABELS, TEMPERATURE_COLORS, STATUS_LABELS } from '@/lib/utils/constants'
import { ScrollArea } from '@/components/ui/scroll-area'
import Link from 'next/link'

export default function ConversationDetailPage() {
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [humanMessage, setHumanMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [takingOver, setTakingOver] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversation()
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription (best-effort — fallback polling handles delivery gaps)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`conversation-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, (payload) => {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === (payload.new as Message).id)
          return exists ? prev : [...prev, payload.new as Message]
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `id=eq.${id}`,
      }, (payload) => {
        setConversation((prev) => prev ? { ...prev, ...payload.new } : null)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  // Polling fallback: ensures messages appear even when Realtime events are not delivered
  // Pausa automáticamente cuando el tab no está visible para no desperdiciar requests
  useEffect(() => {
    const poll = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const res = await fetch(`/api/conversations/${id}`)
        const data = await res.json()
        if (!data.error && Array.isArray(data.messages)) setMessages(data.messages)
        if (!data.error && data.conversation) {
          setConversation((prev) => prev ? { ...prev, ...data.conversation } : data.conversation)
        }
      } catch { /* silently ignore */ }
    }

    const interval = setInterval(poll, 10000) // 10s en vez de 4s
    return () => clearInterval(interval)
  }, [id])

  async function loadConversation() {
    try {
      const res = await fetch(`/api/conversations/${id}`)
      const data = await res.json()
      if (data.error) { router.push('/dashboard/conversations'); return }
      setConversation(data.conversation)
      setMessages(data.messages || [])
    } catch (err) {
      console.error('Failed to load conversation:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleTakeover() {
    if (!conversation) return
    setTakingOver(true)
    const action = conversation.status === 'human_takeover' ? 'release' : 'takeover'

    try {
      const res = await fetch('/api/conversations/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: id, action }),
      })
      const data = await res.json()
      setConversation((prev) => prev ? { ...prev, status: data.status } : null)
      toast({
        title: action === 'takeover' ? '🧑 Control tomado' : '🤖 IA retomó el control',
        description: action === 'takeover' ? 'Ahora puedes responder manualmente.' : 'Los agentes IA continuarán respondiendo.',
      })
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive', description: 'No se pudo cambiar el control' })
    } finally {
      setTakingOver(false)
    }
  }

  async function sendHumanMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!humanMessage.trim() || sending) return
    setSending(true)
    const messageText = humanMessage.trim()
    setHumanMessage('')

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: id, message: messageText }),
      })
      const data = await res.json()
      if (data.message) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === data.message.id)
          return exists ? prev : [...prev, data.message]
        })
      }
      toast({ title: 'Mensaje enviado', description: 'El mensaje fue enviado por WhatsApp.' })
    } catch (err) {
      setHumanMessage(messageText)
      toast({ title: 'Error', variant: 'destructive', description: 'No se pudo enviar el mensaje' })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-slate-500 text-center py-16">Cargando conversación...</div>
  }

  if (!conversation) {
    return <div className="p-6 text-center py-16 text-slate-500">Conversación no encontrada</div>
  }

  const lead = conversation.lead as Lead

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-800 bg-slate-900">
        <Link href="/dashboard/conversations" className="text-slate-400 hover:text-white">←</Link>
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg">
          {conversation.status === 'human_takeover' ? '🧑' : '🤖'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{lead?.name || lead?.phone}</span>
            <StatusBadge status={conversation.status} />
            {lead?.temperature && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${TEMPERATURE_COLORS[lead.temperature]}`}>
                {TEMPERATURE_LABELS[lead.temperature]}
              </span>
            )}
          </div>
          <div className="text-sm text-slate-400">
            {lead?.phone} · Score: {lead?.score}/100 · {STATUS_LABELS[lead?.status]}
          </div>
        </div>
        <Button
          onClick={handleTakeover}
          disabled={takingOver}
          variant={conversation.status === 'human_takeover' ? 'default' : 'outline'}
          className={conversation.status === 'human_takeover'
            ? 'bg-purple-600 hover:bg-purple-700'
            : 'border-blue-600 text-blue-400 hover:bg-blue-900/30'
          }
        >
          {takingOver ? '...' : conversation.status === 'human_takeover' ? '🤖 Liberar a IA' : '🧑 Tomar control'}
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6 py-4 bg-slate-950">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-16 text-slate-500">Sin mensajes aún</div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Human reply (only when in takeover) */}
      {conversation.status === 'human_takeover' && (
        <form onSubmit={sendHumanMessage} className="px-6 py-4 border-t border-slate-800 bg-slate-900">
          <div className="max-w-3xl mx-auto flex gap-3">
            <Textarea
              value={humanMessage}
              onChange={(e) => setHumanMessage(e.target.value)}
              placeholder="Escribe tu respuesta (se enviará por WhatsApp)..."
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendHumanMessage(e as unknown as React.FormEvent)
                }
              }}
            />
            <Button
              type="submit"
              disabled={sending || !humanMessage.trim()}
              className="bg-blue-600 hover:bg-blue-700 self-end"
            >
              {sending ? '...' : 'Enviar'}
            </Button>
          </div>
          <div className="text-xs text-slate-500 mt-2 max-w-3xl mx-auto">
            🧑 Modo humano activo — tus mensajes llegan directamente al lead por WhatsApp
          </div>
        </form>
      )}

      {conversation.status !== 'human_takeover' && (
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 text-center text-sm text-slate-500">
          🤖 Los agentes IA están respondiendo automáticamente · {' '}
          <button onClick={handleTakeover} className="text-blue-400 hover:underline">Tomar control</button>
        </div>
      )}
    </div>
  )
}
