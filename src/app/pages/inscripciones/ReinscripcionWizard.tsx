import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Wizard, type WizardStep } from '../../shared/Wizard'
import { FieldLabel, SearchSelect } from '../../shared/ui'
import { mockStudents, mockEnrollments, mockActiveDebts, ACTIVE_PERIOD } from '../../shared/inscripciones/mockData'
import type { Student, EnrollmentType } from '../../shared/inscripciones/types'

/**
 * Screen 5 — Reinscripción: Wizard (3 pasos).
 *
 * Paso 1 (Estudiante) — search + `FinanceQueryPort.hasActiveDebt` gate /
 * Paso 2 (Materias) — REGULAR vs RETAKE (Recursamiento) badges / Paso 3
 * (Confirmación). Mirrors `NuevoIngresoWizard.tsx`'s lifted-form-state
 * pattern; reuses only `Wizard` + `shared/ui.tsx` primitives per design.md's
 * "no new shared primitives" decision — everything else is inline Tailwind.
 *
 * Search pool is restricted to `status === 'ACTIVE'` students — reinscripción
 * is for continuing students already active in the system (spec: "search and
 * select an active student"). `EstudiantesList.tsx`'s "Reinscribir" row
 * action deep-links via `?id=` for every row regardless of status; that
 * preselection only takes effect here when the id belongs to the ACTIVE pool,
 * otherwise the search starts empty.
 */

/** Read-only summary field — mirrors the page-local `ReadField` pattern already used in `NuevoIngresoWizard.tsx`/`EstudianteDetalle.tsx`. */
function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[13px] text-[#333333] font-medium">{value || '—'}</p>
    </div>
  )
}

/** Badge for `EnrollmentType` — Recursamiento (amber, reuses `STUDENT_STATUS_META`'s amber intent) vs Regular (neutral gray). */
function TipoMateriaBadge({ type }: { type: EnrollmentType }) {
  if (type === 'RETAKE') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        Recursamiento
      </span>
    )
  }
  return (
    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
      {type === 'ACCREDITED' ? 'Acreditada' : 'Regular'}
    </span>
  )
}

// ─── Paso 1: pool of students eligible for reinscripción ────────────────────
const eligibleStudents = mockStudents.filter(s => s.status === 'ACTIVE')
const studentLabel = (s: Student) => `${s.matricula} — ${s.nombre}`
const studentOptions = eligibleStudents.map(studentLabel)

interface Paso1State {
  studentLabel: string
}

const emptyPaso1: Paso1State = { studentLabel: '' }

