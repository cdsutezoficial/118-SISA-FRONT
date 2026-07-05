import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, FolderOpen } from 'lucide-react'
import { Toast, ActionBtn } from '../../shared/ui'
import { usePendingToast } from '../../shared/hooks'
import { formatDate } from '../../shared/utils'
import { useRole } from '../../shared/RoleContext'
import { mockStudents, mockStudentDocuments } from '../../shared/inscripciones/mockData'
import { STUDENT_DOCUMENT_TYPE_LABELS, type StudentDocument, type StudentDocumentType } from '../../shared/inscripciones/types'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../components/ui/sheet'

// ─── The expediente checklist is exactly these 5 physical documents (`OTHER`
// is a catch-all type, not part of the fixed required set) — every student in
// `mockStudentDocuments` is seeded with one row per type, so "N / 5" and the
// Completo/Incompleto badge are always well-defined (never a vacuous 0/0). ──
const REQUIRED_DOCUMENT_TYPES: StudentDocumentType[] = [
  'ACTA_NACIMIENTO',
  'CURP',
  'CERTIFICADO_BACHILLERATO',
  'FOTOGRAFIA',
  'COMPROBANTE_DOMICILIO',
]

export default function ExpedienteRecibidos() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const { user } = useRole()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [documents, setDocuments] = useState<StudentDocument[]>(mockStudentDocuments)
  const [panelStudentId, setPanelStudentId] = useState<string | null>(null)

  function docsFor(studentId: string): StudentDocument[] {
    return REQUIRED_DOCUMENT_TYPES.map(
      type => documents.find(d => d.studentId === studentId && d.documentType === type) ?? { id: `${studentId}-${type}`, studentId, documentType: type, receivedAt: null, receivedBy: null },
    )
  }

  function progressFor(studentId: string): { delivered: number; total: number } {
    const docs = docsFor(studentId)
    return { delivered: docs.filter(d => d.receivedAt).length, total: docs.length }
  }

  // Marking delivery only ever touches `documents` (the `StudentDocument[]`
  // state) — `mockStudents`/`Student.status` is never written here, per spec
  // ("marking delivered MUST NOT alter Student.status").
  function handleMarkDelivered(studentId: string, documentType: StudentDocumentType) {
    setDocuments(prev =>
      prev.map(d =>
        d.studentId === studentId && d.documentType === documentType
          ? { ...d, receivedAt: formatDate(new Date()), receivedBy: user?.name ?? 'Personal de Servicios Escolares' }
          : d,
      ),
    )
    setToast('Documento marcado como entregado.')
  }

  const panelStudent = panelStudentId ? mockStudents.find(s => s.id === panelStudentId) ?? null : null

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/inscripciones')} className="hover:text-[#009574] transition-colors">
          Inicio
        </button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Inscripciones</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Expediente</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Expediente — Documentos Recibidos</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Da seguimiento a la entrega física de los documentos del expediente de cada estudiante.
        </p>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Matrícula</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nombre Completo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-48">Documentos Entregados</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Estado Expediente</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {mockStudents.map(row => {
              const { delivered, total } = progressFor(row.id)
              const completo = delivered === total
              const pct = total === 0 ? 0 : Math.round((delivered / total) * 100)
              return (
                <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                  <td className="px-4 py-3 font-mono text-[12px] text-[#6B7280]">{row.matricula}</td>
                  <td className="px-4 py-3 font-medium text-[#333333]">{row.nombre}</td>
                  <td className="px-4 py-3 text-[#333333]">{row.programa}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${completo ? 'bg-emerald-500' : 'bg-[#009574]'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[12px] text-[#6B7280] font-medium whitespace-nowrap">{delivered} / {total}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        completo
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {completo ? 'Completo' : 'Incompleto'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ActionBtn
                      icon={<FolderOpen size={15} />}
                      tooltip="Ver expediente"
                      onClick={() => setPanelStudentId(row.id)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Inline right side-panel checklist — opens on row select, no
          navigation to a separate page, per spec. ── */}
      <Sheet open={panelStudent !== null} onOpenChange={open => !open && setPanelStudentId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {panelStudent && (
            <>
              <SheetHeader>
                <SheetTitle>{panelStudent.nombre}</SheetTitle>
                <SheetDescription>
                  {panelStudent.matricula} · {panelStudent.programa}
                </SheetDescription>
              </SheetHeader>

              <div className="px-4 pb-4 flex flex-col gap-2 overflow-y-auto">
                {(() => {
                  const { delivered, total } = progressFor(panelStudent.id)
                  const completo = delivered === total
                  return (
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[13px] font-medium text-[#333333]">Progreso del expediente</span>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          completo
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        {delivered} / {total} — {completo ? 'Completo' : 'Incompleto'}
                      </span>
                    </div>
                  )
                })()}

                {docsFor(panelStudent.id).map(doc => (
                  <div
                    key={doc.documentType}
                    className="flex items-center justify-between px-3 py-2.5 border border-[#E5E7EB] rounded-md"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-[#333333]">{STUDENT_DOCUMENT_TYPE_LABELS[doc.documentType]}</p>
                      {doc.receivedAt ? (
                        <p className="text-[11px] text-[#6B7280]">Recibido {doc.receivedAt} · {doc.receivedBy}</p>
                      ) : (
                        <p className="text-[11px] text-[#6B7280]">Pendiente de entrega</p>
                      )}
                    </div>
                    {doc.receivedAt ? (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                        Entregado
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarkDelivered(panelStudent.id, doc.documentType)}
                        className="text-[12px] font-semibold px-3 py-1.5 rounded-md bg-[#009574] hover:bg-[#007a5e] text-white transition-colors whitespace-nowrap"
                      >
                        Marcar entregado
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
