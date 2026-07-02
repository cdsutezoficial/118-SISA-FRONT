import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, Search } from 'lucide-react'
import { Toast, SearchSelect, SimpleSelect } from '../../shared/ui'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate } from '../../shared/admision/types'

/**
 * Screen 15 — Habilitar Candidatos para Curso de Inducción, per
 * `03-admision.md` ("Pantalla 15 — Habilitar Candidatos para Curso de
 * Inducción: Servicios Escolares") and `specs/admision-screens/spec.md`'s
 * "Habilitar para Inducción (Screen 15, RF-ADM-009)" requirement.
 *
 * Only candidates with a paid ficha (`pagoFicha.status` CONFIRMADO or EXENTO
 * — the latter covers a 100% ficha discount granted via Screen 14) are
 * eligible to appear here at all, per the requirement's "List only includes
 * ficha-paid candidates (PAID+)" rule.
 *
 * Estado de inducción is a 3-state value DERIVED per candidate (not a stored
 * field on its own):
 *   - Exento: `pagoInduccion.status === 'EXENTO'` — a 100% induction discount
 *     was already granted via Screen 14, which per that screen's own logic
 *     also sets `induccionHabilitada: true` automatically. These candidates
 *     never need (and cannot receive) this screen's manual "Habilitar"
 *     action, matching the requirement's "excludes already-Exento ... from
 *     actionable selection."
 *   - Habilitado: `induccionHabilitada === true` and NOT exento — this
 *     screen's own "Habilitar" action already ran for this candidate.
 *   - Pendiente: neither of the above — the only state where the checkbox
 *     and the row-level "Habilitar" action are shown, per the UX prompt
 *     ("checkbox de selección múltiple SOLO en filas con estado Pendiente").
 *
 * MOCK-ONLY LIMITATION (persistence): same as every other Admisión
 * write-action screen in this module — there is no shared mutation store
 * across pages. This screen keeps its own `useState` copy of the eligible
 * candidates; habilitando (individually or in bulk) updates that local copy
 * (optimistic UI + toast) but does NOT persist back to `mockCandidates`, so
 * the change is not visible on other screens or after a reload.
 */

type InduccionEstado = 'PENDIENTE' | 'HABILITADO' | 'EXENTO'

const INDUCCION_ESTADO_META: Record<InduccionEstado, { label: string; badgeClass: string }> = {
  PENDIENTE: { label: 'Pendiente', badgeClass: 'bg-gray-100 text-gray-600 border border-gray-200' },
  HABILITADO: { label: 'Habilitado', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200' },
  EXENTO: { label: 'Exento', badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
}

/** Filter dropdown wording follows the UX prompt literally (differs from the badge's own shorter "Pendiente" label). */
const ESTADO_FILTER_ORDER: { value: InduccionEstado; label: string }[] = [
  { value: 'PENDIENTE', label: 'Pendiente de habilitar' },
  { value: 'HABILITADO', label: 'Habilitado' },
  { value: 'EXENTO', label: 'Exento' },
]
const estadoFilterOptions = ESTADO_FILTER_ORDER.map(e => e.label)
const estadoFilterLabelToValue = new Map<string, InduccionEstado>(ESTADO_FILTER_ORDER.map(e => [e.label, e.value]))

/** Candidates eligible for this screen — see file-level comment. */
function isFichaPagada(c: Candidate): boolean {
  return c.pagoFicha.status === 'CONFIRMADO' || c.pagoFicha.status === 'EXENTO'
}

function getInduccionEstado(c: Candidate): InduccionEstado {
  if (c.pagoInduccion.status === 'EXENTO') return 'EXENTO'
  if (c.induccionHabilitada) return 'HABILITADO'
  return 'PENDIENTE'
}

export default function HabilitarInduccion() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates.filter(isFichaPagada))
  const [search, setSearch] = useState('')
  const [programaFilter, setProgramaFilter] = useState('')
  const [estadoFilterLabel, setEstadoFilterLabel] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState('')

  const programas = Array.from(new Set(candidates.map(c => c.programa)))

  const filtered = candidates.filter(c => {
    const matchPrograma = !programaFilter || c.programa === programaFilter
    const estadoValue = estadoFilterLabelToValue.get(estadoFilterLabel)
    const matchEstado = !estadoValue || getInduccionEstado(c) === estadoValue
    const q = search.trim().toLowerCase()
    const matchSearch = !q || c.nombre.toLowerCase().includes(q) || c.folio.toLowerCase().includes(q)
    return matchPrograma && matchEstado && matchSearch
  })

  const selectedCount = selectedIds.size

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function habilitar(ids: string[]) {
    const idSet = new Set(ids)
    setCandidates(prev => prev.map(c => (idSet.has(c.id) ? { ...c, induccionHabilitada: true } : c)))
    setSelectedIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.delete(id))
      return next
    })
    setToast(`${ids.length} candidato(s) habilitado(s) para el curso de inducción.`)
  }

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/admision')} className="hover:text-[#009574] transition-colors">
          Inicio
        </button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Admisión</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Habilitación para Inducción</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Habilitación para Inducción</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">Solo aparecen candidatos con ficha pagada.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="w-64">
          <SearchSelect
            options={programas}
            value={programaFilter}
            onChange={setProgramaFilter}
            placeholder="Todos los programas"
          />
        </div>
        <div className="w-52">
          <SimpleSelect
            options={estadoFilterOptions}
            value={estadoFilterLabel}
            onChange={setEstadoFilterLabel}
            placeholder="Todos"
          />
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Buscar por nombre o folio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="px-4 py-3 w-10" />
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-40">Folio</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nombre Completo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Examen</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-36">Estado Inducción</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Search size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">No se encontraron candidatos</p>
                    <p className="text-[12px]">Intenta ajustar los filtros de búsqueda</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(row => {
                const estado = getInduccionEstado(row)
                const pendiente = estado === 'PENDIENTE'
                return (
                  <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3">
                      {pendiente && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelected(row.id)}
                          className="h-4 w-4 rounded border-[#E5E7EB] text-[#009574] focus:ring-[#009574]/30 cursor-pointer"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#6B7280]">{row.folio}</td>
                    <td className="px-4 py-3 font-medium text-[#333333]">{row.nombre}</td>
                    <td className="px-4 py-3 text-[#333333]">{row.programa}</td>
                    <td className="px-4 py-3 text-[#333333]">{row.examen?.calificacion ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${INDUCCION_ESTADO_META[estado].badgeClass}`}>
                        {INDUCCION_ESTADO_META[estado].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {pendiente && (
                        <button
                          onClick={() => habilitar([row.id])}
                          className="px-3 py-1.5 text-[12px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
                        >
                          Habilitar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Pagination — static footer, mock data fits a single page (mirrors
            `CandidatosList.tsx`'s convention; no real pagination logic yet). */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB] bg-[#F8F9FA]">
          <p className="text-[12px] text-[#6B7280]">
            {filtered.length === 0
              ? 'Sin resultados para los filtros aplicados'
              : `Mostrando 1–${filtered.length} de ${filtered.length} registros`}
          </p>
        </div>
      </div>

      {/* Bulk action */}
      <div className="flex justify-end mt-5">
        <button
          onClick={() => habilitar(Array.from(selectedIds))}
          disabled={selectedCount === 0}
          className="px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Habilitar seleccionados ({selectedCount})
        </button>
      </div>
    </div>
  )
}
