import { useState } from 'react'
import { Info } from 'lucide-react'
import { Switch, Toast } from '@app/core/components/ui'
import { FormHeader } from '@app/core/components/form'
import {
  PageContainer,
  Breadcrumb,
  SearchInput,
  FilterBar,
  FilterSelect,
  ResultCount,
  DataTable,
  MobileCards,
  type ColumnDef,
} from '@app/core/components/list'
import { mockCandidates } from '../data/mockData'
import type { Candidate, CandidateStatus } from '../data/types'

/**
 * Screen 11 — Selección de Candidatos, per `03-admision.md` ("Pantalla 11 —
 * Selección de Candidatos: Director de División") and
 * `specs/admision-screens/spec.md`'s "Selección de Candidatos (Screen 11)"
 * requirement. Role: Director de División.
 *
 * One of only 3 actions in the whole Admisión module allowed to change
 * `Candidate.status` (the others: Screen 6 → PAID, Screen 12 → ENROLLED).
 *
 * CORRECTION (2026-07-01, PO decision): decisions are captured via a Switch
 * per candidate instead of separate Admitir/Rechazar buttons. OFF = Rechazado
 * (the default for every candidate, regardless of prior state) and ON =
 * Admitido. The switch is fully reversible in both directions for as long as
 * "Selección Abierta" is shown — this changes only how the decision is
 * captured/edited, not the underlying business process (`selectionStatus`
 * still lives on `ProgramAdmissionConfig`; Servicios Escolares still closes
 * it via Publicar Resultados on Screen 9 — see `docs/design/dominio/03-admision.md`).
 * There is no "Sin decisión" state anymore: every candidate is always either
 * Admitido or Rechazado. Decisions are allowed even when exam/induction
 * results are still missing (per spec).
 *
 * Only candidates that have reached a decision-eligible stage are listed:
 * PAID/EXAM_TAKEN/ACCEPTED/REJECTED. REGISTERED (hasn't paid the ficha yet)
 * and ENROLLED (already past this screen, matrícula generated) are excluded.
 *
 * MOCK-SCOPE LIMITATION (Programa Educativo filter): the UX prompt scopes
 * this filter to "solo los de tu división" (the signed-in Director's own
 * division). `RoleContext`'s mock `DIRECTOR_DIVISION` role has no attached
 * division identity (no per-user division claim exists in the mock auth
 * model), so there is no real value to scope by. Per this task's explicit
 * instruction, the filter shows every program across all divisions instead
 * of narrowing by division — documented here rather than silently
 * implementing a fake scope.
 *
 * MOCK-SCOPE LIMITATION (isFirstChoice / "Opción" column): `isFirstChoice`
 * is only ever captured as local wizard state during Screen 4's Paso 3 and
 * is never persisted onto `Candidate` or `FichaAdmisionCompleta` (see
 * `SeleccionCarreraFicha` in `shared/admision/types.ts` — it only adds
 * `modalidad`, per an explicit design note that programa/canal/isFirstChoice
 * "stay on the wizard's local step state"). None of `mockCandidates`' rows
 * carry this data. Rather than adding a new persisted field to the shared
 * `Candidate` type (out of scope for this task, and risks breaking already-
 * shipped screens 1/3/5 that only read the existing fields), this screen
 * derives a deterministic mock value from the candidate id parity (odd id →
 * "1ª opción", even id → "2ª opción") purely for this screen's own display.
 * It carries no real meaning and does not persist anywhere.
 *
 * MOCK-ONLY LIMITATION (Admitir/Rechazar persistence): same as every other
 * Admisión write-action screen in this module — there is no shared mutation
 * store across pages. This screen keeps its own `useState` copy of the
 * decision-eligible candidates; clicking Admitir/Rechazar updates that local
 * copy (optimistic UI + toast) but does NOT persist back to `mockCandidates`,
 * so the change is not visible on other screens or after a reload.
 */

type Decision = 'ADMITIDO' | 'RECHAZADO'