/** Materias-to-enroll table, shared by Paso 2 and Paso 3's summary. */
function MateriasTable({ rows }: { rows: (typeof mockEnrollments)[number][] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-[#6B7280]">
        Aún no hay materias generadas para este periodo. El plan de materias se define cuando el Consejo Académico
        confirme el avance del estudiante.
      </p>
    )
  }
  return (
    <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-[#F8F9FA]">
          <tr className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
            <th className="px-4 py-2.5">Materia</th>
            <th className="px-4 py-2.5">Clave</th>
            <th className="px-4 py-2.5">Créditos</th>
            <th className="px-4 py-2.5">Grupo</th>
            <th className="px-4 py-2.5">Tipo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(e => (
            <tr key={e.id} className="border-t border-[#E5E7EB]">
              <td className="px-4 py-2.5 text-[#333333]">{e.materia}</td>
              <td className="px-4 py-2.5 text-[#6B7280] font-mono text-[12px]">{e.clave}</td>
              <td className="px-4 py-2.5 text-[#6B7280]">{e.creditos}</td>
              <td className="px-4 py-2.5 text-[#6B7280]">{e.grupo}</td>
              <td className="px-4 py-2.5"><TipoMateriaBadge type={e.type} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Success modal shown after "Confirmar Reinscripción" — mirrors `NuevoIngresoWizard.tsx`'s `SuccessModal`. */
function SuccessModal({ nombre, onClose }: { nombre: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-sm mx-4 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-emerald-500" />
        </div>
        <h3 className="text-[16px] font-semibold text-[#333333] mb-1">Reinscripción registrada</h3>
        <p className="text-[13px] text-[#6B7280] mb-6">{nombre} fue reinscrito(a) exitosamente para el periodo {ACTIVE_PERIOD}.</p>
        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
        >
          Ir a Estudiantes
        </button>
      </div>
    </div>
  )
}

export default function ReinscripcionWizard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Deep-link from `EstudiantesList.tsx`'s "Reinscribir" action (`?id=`) only
  // preselects when the id belongs to the ACTIVE pool; otherwise the search
  // starts empty rather than silently picking a non-eligible student.
  const idParam = searchParams.get('id')
  const preselected = eligibleStudents.find(s => s.id === idParam) ?? null

  const [paso1, setPaso1] = useState<Paso1State>(preselected ? { studentLabel: studentLabel(preselected) } : emptyPaso1)
  const [showSuccess, setShowSuccess] = useState(false)

  const selectedStudent = eligibleStudents.find(s => studentLabel(s) === paso1.studentLabel) ?? null
  const hasActiveDebt = selectedStudent !== null && !!mockActiveDebts[selectedStudent.id]
  const paso1Valid = selectedStudent !== null && !hasActiveDebt

  const materiasRows = selectedStudent
    ? mockEnrollments.filter(e => e.studentId === selectedStudent.id && e.periodo === ACTIVE_PERIOD)
    : []

  function handleComplete() {
    setShowSuccess(true)
  }

  // ── Paso 1 content: búsqueda del estudiante + gate de adeudos ──
  const paso1Render = (
    <div>
      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Estudiante</p>
      <div className="mb-6">
        <FieldLabel required>Busca al estudiante a reinscribir</FieldLabel>
        <SearchSelect
          options={studentOptions}
          value={paso1.studentLabel}
          onChange={v => setPaso1({ studentLabel: v })}
          placeholder="Buscar por matrícula o nombre"
        />
      </div>

      {selectedStudent ? (
        <>
          <div className="grid grid-cols-12 gap-6 mb-6">
            <div className="col-span-12 md:col-span-6">
              <ReadField label="Nombre Completo" value={selectedStudent.nombre} />
            </div>
            <div className="col-span-12 md:col-span-3">
              <ReadField label="Matrícula" value={selectedStudent.matricula} />
            </div>
            <div className="col-span-12 md:col-span-3">
              <ReadField label="Grupo Actual" value={selectedStudent.grupo} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <ReadField label="Programa" value={selectedStudent.programa} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <ReadField label="Nivel Actual" value={selectedStudent.nivelActual} />
            </div>
          </div>

          {hasActiveDebt && (
            <div className="flex items-start gap-3 px-4 py-3 border border-red-200 bg-red-50 rounded-lg">
              <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-800">
                Este estudiante tiene <strong>adeudos activos</strong> con Finanzas. No puede reinscribirse hasta
                liquidar su deuda (RN-INS-001).
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] text-[#6B7280]">Selecciona un estudiante para ver su información y continuar.</p>
      )}
    </div>
  )

  // ── Paso 2 content: materias a inscribir este periodo (REGULAR vs RETAKE) ──
  const paso2Render = (
    <div>
      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Materias a Inscribir — {ACTIVE_PERIOD}</p>
      <MateriasTable rows={materiasRows} />
    </div>
  )

  // ── Paso 3 content: confirmación ──
  const paso3Render = (
    <div>
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Resumen de Reinscripción</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <ReadField label="Estudiante" value={selectedStudent?.nombre ?? ''} />
          <ReadField label="Programa" value={selectedStudent?.programa ?? ''} />
          <ReadField label="Periodo" value={ACTIVE_PERIOD} />
        </div>
        <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Materias</p>
        <MateriasTable rows={materiasRows} />
      </div>
      <p className="text-[13px] text-[#6B7280]">
        Al confirmar, el estudiante quedará reinscrito para el periodo {ACTIVE_PERIOD}.
      </p>
    </div>
  )

  const steps: WizardStep[] = [
    { id: 'estudiante', label: 'Estudiante', render: paso1Render, isValid: paso1Valid },
    { id: 'materias', label: 'Materias', render: paso2Render },
    { id: 'confirmacion', label: 'Confirmación', render: paso3Render },
  ]

  return (
    <div className="max-w-[880px] mx-auto px-8 py-8">
      {showSuccess && (
        <SuccessModal
          nombre={selectedStudent?.nombre ?? ''}
          onClose={() => navigate('/inscripciones/estudiantes')}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/inscripciones')} className="hover:text-[#009574] transition-colors">
          Inicio
        </button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Inscripciones</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Reinscripción</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Reinscripción</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">Reinscribe a un estudiante activo en 3 pasos.</p>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
        <Wizard steps={steps} onComplete={handleComplete} finishLabel="Confirmar Reinscripción" />
      </div>
    </div>
  )
}
