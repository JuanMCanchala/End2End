'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const STEPS = ['name', 'description', 'products', 'tone', 'qualification_questions', 'working_hours', 'complete']

export default function SetupPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState('name')
  const [setupComplete, setSetupComplete] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { toast } = useToast()

  const stepIndex = STEPS.indexOf(currentStep)
  const progress = Math.round((stepIndex / (STEPS.length - 1)) * 100)

  useEffect(() => {
    loadSetupState()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadSetupState() {
    try {
      const res = await fetch('/api/chat/setup')
      const data = await res.json()

      if (data.completed) {
        router.push('/dashboard')
        return
      }

      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages)
        setCurrentStep(data.step || 'name')
      } else {
        // Start with greeting
        const greeting: ChatMessage = {
          role: 'assistant',
          content: '¡Hola! Soy el asistente de configuración de End2End 🤖\n\nVoy a ayudarte a configurar tu sistema de ventas inteligente en solo unos minutos.\n\n¿Cuál es el **nombre de tu negocio**?',
          timestamp: new Date().toISOString(),
        }
        setMessages([greeting])
      }
    } catch (err) {
      console.error('Failed to load setup:', err)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content }),
      })

      const data = await res.json()

      if (data.error) throw new Error(data.error)

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMsg])
      setCurrentStep(data.current_step || currentStep)

      if (data.setup_completed) {
        setSetupComplete(true)
        toast({ title: '¡Configuración completada!', description: 'Tu sistema de ventas IA está listo.' })
        setTimeout(() => router.push('/dashboard'), 2000)
      }
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo enviar el mensaje', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6 text-white">
          <div className="text-2xl font-bold mb-1">End2End</div>
          <div className="text-gray-400 text-sm">Configuración de tu negocio</div>
          <div className="mt-3 bg-white/10 rounded-full h-2 w-full">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1">{progress}% completado</div>
        </div>

        {/* Chat window */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <ScrollArea className="h-[500px] p-4">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-sm mr-2 flex-shrink-0">
                      🤖
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-purple-500 text-white rounded-br-none'
                        : 'bg-white/10 text-white rounded-bl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-sm mr-2">🤖</div>
                  <div className="bg-white/10 rounded-2xl rounded-bl-none px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <form onSubmit={sendMessage} className="p-4 border-t border-white/10 flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu respuesta..."
              disabled={loading || setupComplete}
              className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 flex-1"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim() || setupComplete}
              className="bg-purple-500 hover:bg-purple-600"
            >
              Enviar
            </Button>
          </form>
        </div>

        {setupComplete && (
          <div className="text-center mt-4 text-green-400 font-medium">
            ✅ ¡Listo! Redirigiendo a tu dashboard...
          </div>
        )}
      </div>
    </div>
  )
}
