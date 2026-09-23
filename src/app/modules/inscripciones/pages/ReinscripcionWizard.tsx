import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { Wizard, type WizardStep } from '@app/core/components/Wizard'
import { FieldLabel, SearchSelect, ReadField, SuccessModal } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, MiniTable } from '@app/core/components/form'
import { Breadcrumb, BadgePill, type BadgeStyle } from '@app/core/components/list'
import { mockStudents, mockEnrollments, mockActiveDebts, ACTIVE_PERIOD } from '../data/mockData'
import type { Student } from '../data/types'

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

// ─── Badge map para `EnrollmentType` (BadgePill core): Recursamiento (amber)
// vs Regular/Acreditada (neutral gray). ───────────────────────────────────────
const materiaTypeBadgeMap: Record<string, BadgeStyle> = {
  REGULAR: { label: 'Regular', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  RETAKE: { label: 'Recursamiento', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  ACCREDITED: { label: 'Acreditada', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
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
      <MiniTable
        items={rows}
        keyFor={e => e.id}
        columns={[
          { key: 'materia', header: 'Materia', render: e => <span className="text-[#333333]">{e.materia}</span> },
          { key: 'clave', header: 'Clave', render: e => <span className="font-mono text-[12px] text-[#6B7280]">{e.clave}</span> },
          { key: 'creditos', header: 'Créditos', render: e => <span className="text-[#6B7280]">{e.creditos}</span> },
          { key: 'grupo', header: 'Grupo', render: e => <span className="text-[#6B7280]">{e.grupo}</span> },
          { key: 'type', header: 'Tipo', render: e => <BadgePill value={e.type} map={materiaTypeBadgeMap} /> },
        ]}
      />
    </div>
  )
}

// ─── Success modal shown after "Confirmar Reinscripción" — uses the core
// `SuccessModal` (ui.tsx) shared with NuevoIngresoWizard. ────────────────

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
              <ReadField label="Carrera" value={selectedStudent.programa} />
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
          <ReadField label="Carrera" value={selectedStudent?.programa ?? ''} />
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
    { id: 'confirmacion', label: 'Confirmación', render: paso3Render, gated: true },
  ]

  return (
    <FormPage>
      {showSuccess && (
        <SuccessModal
          title="Reinscripción registrada"
          message={`${selectedStudent?.nombre ?? 'El estudiante'} fue reinscrito(a) exitosamente para el periodo ${ACTIVE_PERIOD}.`}
          buttonLabel="Ir a Estudiantes"
          onClose={() => navigate('/inscripciones/estudiantes')}
        />
      )}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Inscripciones', to: '/inscripciones' },
          { label: 'Reinscripción' },
        ]}
      />

      <FormHeader title="Reinscripción" subtitle="Reinscribe a un estudiante activo en 3 pasos." />

      <FormCard>
        <Wizard steps={steps} onComplete={handleComplete} finishLabel="Confirmar Reinscripción" />
      </FormCard>
    </FormPage>
  )
}
