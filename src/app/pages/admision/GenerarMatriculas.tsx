import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, Info, CheckCircle2 } from 'lucide-react'
import { ConfirmModal, Toast } from '../../shared/ui'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate } from '../../shared/admision/types'

/**
 * Screen 12 — Generar Matrículas, per `03-admision.md` ("Pantalla 12 —
 * Generar Matrículas") and `specs/admision-screens/spec.md`'s "Generar
 * Matrículas (Screen 12)" requirement. Role: Servicios Escolares.
 *
 * One of only 3 actions in the whole Admisión module allowed to change
 * `Candidate.status` (the others: Screen 6 → PAID, Screen 11 → ACCEPTED/
 * REJECTED). Transitions ACCEPTED → ENROLLED and assigns a mock `matricula`.
 * Per the "Candidate Status State Machine" requirement, this step runs
 * BEFORE Screen 9 (Publicar Resultados) — Screen 9 must be blocked until
 * every ACCEPTED candidate here has been generated into ENROLLED.
 *
 * Aggregates `mockCandidates` by `programa`: "Admitidos" = ACCEPTED count
 * still pending matrícula generation, "Matrículas Generadas" = ENROLLED
 * count. Only programs with at least one ACCEPTED or ENROLLED candidate are
 * listed (a program with zero candidates in either bucket has nothing to do
 * on this screen).
 *
 * MOCK-ONLY LIMITATION (persistence): same as every other Admisión
 * write-action screen in this module (Screens 6, 8, 10, 11) — there is no
 * shared mutation store across pages. This screen keeps its own `useState`
 * copy of the ACCEPTED/ENROLLED candidates; generating matrículas updates
 * that local copy (optimistic UI + toast) but does NOT persist back to
 * `mockCandidates`, so the change is not visible on other screens or after a
 * reload.
 *
 * MOCK matrícula format: `{año4}{periodo1}{consecutivo4}` per
 * `docs/requirements/00-TRANSVERSALES.md` (e.g. `202610001` for the active
 * "Enero – Abril 2026" period — periodo digit `1`, matching the
 * `PERIODO_ACTIVO` convention used across `CandidatosList.tsx` /
 * `FichaConfirmacion.tsx`). The consecutive counter is screen-local (resets
 * on remount) and intentionally does not coordinate with the one
 * pre-existing `mockCandidates` ENROLLED seed row's matrícula
 * (`2026LADM0087`, legacy seed data predating this task's format).
 *
 * `/admision/publicar` (Screen 9, task 2.13) is not built yet — the
 * "Publicar resultados de admisión" button below is a forward pointer per
 * this task's instructions, since the corrected screen ordering requires
 * Screen 12 to exist before Screen 9 is usable.
 */

/** Active admission period, matching `PERIODO_ACTIVO` used elsewhere in the module. */
const PERIODO_ACTIVO_ANIO = '2026'
/** Enero–Abril is the first cuatrimestre of the year. */
const PERIODO_ACTIVO_DIGITO = '1'

/** Screen-local mock consecutivo — see file-level "MOCK matrícula format" note. */
let matriculaConsecutivo = 0

function nextMatricula(): string {
  matriculaConsecutivo += 1
  return `${PERIODO_ACTIVO_ANIO}${PERIODO_ACTIVO_DIGITO}${String(matriculaConsecutivo).padStart(4, '0')}`
}

interface ProgramaSummary {
  programa: string
  admitidos: number
  generadas: number
}

function buildSummary(list: Candidate[]): ProgramaSummary[] {
  const map = new Map<string, ProgramaSummary>()
  for (const c of list) {
    if (!map.has(c.programa)) map.set(c.programa, { programa: c.programa, admitidos: 0, generadas: 0 })
    const entry = map.get(c.programa)!
    if (c.status === 'ACCEPTED') entry.admitidos += 1
    else if (c.status === 'ENROLLED') entry.generadas += 1
  }
  return Array.from(map.values())
}

