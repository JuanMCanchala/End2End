import Link from 'next/link'
import { Button } from '@/components/ui/button'

const agents = [
  { icon: '🧠', title: 'Orquestador IA', desc: 'Analiza cada mensaje y decide el mejor agente especialista' },
  { icon: '🎯', title: 'Calificador', desc: 'Puntúa leads automáticamente con preguntas inteligentes' },
  { icon: '📄', title: 'Propuestas', desc: 'Genera cotizaciones personalizadas en segundos' },
  { icon: '🗓️', title: 'Agenda', desc: 'Programa reuniones y citas sin intervención humana' },
  { icon: '📅', title: 'Seguimiento', desc: 'Nunca pierdas un lead con seguimientos automáticos' },
]

const steps = [
  {
    number: '01',
    title: 'Escribe desde tu celular',
    desc: 'Tus clientes te contactan por WhatsApp como siempre. Sin apps nuevas, sin links raros.',
    icon: '📱',
  },
  {
    number: '02',
    title: 'La IA habla por ti',
    desc: 'Los 5 agentes responden, califican y negocian con cada lead de forma natural.',
    icon: '🤖',
  },
  {
    number: '03',
    title: 'Recibes leads calificados',
    desc: 'Solo ves los prospectos listos para cerrar. El resto lo maneja la IA.',
    icon: '🎯',
  },
]

const audiences = [
  { icon: '🏢', title: 'Agencias de marketing', desc: 'Automatiza la prospección y entrega leads calientes a tus clientes' },
  { icon: '💼', title: 'Consultores y freelancers', desc: 'Escala tu negocio sin contratar personal de ventas' },
  { icon: '🏪', title: 'PYMES y comercios', desc: 'Atiende cientos de clientes simultáneamente sin perder ninguno' },
  { icon: '🚀', title: 'Startups en crecimiento', desc: 'Valida tu producto y genera ventas desde el primer día' },
]

const testimonials = [
  {
    quote: 'Antes perdía leads en la madrugada. Ahora la IA los atiende y yo los recibo calificados en la mañana.',
    name: 'Carlos M.',
    role: 'Agencia de publicidad, Cali',
    avatar: 'CM',
  },
  {
    quote: 'Configuré mi negocio en 5 minutos. En la primera semana cerré 3 ventas que antes se me habrían escapado.',
    name: 'Diana R.',
    role: 'Consultora independiente, Bogotá',
    avatar: 'DR',
  },
  {
    quote: 'Mis clientes preguntan precios a las 11pm y reciben una cotización personalizada al instante. Increíble.',
    name: 'Andrés P.',
    role: 'E-commerce, Medellín',
    avatar: 'AP',
  },
]

