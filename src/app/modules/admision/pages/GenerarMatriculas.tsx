import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Info, CheckCircle2 } from 'lucide-react'
import { ConfirmModal, Toast } from '@app/core/components/ui'
import { Button } from '@app/core/components/form'
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  DataTable,
  MobileCards,
  type ColumnDef,
} from '@app/core/components/list'
import { mockCandidates } from '../data/mockData'
import type { Candidate } from '../data/types'

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

  const columns: ColumnDef<ProgramaSummary>[] = [
    { key: 'programa', header: 'Carrera', type: 'name' },
    { key: 'admitidos', header: 'Admitidos', type: 'count', className: 'w-32' },
    { key: 'generadas', header: 'Matrículas Generadas', type: 'count', className: 'w-44' },
    {
      key: 'accion',
      header: 'Acción',
      className: 'w-56',
      render: row =>
        row.admitidos > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setScope({ kind: 'program', programa: row.programa })}
            className="text-[#009574] border-[#009574]/30 hover:bg-[#e6f5f1]"
          >
            Generar para {row.programa}
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} /> Completado
          </span>
        ),
    },
  ]

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
    <PageContainer>
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

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/admision' },
          { label: 'Admisión' },
          { label: 'Generar Matrículas' },
        ]}
      />

      <PageHeader
        title="Generar Matrículas"
        subtitle="Genera la matrícula, asigna grupo y crea la cuenta de acceso para cada candidato admitido. Este paso se ejecuta antes de publicar los resultados — la lista publicada debe incluir folio y matrícula asignada."
      />

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3.5 mb-6">
        <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-[13px] text-blue-700">
          Las decisiones de selección están listas. Genera las matrículas por carrera o en lote antes de publicar la
          lista oficial de admitidos.
        </p>
      </div>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        status="idle"
        items={summary}
        keyFor={row => row.programa}
        loadingLabel="Cargando carreras..."
        emptyTitle="No hay carreras con candidatos admitidos"
        emptyHint="Vuelve a intentarlo en unos momentos."
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status="idle"
        items={summary}
        keyFor={row => row.programa}
        renderItem={row => (
          <>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[13px] font-medium text-[#333333]">{row.programa}</span>
              {row.admitidos > 0 && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {row.admitidos} pendiente{row.admitidos !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#6B7280] mb-3">
              <span>Admitidos: <span className="font-medium text-[#333333]">{row.admitidos}</span></span>
              <span>Matrículas generadas: <span className="font-medium text-[#333333]">{row.generadas}</span></span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              {row.admitidos > 0 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setScope({ kind: 'program', programa: row.programa })}
                  className="flex-1 text-[#009574] border-[#009574]/30 hover:bg-[#e6f5f1]"
                >
                  Generar para {row.programa}
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={12} /> Completado
                </span>
              )}
            </div>
          </>
        )}
        loadingLabel="Cargando carreras..."
        emptyTitle="No hay carreras con candidatos admitidos"
        emptyHint="Vuelve a intentarlo en unos momentos."
      />

      <div className='mt-6'>
        {/* Bulk action — only shown while at least one program is still pending */}
        {pendingPrograms.length > 0 && (
          <Button onClick={() => setScope({ kind: 'all' })}>
            Generar Matrículas para Todos los Programas Pendientes
          </Button>
        )}

        {/* Publish nav — only once every program is Completado (forward pointer to Screen 9, task 2.13) */}
        {allCompleted && (
          <Button onClick={() => navigate('/admision/publicar')}>
            Publicar resultados de admisión
          </Button>
        )}
      </div>
    </PageContainer>
  )
}