const DECISION_ORDER: Decision[] = ['ADMITIDO', 'RECHAZADO']
const DECISION_LABEL: Record<Decision, string> = { ADMITIDO: 'Admitido', RECHAZADO: 'Rechazado' }
const OPCION_BADGES: Record<string, { label: string; className: string }> = {
  '1ª opción': { label: '1ª opción', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  '2ª opción': { label: '2ª opción', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
}

/** Statuses eligible to appear on this screen — see file-level comment. */
const ELIGIBLE_STATUSES: CandidateStatus[] = ['PAID', 'EXAM_TAKEN', 'ACCEPTED', 'REJECTED']

/** OFF/Rechazado is the default for anything that isn't already ACCEPTED (PAID, EXAM_TAKEN, REJECTED alike). */
function getDecision(status: CandidateStatus): Decision {
  return status === 'ACCEPTED' ? 'ADMITIDO' : 'RECHAZADO'
}

/** See file-level "MOCK-SCOPE LIMITATION (isFirstChoice)" comment. */
function isFirstChoiceMock(candidate: Candidate): boolean {
  return Number(candidate.id) % 2 !== 0
}

export default function SeleccionCandidatos() {
  const [candidates, setCandidates] = useState<Candidate[]>(
    mockCandidates.filter(c => ELIGIBLE_STATUSES.includes(c.status)),
  )
  const [search, setSearch] = useState('')
  const [programaFilter, setProgramaFilter] = useState('')
  const [decisionFilter, setDecisionFilter] = useState<Decision | ''>('')
  const [toast, setToast] = useState('')

  const programas = Array.from(new Set(mockCandidates.map(c => c.programa)))

  const filtered = candidates.filter(c => {
    const matchPrograma = !programaFilter || c.programa === programaFilter
    const matchDecision = !decisionFilter || getDecision(c.status) === decisionFilter
    const q = search.trim().toLowerCase()
    const matchSearch = !q || c.nombre.toLowerCase().includes(q) || c.folio.toLowerCase().includes(q)
    return matchPrograma && matchDecision && matchSearch
  })

  /** Fully reversible while "Selección Abierta" — no lock, either direction always allowed. */
  function handleToggle(id: string, admitido: boolean) {
    const target = candidates.find(c => c.id === id)
    if (!target) return
    const nextStatus: CandidateStatus = admitido ? 'ACCEPTED' : 'REJECTED'
    setCandidates(prev => prev.map(c => (c.id === id ? { ...c, status: nextStatus } : c)))
    setToast(admitido ? `${target.nombre} fue admitido.` : `${target.nombre} fue rechazado.`)
  }

  const columns: ColumnDef<Candidate>[] = [
    { key: 'folio', header: 'Folio', type: 'code', className: 'w-40' },
    { key: 'nombre', header: 'Nombre Completo', type: 'name' },
    { key: 'opcion', header: 'Opción', type: 'badge', className: 'w-28', value: row => (isFirstChoiceMock(row) ? '1ª opción' : '2ª opción'), badge: OPCION_BADGES },
    { key: 'examen', header: 'Examen', type: 'text', className: 'w-24', value: row => row.examen?.calificacion ?? '—' },
    { key: 'induccion', header: 'Inducción', type: 'text', className: 'w-24', value: row => row.induccionResultado?.calificacion ?? '—' },
    {
      key: 'decision',
      header: 'Decisión',
      className: 'w-40',
      render: row => {
        const decision = getDecision(row.status)
        const admitido = decision === 'ADMITIDO'
        return (
          <div className="flex items-center gap-2.5">
            <Switch checked={admitido} onChange={v => handleToggle(row.id, v)} />
            <span className={`text-[12px] font-semibold ${admitido ? 'text-emerald-700' : 'text-[#6B7280]'}`}>
              {DECISION_LABEL[decision]}
            </span>
          </div>
        )
      },
    },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/admision' },
          { label: 'Admisión' },
          { label: 'Selección de Candidatos' },
        ]}
      />

      <FormHeader
        title="Selección de Candidatos"
        subtitle="Revisa los candidatos de tus carreras con sus resultados disponibles y marca cada uno como admitido o rechazado. Solo puedes actuar sobre candidatos de tu división."
        right={
          <span className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap mt-1">
            Selección Abierta
          </span>
        }
      />

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3.5 mb-6">
        <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-[13px] text-blue-700">
          Puedes tomar decisiones aunque no todos los resultados estén disponibles. Una vez que Servicios Escolares
          publique los resultados, no podrás modificar tus decisiones.
        </p>
      </div>

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
          value={decisionFilter}
          onChange={v => setDecisionFilter(v as Decision | '')}
          allLabel="Todas las decisiones"
          options={DECISION_ORDER.map(d => ({ value: d, label: DECISION_LABEL[d] }))}
          className="sm:w-48"
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
          const decision = getDecision(row.status)
          const admitido = decision === 'ADMITIDO'
          const firstChoice = isFirstChoiceMock(row)
          return (
            <>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[13px] font-medium text-[#333333]">{row.nombre}</span>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  firstChoice
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  {firstChoice ? '1ª opción' : '2ª opción'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#6B7280] mb-3">
                <span>Folio: <span className="font-mono font-medium text-[#333333]">{row.folio}</span></span>
                <span>Examen: <span className="font-medium text-[#333333]">{row.examen?.calificacion ?? '—'}</span></span>
                <span>Inducción: <span className="font-medium text-[#333333]">{row.induccionResultado?.calificacion ?? '—'}</span></span>
              </div>
              <div className="flex items-center gap-2.5 pt-2 border-t border-[#E5E7EB]">
                <Switch checked={admitido} onChange={v => handleToggle(row.id, v)} />
                <span className={`text-[12px] font-semibold ${admitido ? 'text-emerald-700' : 'text-[#6B7280]'}`}>
                  {DECISION_LABEL[decision]}
                </span>
              </div>
            </>
          )
        }}
        loadingLabel="Cargando candidatos..."
        emptyTitle="No se encontraron candidatos"
        emptyHint="Intenta ajustar los filtros de búsqueda"
      />
    </PageContainer>
  )
}
