import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { Toast, ActionBtn } from '@app/core/components/ui'
import { Button } from '@app/core/components/form'
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  DataTable,
  MobileCards,
  BadgePill,
  type ColumnDef,
  type BadgeStyle,
} from '@app/core/components/list'
import { usePendingToast } from '@app/core/infra/hooks'
import { formatDate } from '@app/core/infra/utils'
import { useRole } from '@app/core/infra/RoleContext'
import { mockStudents, mockStudentDocuments } from '../data/mockData'
import { STUDENT_DOCUMENT_TYPE_LABELS, type Student, type StudentDocument, type StudentDocumentType } from '../data/types'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@app/core/ui/sheet'

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

// ─── Badge maps (para BadgePill core) ────────────────────────────────────────

const expedienteBadgeMap: Record<string, BadgeStyle> = {
  COMPLETO: { label: 'Completo', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  INCOMPLETO: { label: 'Incompleto', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
}

const entregadoBadgeMap: Record<string, BadgeStyle> = {
  ENTREGADO: { label: 'Entregado', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
}

export default function ExpedienteRecibidos() {
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

  const columns: ColumnDef<Student>[] = [
    { key: 'matricula', header: 'Matrícula', type: 'code', className: 'w-28' },
    { key: 'nombre', header: 'Nombre Completo', type: 'name' },
    { key: 'programa', header: 'Carrera', type: 'text' },
    {
      key: 'progreso',
      header: 'Documentos Entregados',
      render: row => {
        const { delivered, total } = progressFor(row.id)
        const completo = delivered === total
        const pct = total === 0 ? 0 : Math.round((delivered / total) * 100)
        return (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${completo ? 'bg-emerald-500' : 'bg-[#009574]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[12px] text-[#6B7280] font-medium whitespace-nowrap">{delivered} / {total}</span>
          </div>
        )
      },
    },
    {
      key: 'estado',
      header: 'Estado Expediente',
      render: row => {
        const { delivered, total } = progressFor(row.id)
        return <BadgePill value={delivered === total ? 'COMPLETO' : 'INCOMPLETO'} map={expedienteBadgeMap} />
      },
    },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Inscripciones', to: '/inscripciones' },
          { label: 'Documentos Recibidos' },
        ]}
      />

      <PageHeader
        title="Expediente — Documentos Recibidos"
        subtitle="Da seguimiento a la entrega física de los documentos del expediente de cada estudiante."
      />

      {/* Tabla desktop (md+) */}
      <DataTable
        columns={columns}
        status="idle"
        items={mockStudents}
        keyFor={row => row.id}
        loadingLabel="Cargando expedientes..."
        emptyTitle="Sin expedientes registrados"
        emptyHint="Los expedientes de los estudiantes aparecerán aquí."
        actions={
          {
            extraFirst: row => (
              <ActionBtn icon={<FolderOpen size={15} />} tooltip="Ver expediente" onClick={() => setPanelStudentId(row.id)} />
            ),
          }
        }
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status="idle"
        items={mockStudents}
        keyFor={row => row.id}
        renderItem={row => {
          const { delivered, total } = progressFor(row.id)
          const completo = delivered === total
          const pct = total === 0 ? 0 : Math.round((delivered / total) * 100)
          return (
            <>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-medium text-[13px] text-[#333333]">{row.nombre}</span>
                <BadgePill value={completo ? 'COMPLETO' : 'INCOMPLETO'} map={expedienteBadgeMap} />
              </div>
              <p className="font-mono text-[11px] text-[#6B7280] mb-1">{row.matricula}</p>
              <p className="text-[12px] text-[#6B7280] mb-3">{row.programa}</p>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-full max-w-[160px] h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${completo ? 'bg-emerald-500' : 'bg-[#009574]'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[12px] text-[#6B7280] font-medium whitespace-nowrap">{delivered} / {total}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E7EB]">
                <Button variant="outline" size="sm" onClick={() => setPanelStudentId(row.id)}>
                  <FolderOpen size={13} />Ver expediente
                </Button>
              </div>
            </>
          )
        }}
        loadingLabel="Cargando expedientes..."
        emptyTitle="Sin expedientes registrados"
        emptyHint="Los expedientes de los estudiantes aparecerán aquí."
      />

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
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[#6B7280] font-medium">{delivered} / {total}</span>
                        <BadgePill value={completo ? 'COMPLETO' : 'INCOMPLETO'} map={expedienteBadgeMap} />
                      </div>
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
                      <BadgePill value="ENTREGADO" map={entregadoBadgeMap} />
                    ) : (
                      <Button size="sm" onClick={() => handleMarkDelivered(panelStudent.id, doc.documentType)}>
                        Marcar entregado
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageContainer>
  )
}