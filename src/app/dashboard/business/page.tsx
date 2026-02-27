'use client'

import { useState, useEffect, useRef } from 'react'
import { Business, Product, QualificationQuestion } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function BusinessPage() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const { toast } = useToast()

  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content:
        '¡Hola! Soy tu asistente de configuración. Puedo ayudarte con lenguaje natural.\n\nPor ejemplo:\n• "Agrega un producto Plan Pro por $200.000 COP"\n• "Cambia el tono a amigable"\n• "¿Cuáles son mis horarios actuales?"\n• "Pon el horario de 9am a 6pm de lunes a viernes"',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadBusiness() }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  async function loadBusiness() {
    const res = await fetch('/api/business')
    const data = await res.json()
    setBusiness(data.business)
    setLoading(false)
  }

  async function save(field: string, value: unknown) {
    setSaving(field)
    try {
      const res = await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      const data = await res.json()
      setBusiness(data.business)
      toast({ title: 'Guardado', description: 'Cambios guardados correctamente.' })
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar.', variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || chatLoading || !business) return
    const userMessage = chatInput.trim()
    setChatInput('')
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMessage }]
    setChatMessages(newMessages)
    setChatLoading(true)
    try {
      const res = await fetch('/api/business/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.slice(-10), business }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.message }])
      if (data.business) {
        setBusiness(data.business)
        toast({ title: '¡Actualizado!', description: 'La configuración fue guardada automáticamente.' })
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Lo siento, ocurrió un error. Por favor intenta de nuevo.' },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-500 text-center pt-20">Cargando...</div>
  if (!business) return <div className="p-6 text-slate-500 text-center pt-20">No se encontró la empresa.</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mi Empresa</h1>
        <p className="text-slate-400 text-sm mt-1">
          Configura tu negocio manualmente o usa el asistente IA del panel derecho.
        </p>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Columna izquierda: formularios ── */}
        <div className="flex-1 space-y-6">
          <Section title="Información general" icon="🏢">
            <InfoGeneral key={business.updated_at + '-info'} business={business} saving={saving} onSave={save} />
          </Section>
          <Section title="Productos y servicios" icon="📦">
            <ProductsEditor
              key={business.updated_at + '-products'}
              products={business.products || []}
              saving={saving === 'products'}
              onSave={(products) => save('products', products)}
            />
          </Section>
          <Section title="Preguntas de calificación" icon="🎯">
            <QuestionsEditor
              key={business.updated_at + '-questions'}
              questions={business.qualification_questions || []}
              saving={saving === 'qualification_questions'}
              onSave={(q) => save('qualification_questions', q)}
            />
          </Section>
          <Section title="Horario de atención" icon="🕐">
            <HoursEditor
              key={business.updated_at + '-hours'}
              hours={business.working_hours}
              saving={saving === 'working_hours'}
              onSave={(h) => save('working_hours', h)}
            />
          </Section>
        </div>

        {/* ── Columna derecha: chat IA ── */}
        <div className="w-80 shrink-0 sticky top-6 h-[calc(100vh-8rem)] flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-sm">🤖</div>
            <div>
              <div className="text-sm font-semibold text-white">Asistente IA</div>
              <div className="text-xs text-slate-500">Configura con lenguaje natural</div>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs mr-1.5 flex-shrink-0 mt-0.5">
                    🤖
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs mr-1.5 flex-shrink-0">🤖</div>
                <div className="bg-slate-800 rounded-2xl rounded-bl-none px-3 py-2">
                  <div className="flex gap-1 items-center h-4">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-800">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                placeholder="Escribe un comando..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                disabled={chatLoading}
              />
              <button
                onClick={sendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
              >
                ↑
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1.5 text-center">Enter para enviar</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sección contenedor ───
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
        <span>{icon}</span>
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Info general ───
function InfoGeneral({ business, saving, onSave }: {
  business: Business
  saving: string | null
  onSave: (field: string, value: unknown) => void
}) {
  const [name, setName] = useState(business.name)
  const [description, setDescription] = useState(business.description || '')
  const [tone, setTone] = useState(business.tone)

  useEffect(() => {
    setName(business.name)
    setDescription(business.description || '')
    setTone(business.tone)
  }, [business.name, business.description, business.tone])

  const tones = ['profesional', 'amigable', 'formal', 'informal', 'técnico']

  return (
    <div className="space-y-4">
      <Field label="Nombre de la empresa">
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white" />
          <Button size="sm" onClick={() => onSave('name', name)} disabled={saving === 'name'}
            className="bg-purple-600 hover:bg-purple-700 shrink-0">
            {saving === 'name' ? '...' : 'Guardar'}
          </Button>
        </div>
      </Field>

      <Field label="Descripción">
        <div className="flex flex-col gap-2">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
            rows={3} className="bg-slate-800 border-slate-700 text-white resize-none" />
          <Button size="sm" onClick={() => onSave('description', description)} disabled={saving === 'description'}
            className="bg-purple-600 hover:bg-purple-700 self-end">
            {saving === 'description' ? '...' : 'Guardar'}
          </Button>
        </div>
      </Field>

      <Field label="Tono de comunicación">
        <div className="flex gap-2 flex-wrap">
          {tones.map((t) => (
            <button key={t} onClick={() => { setTone(t); onSave('tone', t) }}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                tone === t ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </Field>
    </div>
  )
}

// ─── Productos ───
function ProductsEditor({ products, saving, onSave }: {
  products: Product[]
  saving: boolean
  onSave: (products: Product[]) => void
}) {
  const [items, setItems] = useState<Product[]>(products)
  const [adding, setAdding] = useState(false)
  const [newProduct, setNewProduct] = useState<Product>({ name: '', description: '', price: undefined, currency: 'COP' })

  useEffect(() => { setItems(products) }, [products])

  function update(index: number, field: keyof Product, value: string | number) {
    const updated = items.map((p, i) => i === index ? { ...p, [field]: value } : p)
    setItems(updated)
  }

  function remove(index: number) {
    const updated = items.filter((_, i) => i !== index)
    setItems(updated)
    onSave(updated)
  }

  function addProduct() {
    if (!newProduct.name.trim()) return
    const updated = [...items, newProduct]
    setItems(updated)
    onSave(updated)
    setNewProduct({ name: '', description: '', price: undefined, currency: 'COP' })
    setAdding(false)
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && !adding && (
        <p className="text-slate-500 text-sm">No hay productos aún.</p>
      )}

      {items.map((p, i) => (
        <div key={i} className="bg-slate-800 rounded-lg p-3 space-y-2">
          <div className="flex gap-2">
            <Input value={p.name} onChange={(e) => update(i, 'name', e.target.value)}
              placeholder="Nombre del producto" className="bg-slate-700 border-slate-600 text-white text-sm" />
            <div className="flex gap-1 shrink-0">
              <button onClick={() => { onSave(items) }}
                className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded">
                ✓
              </button>
              <button onClick={() => remove(i)}
                className="text-xs px-2 py-1 bg-red-900/50 hover:bg-red-800 text-red-400 rounded">
                ✕
              </button>
            </div>
          </div>
          <Textarea value={p.description} onChange={(e) => update(i, 'description', e.target.value)}
            placeholder="Descripción" rows={2}
            className="bg-slate-700 border-slate-600 text-white text-sm resize-none" />
          <div className="flex gap-2">
            <Input type="number" value={p.price || ''} onChange={(e) => update(i, 'price', parseFloat(e.target.value))}
              placeholder="Precio" className="bg-slate-700 border-slate-600 text-white text-sm w-32" />
            <select value={p.currency || 'COP'} onChange={(e) => update(i, 'currency', e.target.value)}
              className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md px-2">
              {['COP', 'USD', 'EUR'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      ))}

      {adding && (
        <div className="bg-slate-800 border border-purple-700/50 rounded-lg p-3 space-y-2">
          <Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
            placeholder="Nombre del producto *" className="bg-slate-700 border-slate-600 text-white text-sm" />
          <Textarea value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
            placeholder="Descripción" rows={2} className="bg-slate-700 border-slate-600 text-white text-sm resize-none" />
          <div className="flex gap-2">
            <Input type="number" value={newProduct.price || ''} onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
              placeholder="Precio" className="bg-slate-700 border-slate-600 text-white text-sm w-32" />
            <select value={newProduct.currency || 'COP'} onChange={(e) => setNewProduct({ ...newProduct, currency: e.target.value })}
              className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md px-2">
              {['COP', 'USD', 'EUR'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addProduct} className="bg-purple-600 hover:bg-purple-700">Agregar</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="text-slate-400">Cancelar</Button>
          </div>
        </div>
      )}

      {!adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}
          className="border-slate-700 text-slate-400 hover:text-white hover:border-slate-500">
          + Agregar producto
        </Button>
      )}
    </div>
  )
}

// ─── Preguntas de calificación ───
function QuestionsEditor({ questions, saving, onSave }: {
  questions: QualificationQuestion[]
  saving: boolean
  onSave: (questions: QualificationQuestion[]) => void
}) {
  const [items, setItems] = useState<QualificationQuestion[]>(questions)
  const [newQ, setNewQ] = useState('')

  useEffect(() => { setItems(questions) }, [questions])

  function remove(index: number) {
    const updated = items.filter((_, i) => i !== index)
    setItems(updated)
    onSave(updated)
  }

  function updateQuestion(index: number, field: keyof QualificationQuestion, value: string | number) {
    const updated = items.map((q, i) => i === index ? { ...q, [field]: value } : q)
    setItems(updated)
  }

  function addQuestion() {
    if (!newQ.trim()) return
    const updated = [...items, {
      id: Date.now().toString(),
      question: newQ.trim(),
      field: newQ.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 20),
      weight: 5,
    }]
    setItems(updated)
    onSave(updated)
    setNewQ('')
  }

  return (
    <div className="space-y-2">
      <p className="text-slate-400 text-xs mb-3">
        Estas preguntas las usa el agente calificador para evaluar el interés del lead (0-10 por importancia).
      </p>

      {items.map((q, i) => (
        <div key={q.id} className="flex gap-2 items-start bg-slate-800 rounded-lg p-3">
          <div className="flex-1 space-y-1">
            <Input value={q.question} onChange={(e) => updateQuestion(i, 'question', e.target.value)}
              className="bg-slate-700 border-slate-600 text-white text-sm" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Peso:</span>
              <input type="range" min={1} max={10} value={q.weight}
                onChange={(e) => updateQuestion(i, 'weight', parseInt(e.target.value))}
                className="w-24 accent-purple-500" />
              <span className="text-xs text-purple-400 w-4">{q.weight}</span>
              <Button size="sm" onClick={() => onSave(items)} className="bg-purple-600 hover:bg-purple-700 text-xs h-6 px-2 ml-2">✓</Button>
            </div>
          </div>
          <button onClick={() => remove(i)} className="text-slate-600 hover:text-red-400 mt-1 text-sm">✕</button>
        </div>
      ))}

      <div className="flex gap-2 mt-2">
        <Input value={newQ} onChange={(e) => setNewQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addQuestion()}
          placeholder="Escribe una nueva pregunta y presiona Enter..."
          className="bg-slate-800 border-slate-700 text-white text-sm" />
        <Button size="sm" onClick={addQuestion} className="bg-purple-600 hover:bg-purple-700 shrink-0">
          + Agregar
        </Button>
      </div>
    </div>
  )
}

// ─── Horarios ───
function HoursEditor({ hours, saving, onSave }: {
  hours: Business['working_hours']
  saving: boolean
  onSave: (hours: Business['working_hours']) => void
}) {
  const [start, setStart] = useState(hours?.start || '08:00')
  const [end, setEnd] = useState(hours?.end || '18:00')
  const [days, setDays] = useState<number[]>(hours?.days || [1, 2, 3, 4, 5])

  useEffect(() => {
    setStart(hours?.start || '08:00')
    setEnd(hours?.end || '18:00')
    setDays(hours?.days || [1, 2, 3, 4, 5])
  }, [hours?.start, hours?.end, hours?.days])

  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  function toggleDay(d: number) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort())
  }

  return (
    <div className="space-y-4">
      <Field label="Días de atención">
        <div className="flex gap-2">
          {dayLabels.map((label, i) => (
            <button key={i} onClick={() => toggleDay(i)}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                days.includes(i) ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-500'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Horario">
        <div className="flex items-center gap-3">
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white w-32" />
          <span className="text-slate-500">—</span>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white w-32" />
          <Button size="sm" onClick={() => onSave({ start, end, days })} disabled={saving}
            className="bg-purple-600 hover:bg-purple-700">
            {saving ? '...' : 'Guardar'}
          </Button>
        </div>
      </Field>
    </div>
  )
}

// ─── Helper label ───
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}
