'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import LeadsTable from '@/components/dashboard/LeadsTable'
import { Lead } from '@/types'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeads()
  }, [])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => loadLeads())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadLeads() {
    try {
      const res = await fetch('/api/leads')
      const data = await res.json()
      setLeads(data.leads || [])
    } catch (err) {
      console.error('Failed to load leads:', err)
    } finally {
      setLoading(false)
    }
  }

  // Pipeline counts
  const counts = leads.reduce((acc, l) => {
    acc[l.temperature] = (acc[l.temperature] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Leads</h1>
        <p className="text-slate-400 text-sm mt-1">Todos los prospectos gestionados por tus agentes IA</p>
      </div>

      {/* Pipeline visual */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '🔥 Calientes', key: 'hot', color: 'border-red-500/50 bg-red-900/10' },
          { label: '🌡️ Tibios', key: 'warm', color: 'border-orange-500/50 bg-orange-900/10' },
          { label: '❄️ Fríos', key: 'cold', color: 'border-blue-500/50 bg-blue-900/10' },
        ].map((stage) => (
          <div key={stage.key} className={`border rounded-xl p-4 ${stage.color}`}>
            <div className="text-sm font-medium text-slate-300">{stage.label}</div>
            <div className="text-3xl font-bold text-white mt-1">{counts[stage.key] || 0}</div>
            <div className="text-xs text-slate-500 mt-0.5">leads</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500">Cargando leads...</div>
      ) : (
        <LeadsTable leads={leads} />
      )}
    </div>
  )
}