const problems = [
  '¿Pierdes leads mientras duermes?',
  '¿Tardas horas en armar una cotización?',
  '¿Se te olvida hacer seguimiento y pierdes ventas?',
  '¿No puedes atender a todos tus clientes a la vez?',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">End2End</span>
          <span className="text-xs bg-purple-500 px-2 py-0.5 rounded-full">BETA</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login">
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">Iniciar sesión</Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-purple-500 hover:bg-purple-600">Comenzar gratis</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 py-24 max-w-4xl mx-auto">
        <div className="inline-block bg-purple-500/20 border border-purple-500/30 rounded-full px-4 py-1 text-sm mb-6">
          🏆 Hackathon IA — Universidad de San Buenaventura
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          5 Agentes IA que<br />
          <span className="text-purple-400">venden por ti</span>
        </h1>
        <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
          Sistema multi-agente autónomo que responde leads por WhatsApp, los califica,
          genera propuestas y agenda reuniones — todo sin intervención humana.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg" className="bg-purple-500 hover:bg-purple-600 text-lg px-8 py-6">
              Configurar mi negocio →
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="bg-transparent text-white border-white/30 hover:bg-white/10 text-lg px-8 py-6">
              Ver dashboard
            </Button>
          </Link>
        </div>
      </section>

      {/* Métricas */}
      <section className="py-12 border-y border-white/10">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center px-6">
          <div>
            <div className="text-4xl font-bold text-purple-400">{'<3s'}</div>
            <div className="text-gray-400 mt-1">Tiempo de respuesta</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-purple-400">24/7</div>
            <div className="text-gray-400 mt-1">Disponibilidad</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-purple-400">5</div>
            <div className="text-gray-400 mt-1">Agentes especializados</div>
          </div>
        </div>
      </section>

      {/* Problema */}
      <section className="py-20 px-6 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">¿Te suena familiar?</h2>
        <p className="text-gray-400 mb-10">Estos son los problemas que End2End resuelve desde el primer día</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {problems.map((problem) => (
            <div key={problem} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-5 text-left">
              <span className="text-red-400 text-xl flex-shrink-0">✗</span>
              <p className="text-gray-300">{problem}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 rounded-xl px-6 py-4 text-purple-300">
          <span className="text-xl">✓</span>
          <span className="font-medium">End2End lo resuelve todo, automáticamente, por WhatsApp.</span>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Cómo funciona</h2>
        <p className="text-gray-400 text-center mb-14">Tres pasos para tener tu equipo de ventas IA activo</p>
        <div className="relative">
          {/* Línea conectora (desktop) */}
          <div className="hidden md:block absolute top-12 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-gradient-to-r from-purple-500/20 via-purple-500/60 to-purple-500/20" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl">
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold">
                    {step.number.replace('0', '')}
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo visual del dashboard */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Tu centro de control</h2>
        <p className="text-gray-400 text-center mb-12">Monitorea cada conversación, lead y agente en tiempo real</p>
        <div className="bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Barra superior del "browser" */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-slate-900">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
            <div className="flex-1 mx-4 bg-white/5 rounded-md px-3 py-1 text-xs text-gray-500 text-center">
              end2end.app/dashboard
            </div>
          </div>
          {/* Contenido del mock dashboard */}
          <div className="flex">
            {/* Sidebar mock */}
            <div className="hidden sm:flex w-48 border-r border-white/10 flex-col gap-1 p-3 bg-slate-900/50">
              <div className="text-xs text-gray-500 px-2 py-1 font-medium">MENÚ</div>
              {['Dashboard', 'Conversaciones', 'Leads', 'Actividad'].map((item, i) => (
                <div key={item} className={`px-3 py-2 rounded-lg text-sm ${i === 0 ? 'bg-purple-500/20 text-purple-300' : 'text-gray-500'}`}>
                  {item}
                </div>
              ))}
            </div>
            {/* Contenido mock */}
            <div className="flex-1 p-5 space-y-4">
              {/* Métricas mock */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Leads totales', value: '24' },
                  { label: 'Calientes 🔥', value: '7' },
                  { label: 'Propuestas', value: '5' },
                  { label: 'Conversiones', value: '32%' },
                ].map((m) => (
                  <div key={m.label} className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="text-xl font-bold text-purple-400">{m.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>
              {/* Conversaciones mock */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                <div className="text-xs text-gray-500 font-medium mb-3">CONVERSACIONES RECIENTES</div>
                {[
                  { name: 'María G.', status: '🔥 Caliente', agent: 'Propuestas', time: 'hace 2m' },
                  { name: 'Juan P.', status: '🌡 Tibio', agent: 'Calificador', time: 'hace 8m' },
                  { name: 'Sara L.', status: '🔥 Caliente', agent: 'Agenda', time: 'hace 15m' },
                ].map((conv) => (
                  <div key={conv.name} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300">
                        {conv.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{conv.name}</div>
                        <div className="text-xs text-gray-500">{conv.agent}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs">{conv.status}</div>
                      <div className="text-xs text-gray-500">{conv.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Para quién es */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">¿Para quién es End2End?</h2>
        <p className="text-gray-400 text-center mb-12">Diseñado para negocios que no quieren perder ni un solo lead</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {audiences.map((a) => (
            <div key={a.title} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 hover:border-purple-500/30 transition-all">
              <div className="text-3xl mb-3">{a.icon}</div>
              <h3 className="font-semibold mb-2">{a.title}</h3>
              <p className="text-sm text-gray-400">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agentes */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Tu equipo de ventas IA</h2>
        <p className="text-gray-400 text-center mb-12">5 agentes especializados que trabajan juntos sin descanso</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {agents.map((f) => (
            <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-6 text-center hover:bg-white/10 transition">
              <div className="text-4xl mb-3">{f.icon}</div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Prueba social */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 rounded-full px-4 py-1.5 text-sm text-purple-300 mb-4">
            ⭐ Prueba social
          </div>
          <h2 className="text-3xl font-bold">Lo que dicen nuestros usuarios</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col gap-4">
              <p className="text-gray-300 text-sm leading-relaxed">"{t.quote}"</p>
              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-white/10">
                <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300">
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24 text-center px-6">
        <h2 className="text-4xl font-bold mb-4">Empieza a vender mientras duermes</h2>
        <p className="text-gray-300 mb-10 text-lg max-w-xl mx-auto">
          Configura tu sistema en 5 minutos. Sin tarjeta de crédito. Sin código.
        </p>
        <Link href="/signup">
          <Button size="lg" className="bg-purple-500 hover:bg-purple-600 text-lg px-12 py-6">
            Crear cuenta gratis →
          </Button>
        </Link>
        <p className="text-gray-500 text-sm mt-4">Listo en 5 minutos · 100% gratuito durante el hackathon</p>
      </section>

      <footer className="text-center py-8 text-gray-500 text-sm border-t border-white/10">
        End2End © 2026 — Construido para el Hackathon IA USB Cali
      </footer>
    </div>
  )
}