type Scope = { kind: 'program'; programa: string } | { kind: 'all' }

export default function GenerarMatriculas() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState<Candidate[]>(
    mockCandidates.filter(c => c.status === 'ACCEPTED' || c.status === 'ENROLLED'),
  )
  const [scope, setScope] = useState<Scope | null>(null)
  const [toast, setToast] = useState('')

  const summary = buildSummary(candidates)
  const pendingPrograms = summary.filter(s => s.admitidos > 0)
  const allCompleted = summary.length > 0 && pendingPrograms.length === 0

  function pendingCountForScope(s: Scope): number {
    if (s.kind === 'all') return pendingPrograms.reduce((acc, p) => acc + p.admitidos, 0)
    return summary.find(p => p.programa === s.programa)?.admitidos ?? 0
  }

  function handleConfirm() {
    if (!scope) return
    const count = pendingCountForScope(scope)
    setCandidates(prev =>
      prev.map(c => {
        if (c.status !== 'ACCEPTED') return c
        if (scope.kind === 'program' && c.programa !== scope.programa) return c
        return { ...c, status: 'ENROLLED', matricula: nextMatricula() }
      }),
    )
    setToast(`Matrículas generadas correctamente. Se ${count === 1 ? 'generó 1 matrícula' : `generaron ${count} matrículas`}.`)
    setScope(null)
  }

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {scope && (
        <ConfirmModal
          title="¿Confirmas la generación de matrículas?"
          message={`Se crearán ${pendingCountForScope(scope)} matrícula(s), se asignarán grupos y se enviarán las credenciales de acceso al sistema por correo institucional. Esta acción no puede deshacerse.`}
          confirmLabel="Confirmar y Generar"
          onConfirm={handleConfirm}
          onCancel={() => setScope(null)}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/admision')} className="hover:text-[#009574] transition-colors">
          Inicio
        </button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Admisión</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Generar Matrículas</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Generar Matrículas</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Genera la matrícula, asigna grupo y crea la cuenta de acceso para cada candidato admitido. Este paso se
          ejecuta antes de publicar los resultados — la lista publicada debe incluir folio y matrícula asignada.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3.5 mb-6">
        <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-[13px] text-blue-700">
          Las decisiones de selección están listas. Genera las matrículas por programa o en lote antes de publicar la
          lista oficial de admitidos.
        </p>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden mb-6">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Admitidos</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-44">Matrículas Generadas</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-56">Acción</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center text-[13px] text-[#6B7280]">
                  No hay programas con candidatos admitidos.
                </td>
              </tr>
            ) : (
              summary.map(row => (
                <tr key={row.programa} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#333333]">{row.programa}</td>
                  <td className="px-4 py-3 text-[#333333]">{row.admitidos}</td>
                  <td className="px-4 py-3 text-[#333333]">{row.generadas}</td>
                  <td className="px-4 py-3">
                    {row.admitidos > 0 ? (
                      <button
                        type="button"
                        onClick={() => setScope({ kind: 'program', programa: row.programa })}
                        className="px-3 py-1.5 text-[12px] font-semibold border border-[#009574] text-[#009574] rounded-md hover:bg-[#e6f5f1] transition-colors"
                      >
                        Generar para {row.programa}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={12} /> Completado
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk action — only shown while at least one program is still pending */}
      {pendingPrograms.length > 0 && (
        <button
          type="button"
          onClick={() => setScope({ kind: 'all' })}
          className="px-4 py-2.5 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
        >
          Generar Matrículas para Todos los Programas Pendientes
        </button>
      )}

      {/* Publish nav — only once every program is Completado (forward pointer to Screen 9, task 2.13) */}
      {allCompleted && (
        <button
          type="button"
          onClick={() => navigate('/admision/publicar')}
          className="px-4 py-2.5 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
        >
          Publicar resultados de admisión
        </button>
      )}
    </div>
  )
}
