'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Lead, AgentType } from '@/types'
import { TEMPERATURE_LABELS, AGENT_DESCRIPTIONS, STATUS_LABELS } from '@/lib/utils/constants'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface DemoMessage {
  role: 'user' | 'agent'
  content: string
  agentType?: AgentType
  toolsExecuted?: string[]
  timestamp: string
  metadata?: Record<string, unknown>
}

const AGENT_COLORS: Record<string, string> = {
  orchestrator: 'text-purple-400',
  qualifier: 'text-blue-400',
  proposal: 'text-green-400',
  scheduler: 'text-yellow-400',
  followup: 'text-orange-400',
}

const TEMP_BAR_COLOR: Record<string, string> = {
  hot: 'bg-red-400',
  warm: 'bg-orange-400',
  cold: 'bg-blue-400',
}

const TEMP_BG: Record<string, string> = {
  hot: 'bg-red-500/20 text-red-300 border border-red-500/30',
  warm: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  cold: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
}

export default function DemoPage() {
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [lead, setLead] = useState<Lead | null>(null)
  const [lastAgentType, setLastAgentType] = useState<AgentType | null>(null)
  const [lastTools, setLastTools] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Cargar mensajes existentes al montar
  useEffect(() => {
    async function loadExisting() {
      try {
        const res = await fetch('/api/demo/chat')
        const data = await res.json()
        if (data.messages && data.messages.length > 0) {
          const mapped: DemoMessage[] = data.messages.map((m: {
            sender: string
            content: string
            agent_type?: AgentType
            metadata?: Record<string, unknown>
            created_at: string
          }) => ({
            role: m.sender === 'lead' ? 'user' : 'agent',
            content: m.content,
            agentType: m.agent_type ?? undefined,
            toolsExecuted: (m.metadata?.tools_executed as string[]) ?? [],
            timestamp: m.created_at,
            metadata: m.metadata,
          }))
          setMessages(mapped)
          // Restaurar último agente y tools del último mensaje del agente
          const lastAgent = [...data.messages].reverse().find((m: { sender: string }) => m.sender === 'agent')
          if (lastAgent) {
            setLastAgentType(lastAgent.agent_type ?? null)
            setLastTools(lastAgent.metadata?.tools_executed ?? [])
          }
        }
        if (data.lead) setLead(data.lead)
      } catch {
        // Silencioso — si falla el load inicial simplemente empieza vacío
      } finally {
        setInitialLoading(false)
      }
    }
    loadExisting()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const text = input.trim()
    setInput('')
    setLoading(true)

    setMessages((prev) => [...prev, {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }])

    try {
      const res = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      const data = await res.json()

      if (data.error) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
        return
      }

      if (data.agentType === 'purchase') {
        // El agente de compras guarda directamente en DB (PDF card + texto)
        // Recargar todos los mensajes para mostrar la tarjeta de factura
        const reloadRes = await fetch('/api/demo/chat')
        const reloadData = await reloadRes.json()
        if (reloadData.messages && reloadData.messages.length > 0) {
          setMessages(reloadData.messages.map((m: {
            sender: string; content: string; agent_type?: string
            metadata?: Record<string, unknown>; created_at: string
          }) => ({
            role: m.sender === 'lead' ? 'user' : 'agent',
            content: m.content,
            agentType: m.agent_type ?? undefined,
            toolsExecuted: [],
            timestamp: m.created_at,
          })))
        }
      } else {
        setMessages((prev) => [...prev, {
          role: 'agent',
          content: data.response,
          agentType: data.agentType,
          toolsExecuted: data.toolsExecuted,
          timestamp: new Date().toISOString(),
        }])
      }

      setLead(data.lead)
      setLastAgentType(data.agentType)
      setLastTools(data.toolsExecuted || [])
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    try {
      await fetch('/api/demo/chat', { method: 'DELETE' })
      setMessages([])
      setLead(null)
      setLastAgentType(null)
      setLastTools([])
      toast({ title: '🔄 Demo reiniciado', description: 'El lead fue reseteado a estado inicial.' })
    } catch {
      toast({ title: 'Error al reiniciar', variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-3 py-1">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Modo Demo</span>
          </div>
          <div>
            <h1 className="text-white font-semibold">Simulador de Chat</h1>
            <p className="text-slate-400 text-xs">Actúa como cliente y observa cómo responden los agentes</p>
          </div>
        </div>
        <Button
          onClick={handleReset}
          variant="outline"
          size="sm"
          className="border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
        >
          🔄 Nueva Demo
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* Chat */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-slate-950">
            {initialLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-slate-500 text-sm">Cargando conversación...</div>
              </div>
            ) : messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="text-5xl mb-4">🤖</div>
                <h3 className="text-white font-semibold text-lg mb-2">Empieza la simulación</h3>
                <p className="text-slate-400 text-sm max-w-sm">
                  Escribe un mensaje como si fueras un cliente potencial.
                  Los agentes IA responderán usando la configuración real de tu negocio.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-2 max-w-xs">
                  {[
                    'Hola, ¿me pueden dar información?',
                    'Quiero saber los precios',
                    'Necesito agendar una reunión',
                    'Estoy interesado en sus servicios',
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-left text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 transition-colors"
                    >
                      "{s}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              // Tarjeta especial para facturas PDF — detecta por metadata.pdf_base64
              const isPdfInvoice = !!msg.metadata?.pdf_base64
              if (isPdfInvoice) {
                const meta = msg.metadata as { invoice_number: string; total_amount: number; currency: string; pdf_base64: string; filename: string }
                return (
                  <div key={i} className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm flex-shrink-0 mt-1">🛒</div>
                    <div className="flex flex-col items-start max-w-[75%]">
                      <span className="text-xs mb-1 ml-1 font-medium text-purple-400">🛒 Compras</span>
                      <div className="bg-gradient-to-br from-purple-900/60 to-slate-800 border border-purple-600/40 rounded-2xl rounded-bl-none px-4 py-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">📄</span>
                          <div>
                            <div className="text-sm font-semibold text-white">Factura generada</div>
                            <div className="text-xs text-purple-300">{meta.invoice_number}</div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-300 bg-slate-900/60 rounded-lg px-3 py-2">{msg.content}</div>
                        <button
                          onClick={() => {
                            const bytes = Uint8Array.from(atob(meta.pdf_base64), (c) => c.charCodeAt(0))
                            const blob = new Blob([bytes], { type: 'application/pdf' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = meta.filename || `${meta.invoice_number}.pdf`
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                        >
                          ⬇️ Descargar PDF
                        </button>
                      </div>
                      <span className="text-xs text-slate-600 mt-1 mx-1">{formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: es })}</span>
                    </div>
                  </div>
                )
              }

              return (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'agent' && (
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm flex-shrink-0 mt-1">
                    🤖
                  </div>
                )}
                <div className={`flex flex-col max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'agent' && msg.agentType && (
                    <span className={`text-xs mb-1 ml-1 font-medium ${AGENT_COLORS[msg.agentType] || 'text-slate-400'}`}>
                      {AGENT_DESCRIPTIONS[msg.agentType] || msg.agentType}
                    </span>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-amber-500/80 text-white rounded-br-none'
                      : 'bg-slate-800 text-white rounded-bl-none'
                  }`}>
                    {msg.content}
                  </div>
                  {msg.role === 'agent' && msg.toolsExecuted && msg.toolsExecuted.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 ml-1">
                      {msg.toolsExecuted.map((tool) => (
                        <span key={tool} className="text-xs bg-slate-800 border border-slate-700 text-slate-500 px-2 py-0.5 rounded-full">
                          ⚙️ {tool}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="text-xs text-slate-600 mt-1 mx-1">
                    {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: es })}
                  </span>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-sm flex-shrink-0 mt-1">
                    👤
                  </div>
                )}
              </div>
              )
            })}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm">🤖</div>
                <div className="bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex-shrink-0">
            <div className="flex gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe como si fueras el cliente..."
                disabled={loading}
                rows={2}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(e as unknown as React.FormEvent)
                  }
                }}
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold self-end"
              >
                Enviar
              </Button>
            </div>
            <p className="text-xs text-slate-600 mt-2">Enter para enviar · Shift+Enter para nueva línea</p>
          </form>
        </div>

        {/* Panel derecho — Ficha del Lead */}
        <div className="w-72 border-l border-slate-800 bg-slate-900 flex flex-col flex-shrink-0 overflow-y-auto">
          <div className="px-4 py-4 border-b border-slate-800">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ficha del Lead</h2>
            <p className="text-xs text-slate-600 mt-0.5">Se actualiza en tiempo real</p>
          </div>

          {!lead ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <div>
                <div className="text-3xl mb-3 opacity-30">📋</div>
                <p className="text-slate-500 text-sm">Envía un mensaje para ver la ficha del lead actualizarse</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-5">

              {/* Score */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 font-medium">SCORE</span>
                  <span className={`text-lg font-bold ${
                    lead.score >= 70 ? 'text-red-400' : lead.score >= 40 ? 'text-orange-400' : 'text-blue-400'
                  }`}>{lead.score}<span className="text-xs text-slate-500 font-normal">/100</span></span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${TEMP_BAR_COLOR[lead.temperature]}`}
                    style={{ width: `${lead.score}%` }}
                  />
                </div>
              </div>

              {/* Temperatura y Estado */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-800 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Temperatura</div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TEMP_BG[lead.temperature]}`}>
                    {TEMPERATURE_LABELS[lead.temperature]}
                  </span>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Estado</div>
                  <div className="text-xs font-medium text-white">{STATUS_LABELS[lead.status]}</div>
                </div>
              </div>

              {/* Nombre */}
              {lead.name && lead.name !== 'Cliente Demo' && (
                <div className="bg-slate-800 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Nombre capturado</div>
                  <div className="text-sm font-medium text-white">{lead.name}</div>
                </div>
              )}

              {/* Datos de calificación */}
              <div>
                <div className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">
                  Datos capturados ({Object.keys(lead.qualification_data).length})
                </div>
                {Object.keys(lead.qualification_data).length === 0 ? (
                  <p className="text-xs text-slate-600">Ninguno aún</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(lead.qualification_data).map(([k, v]) => (
                      <div key={k} className="bg-slate-800 rounded-lg px-3 py-2">
                        <div className="text-xs text-slate-500">{k}</div>
                        <div className="text-xs text-white font-medium mt-0.5 break-words">{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Último agente */}
              {lastAgentType && (
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Último agente</div>
                  <div className={`flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 ${AGENT_COLORS[lastAgentType] || 'text-slate-300'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span className="text-sm font-medium">
                      {AGENT_DESCRIPTIONS[lastAgentType] || lastAgentType}
                    </span>
                  </div>
                </div>
              )}

              {/* Tools ejecutadas */}
              {lastTools.length > 0 && (
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Herramientas usadas</div>
                  <div className="space-y-1">
                    {lastTools.map((tool) => (
                      <div key={tool} className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800 rounded px-2 py-1.5">
                        <span className="text-slate-600">⚙️</span>
                        <span className="font-mono">{tool}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
