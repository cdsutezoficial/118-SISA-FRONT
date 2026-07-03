import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  ChevronRight,
  UserCheck,
  GraduationCap,
  History,
  FileText,
  ArrowLeftRight,
} from 'lucide-react'
import { Toast, SearchSelect, SimpleSelect, FieldLabel } from '../../shared/ui'
import { usePendingToast } from '../../shared/hooks'
import { formatDate } from '../../shared/utils'
import {
  mockStudents,
  mockEnrollments,
  mockStudentDocuments,
  mockStudentProgramHistory,
} from '../../shared/inscripciones/mockData'
import {
  STUDENT_STATUS_META,
  STUDENT_DOCUMENT_TYPE_LABELS,
  type Student,
  type EnrollmentType,
  type EnrollmentStatus,
  type ProgramChangeType,
  type StudentProgramHistory,
} from '../../shared/inscripciones/types'

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

// ─── Read-only field ────────────────────────────────────────────────────────

function ReadField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[13px] text-[#333333] ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</p>
    </div>
  )
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
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-md mx-4 p-6">
        <h3 className="text-[15px] font-semibold text-[#333333] mb-1">Cambiar Programa</h3>
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
            <FieldLabel required>Motivo</FieldLabel>
            <SimpleSelect
              options={MOTIVO_OPTIONS.map(m => TIPO_CAMBIO_LABELS[m])}
              value={motivo ? TIPO_CAMBIO_LABELS[motivo] : ''}
              onChange={label => setMotivo(MOTIVO_OPTIONS.find(m => TIPO_CAMBIO_LABELS[m] === label) ?? '')}
              placeholder="Selecciona un motivo"
            />
          </div>
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 mb-6 text-[12px] text-amber-700">
          Este registro es informativo — no dispara ningún flujo de equivalencias entre módulos.
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => canConfirm && onSave({ programa, plan, grupo, motivo: motivo as ProgramChangeType })}
            disabled={!canConfirm}
            className="px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar cambio
          </button>
        </div>
      </div>
    </div>
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
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {showCambiarPrograma && (
        <CambiarProgramaModal
          student={student}
          currentPrograma={currentPrograma}
          onSave={handleCambiarPrograma}
          onCancel={() => setShowCambiarPrograma(false)}
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
        <button onClick={() => navigate('/inscripciones/estudiantes')} className="hover:text-[#009574] transition-colors">
          Estudiantes
        </button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Detalle</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">{student.nombre}</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">Expediente completo del estudiante inscrito.</p>
      </div>

      {/* Summary card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg px-6 py-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          <ReadField label="Matrícula" value={student.matricula} mono />
          <ReadField label="Programa" value={student.programa} />
          <ReadField label="Nivel Actual" value={student.nivelActual} />
          <ReadField label="Grupo" value={student.grupo} />
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
            <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STUDENT_STATUS_META[student.status].badgeClass}`}>
              {STUDENT_STATUS_META[student.status].label}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E5E7EB] mb-6 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-[#009574] text-[#009574]'
                : 'border-transparent text-[#6B7280] hover:text-[#333333] hover:border-[#E5E7EB]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Información General ── */}
      {activeTab === 'info' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
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
        </div>
      )}

      {/* ── Tab 2: Historial Académico ── */}
      {activeTab === 'academico' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
          {enrollments.length === 0 ? (
            <p className="px-8 py-10 text-[13px] text-[#6B7280] text-center">Aún no hay historial académico registrado.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Periodo</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Materia</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Clave</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Créditos</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Grupo</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Tipo</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Estado</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Calif.</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map(row => (
                  <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3 text-[#333333]">{row.periodo}</td>
                    <td className="px-4 py-3 font-medium text-[#333333]">{row.materia}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#6B7280]">{row.clave}</td>
                    <td className="px-4 py-3 text-[#333333]">{row.creditos}</td>
                    <td className="px-4 py-3 text-[#333333]">{row.grupo}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${ENROLLMENT_TYPE_META[row.type].badgeClass}`}>
                        {ENROLLMENT_TYPE_META[row.type].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${ENROLLMENT_STATUS_META[row.status].badgeClass}`}>
                        {ENROLLMENT_STATUS_META[row.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#333333]">{row.calificacionFinal ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab 3: Historial de Programas ── */}
      {activeTab === 'programas' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest">Bitácora de Programa/Plan</p>
            <button
              onClick={() => setShowCambiarPrograma(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
            >
              <ArrowLeftRight size={13} />Cambiar Programa
            </button>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Plan</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Desde</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Hasta</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-40">Tipo de Cambio</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map(row => (
                <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#333333]">{row.programa}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#6B7280]">{row.plan}</td>
                  <td className="px-4 py-3 text-[#333333]">{row.desde}</td>
                  <td className="px-4 py-3">
                    {row.hasta === null ? (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Actual</span>
                    ) : (
                      <span className="text-[#333333]">{row.hasta}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#333333]">{TIPO_CAMBIO_LABELS[row.tipoCambio]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab 4: Documentos ── */}
      {activeTab === 'documentos' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
          {documents.length === 0 ? (
            <p className="px-8 py-10 text-[13px] text-[#6B7280] text-center">Aún no hay documentos registrados en el expediente.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Documento</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Estado</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Fecha Recepción</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(row => (
                  <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3 font-medium text-[#333333]">{STUDENT_DOCUMENT_TYPE_LABELS[row.documentType]}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        row.receivedAt ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {row.receivedAt ? 'Entregado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#333333]">{row.receivedAt ?? '—'}</td>
                    <td className="px-4 py-3 text-[#333333]">{row.receivedBy ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="px-6 py-3 border-t border-[#E5E7EB] bg-[#F8F9FA] text-[11px] text-[#6B7280]">
            El registro de entrega física se administra desde Expediente — Documentos Recibidos.
          </p>
        </div>
      )}

      {/* Action zone */}
      <div className="flex items-center justify-end gap-3 mt-8">
        <button
          onClick={() => navigate('/inscripciones/estudiantes')}
          className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
        >
          Regresar
        </button>
      </div>
    </div>
  )
}
