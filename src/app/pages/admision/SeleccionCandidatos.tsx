import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, Search, Info } from 'lucide-react'
import { SearchSelect, SimpleSelect, Switch, Toast } from '../../shared/ui'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate, CandidateStatus } from '../../shared/admision/types'

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
const decisionOptions = DECISION_ORDER.map(d => DECISION_LABEL[d])
const decisionLabelToDecision = new Map<string, Decision>(DECISION_ORDER.map(d => [DECISION_LABEL[d], d]))

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
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState<Candidate[]>(
    mockCandidates.filter(c => ELIGIBLE_STATUSES.includes(c.status)),
  )
  const [search, setSearch] = useState('')
  const [programaFilter, setProgramaFilter] = useState('')
  const [decisionLabel, setDecisionLabel] = useState('')
  const [toast, setToast] = useState('')

  const programas = Array.from(new Set(mockCandidates.map(c => c.programa)))

  const filtered = candidates.filter(c => {
    const matchPrograma = !programaFilter || c.programa === programaFilter
    const matchDecision = !decisionLabel || getDecision(c.status) === decisionLabelToDecision.get(decisionLabel)
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
        <span className="text-[#333333] font-medium">Selección de Candidatos</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Selección de Candidatos</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Revisa los candidatos de tus programas con sus resultados disponibles y marca cada uno como admitido o
            rechazado. Solo puedes actuar sobre candidatos de tu división.
          </p>
        </div>
        <span className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap mt-1">
          Selección Abierta
        </span>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3.5 mb-6">
        <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-[13px] text-blue-700">
          Puedes tomar decisiones aunque no todos los resultados estén disponibles. Una vez que Servicios Escolares
          publique los resultados, no podrás modificar tus decisiones.
        </p>
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
        <div className="w-48">
          <SimpleSelect
            options={decisionOptions}
            value={decisionLabel}
            onChange={setDecisionLabel}
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
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-40">Folio</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nombre Completo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Opción</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Examen</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Inducción</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-40">Decisión</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Search size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">No se encontraron candidatos</p>
                    <p className="text-[12px]">Intenta ajustar los filtros de búsqueda</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(row => {
                const decision = getDecision(row.status)
                const admitido = decision === 'ADMITIDO'
                const firstChoice = isFirstChoiceMock(row)
                return (
                  <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3 font-mono text-[12px] text-[#6B7280]">{row.folio}</td>
                    <td className="px-4 py-3 font-medium text-[#333333]">{row.nombre}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          firstChoice
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        {firstChoice ? '1ª opción' : '2ª opción'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#333333]">{row.examen?.calificacion ?? '—'}</td>
                    <td className="px-4 py-3 text-[#333333]">{row.induccionResultado?.calificacion ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Switch checked={admitido} onChange={v => handleToggle(row.id, v)} />
                        <span className={`text-[12px] font-semibold ${admitido ? 'text-emerald-700' : 'text-[#6B7280]'}`}>
                          {DECISION_LABEL[decision]}
                        </span>
                      </div>
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
    </div>
  )
}
