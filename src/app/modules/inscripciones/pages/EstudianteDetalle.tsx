import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { UserCheck, GraduationCap, History, FileText, ArrowLeftRight } from 'lucide-react'
import { Toast, Tabs, ReadField, SearchSelect, FieldLabel, Modal } from '@app/core/components/ui'
import { FormHeader, FormCard, Button, MiniTable, SelectField } from '@app/core/components/form'
import { Breadcrumb, PageContainer, BadgePill, type BadgeStyle } from '@app/core/components/list'
import { usePendingToast } from '@app/core/infra/hooks'
import { formatDate } from '@app/core/infra/utils'
import {
  mockStudents,
  mockEnrollments,
  mockStudentDocuments,
  mockStudentProgramHistory,
} from '../data/mockData'
import {
  STUDENT_STATUS_META,
  STUDENT_DOCUMENT_TYPE_LABELS,
  type Student,
  type StudentStatus,
  type EnrollmentType,
  type EnrollmentStatus,
  type ProgramChangeType,
  type StudentProgramHistory,
} from '../data/types'

// ─── Tabs ───────────────────────────────────────────────────────────────────

type TabKey = 'info' | 'academico' | 'programas' | 'documentos'

// ─── Local badge metas (page-scoped, mirror CandidatoDetalle's PAYMENT_STATUS_META) ──

