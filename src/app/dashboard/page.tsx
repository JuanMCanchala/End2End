'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import MetricsCards from '@/components/dashboard/MetricsCards'
import { DashboardMetrics } from '@/types'

// Lazy load Recharts — reduce ~400KB del bundle inicial
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false })

const TEMP_COLORS = { hot: '#f87171', warm: '#fb923c', cold: '#60a5fa' }

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMetrics()
    // Refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  // Realtime con debounce — evita múltiples refetches seguidos cuando llegan ráfagas de eventos
  useEffect(() => {
    const supabase = createClient()
    let debounceTimer: ReturnType<typeof setTimeout>

    const debouncedLoad = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(loadMetrics, 800)
    }

    const channel = supabase
      .channel('dashboard-metrics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, debouncedLoad)
      .subscribe()

    return () => {
      clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadMetrics() {
    try {
      const res = await fetch('/api/metrics')
      const data = await res.json()
      if (data.metrics) setMetrics(data.metrics)
    } catch (err) {
      console.error('Failed to load metrics:', err)
    } finally {
      setLoading(false)
    }
  }

  const pieData = metrics ? [
    { name: 'Calientes', value: metrics.hot_leads, color: '#f87171' },
    { name: 'Tibios', value: metrics.warm_leads, color: '#fb923c' },
    { name: 'Fríos', value: metrics.cold_leads, color: '#60a5fa' },
  ] : []

  const barData = metrics ? [
    { name: 'Propuestas', value: metrics.proposals_sent },
    { name: 'Citas', value: metrics.appointments_scheduled },
    { name: 'Conv. activas', value: metrics.active_conversations },
    { name: 'Mensajes hoy', value: metrics.messages_today },
  ] : []

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Resumen en tiempo real de tu sistema de ventas IA</p>
      </div>

      <MetricsCards metrics={metrics} />

      {metrics && metrics.total_leads > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Pie chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Distribución de Leads</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData.filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Acciones de los Agentes</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Agent status panel */}
      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-4">Estado de los Agentes</h3>
        <div className="grid grid-cols-5 gap-3">
          {[
            { name: 'Orquestador', icon: '🧠', desc: 'Routeando mensajes' },
            { name: 'Calificador', icon: '🎯', desc: 'Puntuando leads' },
            { name: 'Propuestas', icon: '📄', desc: 'Generando cotizaciones' },
            { name: 'Agenda', icon: '🗓️', desc: 'Agendando citas' },
            { name: 'Seguimiento', icon: '📅', desc: 'Programando follow-ups' },
          ].map((agent) => (
            <div key={agent.name} className="text-center">
              <div className="relative inline-block">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-2xl mx-auto">
                  {agent.icon}
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-slate-900 animate-pulse" />
              </div>
              <div className="text-xs font-medium text-white mt-2">{agent.name}</div>
              <div className="text-xs text-slate-500">{agent.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
