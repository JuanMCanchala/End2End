import Link from 'next/link'
import { Button } from '@/components/ui/button'

const features = [
  { icon: '🧠', title: 'Orquestador IA', desc: 'Analiza cada mensaje y decide el mejor agente especialista' },
  { icon: '🎯', title: 'Calificador', desc: 'Puntúa leads automáticamente con preguntas inteligentes' },
  { icon: '📄', title: 'Propuestas', desc: 'Genera cotizaciones personalizadas en segundos' },
  { icon: '🗓️', title: 'Agenda', desc: 'Programa reuniones y citas sin intervención humana' },
  { icon: '📅', title: 'Seguimiento', desc: 'Nunca pierdas un lead con seguimientos automáticos' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">VentasIA</span>
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
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="text-white border-white/30 hover:bg-white/10 text-lg px-8 py-6">
              Ver dashboard
            </Button>
          </Link>
        </div>
      </section>

      {/* Metrics */}
      <section className="py-12 border-y border-white/10">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center px-6">
          <div>
            <div className="text-4xl font-bold text-purple-400">{"<3s"}</div>
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

      {/* Agents */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Tu equipo de ventas IA</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-6 text-center hover:bg-white/10 transition">
              <div className="text-4xl mb-3">{f.icon}</div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center px-6">
        <h2 className="text-3xl font-bold mb-4">Listo en 5 minutos</h2>
        <p className="text-gray-300 mb-8">Configura tu negocio con nuestro asistente conversacional</p>
        <Link href="/signup">
          <Button size="lg" className="bg-purple-500 hover:bg-purple-600 text-lg px-10 py-6">
            Empezar ahora — Es gratis
          </Button>
        </Link>
      </section>

      <footer className="text-center py-8 text-gray-500 text-sm border-t border-white/10">
        VentasIA © 2024 — Construido para el Hackathon IA USB Cali
      </footer>
    </div>
  )
}
