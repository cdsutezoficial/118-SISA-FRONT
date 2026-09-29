import { useState } from 'react'
import { Toast } from '@app/core/components/ui'
import { Button } from '@app/core/components/form'
import { Checkbox } from '@app/core/ui/checkbox'
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  SearchInput,
  FilterBar,
  FilterSelect,
  ResultCount,
  DataTable,
  MobileCards,
  type ColumnDef,
} from '@app/core/components/list'
import { mockCandidates } from '../data/mockData'
import type { Candidate } from '../data/types'

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

const INDUCCION_BADGES: Record<string, { label: string; className: string }> = {
  Pendiente: { label: 'Pendiente', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  Habilitado: { label: 'Habilitado', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  Exento: { label: 'Exento', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
}

/** Filter dropdown wording follows the UX prompt literally (differs from the badge's own shorter "Pendiente" label). */
const ESTADO_FILTER_ORDER: { value: InduccionEstado; label: string }[] = [
  { value: 'PENDIENTE', label: 'Pendiente de habilitar' },
  { value: 'HABILITADO', label: 'Habilitado' },
  { value: 'EXENTO', label: 'Exento' },
]

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
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates.filter(isFichaPagada))
  const [search, setSearch] = useState('')
  const [programaFilter, setProgramaFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<InduccionEstado | ''>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState('')

  const programas = Array.from(new Set(candidates.map(c => c.programa)))

  const filtered = candidates.filter(c => {
    const matchPrograma = !programaFilter || c.programa === programaFilter
    const matchEstado = !estadoFilter || getInduccionEstado(c) === estadoFilter
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

  const columns: ColumnDef<Candidate>[] = [
    {
      key: '__select__',
      header: '',
      className: 'w-10',
      render: row => {
        const pendiente = getInduccionEstado(row) === 'PENDIENTE'
        return pendiente ? (
          <Checkbox
            checked={selectedIds.has(row.id)}
            onCheckedChange={() => toggleSelected(row.id)}
          />
        ) : null
      },
    },
    { key: 'folio', header: 'Folio', type: 'code', className: 'w-40' },
    { key: 'nombre', header: 'Nombre Completo', type: 'name' },
    { key: 'programa', header: 'Carrera', type: 'text' },
    { key: 'examen', header: 'Examen', type: 'text', className: 'w-24', value: row => row.examen?.calificacion ?? '—' },
    { key: 'estado', header: 'Estado Inducción', type: 'badge', className: 'w-36', value: row => INDUCCION_ESTADO_META[getInduccionEstado(row)].label, badge: INDUCCION_BADGES },
    {
      key: 'acciones',
      header: 'Acciones',
      className: 'w-32',
      render: row =>
        getInduccionEstado(row) === 'PENDIENTE' ? (
          <Button size="sm" onClick={() => habilitar([row.id])}>
            Habilitar
          </Button>
        ) : null,
    },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/admision' },
          { label: 'Admisión' },
          { label: 'Habilitación para Inducción' },
        ]}
      />

      <PageHeader
        title="Habilitación para Inducción"
        subtitle="Solo aparecen candidatos con ficha pagada."
      />

      {/* Filters */}
      <FilterBar>
        <FilterSelect
          value={programaFilter}
          onChange={setProgramaFilter}
          allLabel="Todas las carreras"
          options={programas.map(p => ({ value: p, label: p }))}
          className="sm:w-64"
        />
        <FilterSelect
          value={estadoFilter}
          onChange={v => setEstadoFilter(v as InduccionEstado | '')}
          allLabel="Todos"
          options={ESTADO_FILTER_ORDER.map(e => ({ value: e.value, label: e.label }))}
          className="sm:w-52"
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o folio..." />
        <ResultCount count={filtered.length} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        status="idle"
        items={filtered}
        keyFor={row => row.id}
        loadingLabel="Cargando candidatos..."
        emptyTitle="No se encontraron candidatos"
        emptyHint="Intenta ajustar los filtros de búsqueda"
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status="idle"
        items={filtered}
        keyFor={row => row.id}
        renderItem={row => {
          const estado = getInduccionEstado(row)
          const pendiente = estado === 'PENDIENTE'
          return (
            <>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-[13px] font-medium text-[#333333]">{row.nombre}</span>
                {pendiente && (
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onCheckedChange={() => toggleSelected(row.id)}
                    className="flex-shrink-0"
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#6B7280] mb-3">
                <span>Folio: <span className="font-mono font-medium text-[#333333]">{row.folio}</span></span>
                <span>Carrera: <span className="font-medium text-[#333333]">{row.programa}</span></span>
                <span>Examen: <span className="font-medium text-[#333333]">{row.examen?.calificacion ?? '—'}</span></span>
                <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${INDUCCION_ESTADO_META[estado].badgeClass}`}>
                  {INDUCCION_ESTADO_META[estado].label}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
                {pendiente ? (
                  <Button size="sm" onClick={() => habilitar([row.id])}>
                    Habilitar
                  </Button>
                ) : null}
              </div>
            </>
          )
        }}
        loadingLabel="Cargando candidatos..."
        emptyTitle="No se encontraron candidatos"
        emptyHint="Intenta ajustar los filtros de búsqueda"
      />

      {/* Bulk action */}
      <div className="flex justify-end mt-5">
        <Button onClick={() => habilitar(Array.from(selectedIds))} disabled={selectedCount === 0}>
          Habilitar seleccionados ({selectedCount})
        </Button>
      </div>
    </PageContainer>
  )
}
