'use client'

import { useState } from 'react'
import { Lead } from '@/types'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { TEMPERATURE_COLORS, TEMPERATURE_LABELS, STATUS_LABELS } from '@/lib/utils/constants'

interface LeadsTableProps {
  leads: Lead[]
}

const TEMPS = ['all', 'hot', 'warm', 'cold'] as const
const STATUSES = ['all', 'new', 'qualifying', 'qualified', 'proposal_sent', 'meeting_scheduled', 'won', 'lost'] as const

export default function LeadsTable({ leads }: LeadsTableProps) {
  const [tempFilter, setTempFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const filtered = leads.filter((l) => {
    const matchTemp = tempFilter === 'all' || l.temperature === tempFilter
    const matchSearch = !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search)
    return matchTemp && matchSearch
  })

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-500 w-64"
        />
        <div className="flex gap-1">
          {TEMPS.map((t) => (
            <button
              key={t}
              onClick={() => setTempFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tempFilter === t
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {t === 'all' ? 'Todos' : TEMPERATURE_LABELS[t as keyof typeof TEMPERATURE_LABELS]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Lead</th>
              <th className="text-left px-4 py-3">Teléfono</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="text-left px-4 py-3">Temperatura</th>
              <th className="text-left px-4 py-3">Score</th>
              <th className="text-left px-4 py-3">Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-500">
                  No hay leads que coincidan
                </td>
              </tr>
            ) : (
              filtered.map((lead) => (
                <tr key={lead.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{lead.name || 'Desconocido'}</div>
                    <div className="text-slate-500 text-xs">{lead.email || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{lead.phone}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                      {STATUS_LABELS[lead.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TEMPERATURE_COLORS[lead.temperature]}`}>
                      {TEMPERATURE_LABELS[lead.temperature]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-800 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${lead.score >= 70 ? 'bg-red-400' : lead.score >= 40 ? 'bg-orange-400' : 'bg-blue-400'}`}
                          style={{ width: `${lead.score}%` }}
                        />
                      </div>
                      <span className="text-slate-400">{lead.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {lead.last_interaction
                      ? formatDistanceToNow(new Date(lead.last_interaction), { addSuffix: true, locale: es })
                      : 'Sin actividad'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="text-slate-500 text-sm mt-2">{filtered.length} leads</div>
    </div>
  )
}