const ENROLLMENT_TYPE_META: Record<EnrollmentType, { label: string; badgeClass: string }> = {
  REGULAR: { label: 'Regular', badgeClass: 'bg-gray-100 text-gray-600 border border-gray-200' },
  RETAKE: { label: 'Recursamiento', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' },
  ACCREDITED: { label: 'Acreditada', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200' },
}

const ENROLLMENT_STATUS_META: Record<EnrollmentStatus, { label: string; badgeClass: string }> = {
  ENROLLED: { label: 'Cursando', badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  DROPPED: { label: 'Baja', badgeClass: 'bg-red-50 text-red-700 border border-red-200' },
  PASSED: { label: 'Aprobada', badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  FAILED: { label: 'Reprobada', badgeClass: 'bg-red-50 text-red-700 border border-red-200' },
  EXTRAORDINARY_PENDING: { label: 'Extraordinario Pendiente', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' },
}

const TIPO_CAMBIO_LABELS: Record<ProgramChangeType, string> = {
  INGRESO: 'Ingreso',
  CAMBIO_CARRERA: 'Cambio de Carrera',
  CAMBIO_PLAN: 'Cambio de Plan',
  TSU_CONTINUIDAD: 'Continuidad TSU → Ingeniería',
}

// ─── Badge maps (para BadgePill core) ────────────────────────────────────────

const studentStatusBadgeMap: Record<string, BadgeStyle> = Object.fromEntries(
  (Object.keys(STUDENT_STATUS_META) as StudentStatus[]).map(s => [s, { label: STUDENT_STATUS_META[s].label, className: STUDENT_STATUS_META[s].badgeClass }]),
)

const enrollmentTypeBadgeMap: Record<string, BadgeStyle> = Object.fromEntries(
  (Object.keys(ENROLLMENT_TYPE_META) as EnrollmentType[]).map(t => [t, { label: ENROLLMENT_TYPE_META[t].label, className: ENROLLMENT_TYPE_META[t].badgeClass }]),
)

const enrollmentStatusBadgeMap: Record<string, BadgeStyle> = Object.fromEntries(
  (Object.keys(ENROLLMENT_STATUS_META) as EnrollmentStatus[]).map(s => [s, { label: ENROLLMENT_STATUS_META[s].label, className: ENROLLMENT_STATUS_META[s].badgeClass }]),
)

const actualBadgeMap: Record<string, BadgeStyle> = {
  Actual: { label: 'Actual', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
}

const documentoEntregaBadgeMap: Record<string, BadgeStyle> = {
  ENTREGADO: { label: 'Entregado', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  PENDIENTE: { label: 'Pendiente', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
}

// Motivo options for the Cambiar-Programa modal — excludes INGRESO, which is
// only the first row every student gets (never a "change").
const MOTIVO_OPTIONS: ProgramChangeType[] = ['CAMBIO_CARRERA', 'CAMBIO_PLAN', 'TSU_CONTINUIDAD']

// Small inline catalogs, duplicated per the module's established convention
// (design.md "Paso 2 mirrors Admisión's field logic" decision) rather than a
// new cross-module `shared/catalogos.ts`. Plan claves keyed by programa name
// — dependent Select source for the modal's "Plan" field, same cascade-reset
// pattern as `MUNICIPIOS_POR_ESTADO`.
const PROGRAMA_OPTIONS = Array.from(new Set(mockStudents.map(s => s.programa)))
const GRUPO_OPTIONS = Array.from(new Set(mockStudents.map(s => s.grupo)))
const PLANES_POR_PROGRAMA: Record<string, string[]> = {
  'Ingeniería en Desarrollo y Gestión de Software': ['IDGS-2022'],
  'Ingeniería en Redes y Telecomunicaciones': ['IRT-2021', 'IRT-2022'],
  'Ingeniería Industrial': ['II-2021'],
  'Licenciatura en Administración': ['LADM-2015'],
}

// ─── Cambiar Programa — inline modal, mirrors `CandidatoDetalle.tsx`'s
// `CambiarProgramaModal` (page-local there too), extended to the 4 required
// fields the spec calls for (Programa/Plan/Grupo/Motivo). "No cross-module
// equivalence flow" per design — Confirmar only updates local component
// state, nothing is persisted back to `mockData.ts`. ───

function CambiarProgramaModal({ student, currentPrograma, onSave, onCancel }: {
  student: Student
  currentPrograma: string
  onSave: (input: { programa: string; plan: string; grupo: string; motivo: ProgramChangeType }) => void
  onCancel: () => void
}) {
  const programaOpciones = PROGRAMA_OPTIONS.filter(p => p !== currentPrograma)
  const [programa, setPrograma] = useState('')
  const [plan, setPlan] = useState('')
  const [grupo, setGrupo] = useState('')
  const [motivo, setMotivo] = useState<ProgramChangeType | ''>('')

  const planOpciones = programa ? (PLANES_POR_PROGRAMA[programa] ?? []) : []

  function handleProgramaChange(value: string) {
    setPrograma(value)
    setPlan('') // reset dependent field when Programa changes
  }

  const canConfirm = !!programa && !!plan && !!grupo && !!motivo

  return (
    <Modal
      title="Cambiar Programa"
      onClose={onCancel}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={() => canConfirm && onSave({ programa, plan, grupo, motivo: motivo as ProgramChangeType })} disabled={!canConfirm}>
            Confirmar cambio
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-[#6B7280] mb-4">
        Estudiante: <strong className="text-[#333333]">{student.nombre}</strong> · Programa actual:{' '}
        <strong className="text-[#333333]">{currentPrograma}</strong>
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <FieldLabel required>Programa destino</FieldLabel>
          <SearchSelect options={programaOpciones} value={programa} onChange={handleProgramaChange} placeholder="Selecciona un programa" />
        </div>
        <div>
          <FieldLabel required>Plan</FieldLabel>
          <SearchSelect
            options={planOpciones}
            value={plan}
            onChange={setPlan}
            placeholder={programa ? 'Selecciona un plan' : 'Selecciona un programa primero'}
            disabled={!programa}
          />
        </div>
        <div>
          <FieldLabel required>Grupo destino</FieldLabel>
          <SearchSelect options={GRUPO_OPTIONS} value={grupo} onChange={setGrupo} placeholder="Selecciona un grupo" />
        </div>
        <div>
          <SelectField
            label="Motivo"
            required
            options={MOTIVO_OPTIONS.map(m => ({ value: TIPO_CAMBIO_LABELS[m], label: TIPO_CAMBIO_LABELS[m] }))}
            value={motivo ? TIPO_CAMBIO_LABELS[motivo] : ''}
            onChange={label => setMotivo(MOTIVO_OPTIONS.find(m => TIPO_CAMBIO_LABELS[m] === label) ?? '')}
            placeholder="Selecciona un motivo"
          />
        </div>
      </div>

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 text-[12px] text-amber-700">
        Este registro es informativo — no dispara ningún flujo de equivalencias entre módulos.
      </div>
    </Modal>
  )
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function EstudianteDetalle() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get('id')

  const found = mockStudents.find(s => s.id === idParam)
  const [student] = useState<Student>(found ?? mockStudents[0])

  const pendingToast = usePendingToast()
  const [activeTab, setActiveTab] = useState<TabKey>('info')
  const [toast, setToast] = useState(pendingToast ?? '')
  const [showCambiarPrograma, setShowCambiarPrograma] = useState(false)
  const [historyRows, setHistoryRows] = useState<StudentProgramHistory[]>(() =>
    mockStudentProgramHistory
      .filter(h => h.studentId === student.id)
      .sort((a, b) => (a.desde < b.desde ? -1 : 1)),
  )

  const enrollments = mockEnrollments.filter(e => e.studentId === student.id)
  const documents = mockStudentDocuments.filter(d => d.studentId === student.id)

  const currentPrograma = historyRows.find(h => h.hasta === null)?.programa ?? student.programa

  function handleCambiarPrograma(input: { programa: string; plan: string; grupo: string; motivo: ProgramChangeType }) {
    const today = formatDate(new Date())
    setHistoryRows(prev => {
      const closed = prev.map(h => (h.hasta === null ? { ...h, hasta: today } : h))
      const next: StudentProgramHistory = {
        id: `ph-local-${Date.now()}`,
        studentId: student.id,
        programa: input.programa,
        plan: input.plan,
        desde: today,
        hasta: null,
        tipoCambio: input.motivo,
      }
      return [...closed, next]
    })
    setShowCambiarPrograma(false)
    setToast(`Programa actualizado a "${input.programa}".`)
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'info', label: 'Información General', icon: <UserCheck size={14} /> },
    { key: 'academico', label: 'Historial Académico', icon: <GraduationCap size={14} /> },
    { key: 'programas', label: 'Historial de Programas', icon: <History size={14} /> },
    { key: 'documentos', label: 'Documentos', icon: <FileText size={14} /> },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {showCambiarPrograma && (
        <CambiarProgramaModal
          student={student}
          currentPrograma={currentPrograma}
          onSave={handleCambiarPrograma}
          onCancel={() => setShowCambiarPrograma(false)}
        />
      )}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Inscripciones', to: '/inscripciones' },
          { label: 'Estudiantes', to: '/inscripciones/estudiantes' },
          { label: 'Detalle' },
        ]}
      />

      <FormHeader title={student.nombre} subtitle="Expediente completo del estudiante inscrito." />

      {/* Summary card */}
      <FormCard>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          <ReadField label="Matrícula" value={student.matricula} mono />
          <ReadField label="Programa" value={student.programa} />
          <ReadField label="Nivel Actual" value={student.nivelActual} />
          <ReadField label="Grupo" value={student.grupo} />
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
            <BadgePill value={student.status} map={studentStatusBadgeMap} />
          </div>
        </div>
      </FormCard>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onSelect={k => setActiveTab(k as TabKey)} />

      {/* ── Tab 1: Información General ── */}
      {activeTab === 'info' && (
        <FormCard>
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">Datos Personales</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <ReadField label="Nombre Completo" value={student.nombre} />
            <ReadField label="CURP" value={student.curp} mono />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <ReadField label="Correo Electrónico" value={student.email} mono />
            <ReadField label="Teléfono Celular" value={student.telefono} />
          </div>

          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6 mt-8">Datos de Inscripción</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <ReadField label="División" value={student.division} />
            <ReadField label="Modalidad" value={student.modalidad} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ReadField label="Fecha de Inscripción" value={student.fechaInscripcion} />
            <ReadField label="Generación de Ingreso" value={student.generacionIngreso} />
          </div>
        </FormCard>
      )}

      {/* ── Tab 2: Historial Académico ── */}
      {activeTab === 'academico' && (
        <FormCard>
          {enrollments.length === 0 ? (
            <p className="py-10 text-[13px] text-[#6B7280] text-center">Aún no hay historial académico registrado.</p>
          ) : (
            <MiniTable
              items={enrollments}
              keyFor={row => row.id}
              columns={[
                { key: 'periodo', header: 'Periodo' },
                {
                  key: 'materia',
                  header: 'Materia',
                  render: row => <span className="font-medium text-[#333333]">{row.materia}</span>,
                },
                { key: 'clave', header: 'Clave', render: row => <span className="font-mono text-[12px] text-[#6B7280]">{row.clave}</span> },
                { key: 'creditos', header: 'Créditos' },
                { key: 'grupo', header: 'Grupo' },
                { key: 'type', header: 'Tipo', render: row => <BadgePill value={row.type} map={enrollmentTypeBadgeMap} /> },
                { key: 'status', header: 'Estado', render: row => <BadgePill value={row.status} map={enrollmentStatusBadgeMap} /> },
                { key: 'calif', header: 'Calif.', render: row => (row.calificacionFinal ?? '—') },
              ]}
            />
          )}
        </FormCard>
      )}

      {/* ── Tab 3: Historial de Programas ── */}
      {activeTab === 'programas' && (
        <FormCard>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest">Bitácora de Programa/Plan</p>
            <Button size="sm" variant="secondary" onClick={() => setShowCambiarPrograma(true)}>
              <ArrowLeftRight size={13} />Cambiar Programa
            </Button>
          </div>
          <MiniTable
            items={historyRows}
            keyFor={row => row.id}
            columns={[
              { key: 'programa', header: 'Programa', render: row => <span className="font-medium text-[#333333]">{row.programa}</span> },
              { key: 'plan', header: 'Plan', render: row => <span className="font-mono text-[12px] text-[#6B7280]">{row.plan}</span> },
              { key: 'desde', header: 'Desde' },
              { key: 'hasta', header: 'Hasta', render: row => (row.hasta === null ? <BadgePill value="Actual" map={actualBadgeMap} /> : row.hasta) },
              { key: 'tipoCambio', header: 'Tipo de Cambio', render: row => TIPO_CAMBIO_LABELS[row.tipoCambio] },
            ]}
          />
        </FormCard>
      )}

      {/* ── Tab 4: Documentos ── */}
      {activeTab === 'documentos' && (
        <FormCard>
          {documents.length === 0 ? (
            <p className="py-10 text-[13px] text-[#6B7280] text-center">Aún no hay documentos registrados en el expediente.</p>
          ) : (
            <MiniTable
              items={documents}
              keyFor={row => row.id}
              columns={[
                {
                  key: 'documentType',
                  header: 'Documento',
                  render: row => <span className="font-medium text-[#333333]">{STUDENT_DOCUMENT_TYPE_LABELS[row.documentType]}</span>,
                },
                { key: 'estado', header: 'Estado', render: row => <BadgePill value={row.receivedAt ? 'ENTREGADO' : 'PENDIENTE'} map={documentoEntregaBadgeMap} /> },
                { key: 'receivedAt', header: 'Fecha Recepción', render: row => (row.receivedAt ?? '—') },
                { key: 'receivedBy', header: 'Registrado por', render: row => (row.receivedBy ?? '—') },
              ]}
            />
          )}
          <p className="mt-4 text-[11px] text-[#6B7280]">
            El registro de entrega física se administra desde Expediente — Documentos Recibidos.
          </p>
        </FormCard>
      )}

      {/* Action zone */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-8">
        <Button variant="secondary" onClick={() => navigate('/inscripciones/estudiantes')}>
          Regresar
        </Button>
      </div>
    </PageContainer>
  )
}
