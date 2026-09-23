import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Pencil } from 'lucide-react'
import { Toast, SearchSelect, DatePicker, Switch, FieldLabel, Modal } from '@app/core/components/ui'
import { Button, TextField, SelectField } from '@app/core/components/form'
import { FileUpload, type UploadedFile } from '@app/core/components/FileUpload'
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  DataTable,
  MobileCards,
  BadgePill,
  type ColumnDef,
} from '@app/core/components/list'
import { usePendingToast } from '@app/core/infra/hooks'
import { mockInstitutionalDocuments, mockDocumentAcceptances, mockStudents } from '../data/mockData'
import type { InstitutionalDocument, InstitutionalDocumentType, InstitutionalDocumentScope } from '../data/types'

// ─── Local labels/catalogs (page-scoped, follow the module's established
// "duplicate small catalogs inline" convention — see design.md) ────────────

const DOC_TYPE_LABELS: Record<InstitutionalDocumentType, string> = {
  REGLAMENTO: 'Reglamento',
  TERMINOS_CONDICIONES: 'Términos y Condiciones',
  AVISO_PRIVACIDAD: 'Aviso de Privacidad',
  OTHER: 'Otro',
}

const SCOPE_LABELS: Record<InstitutionalDocumentScope, string> = {
  GLOBAL: 'Global',
  DIVISION: 'Por División',
  PROGRAM: 'Por Carrera',
}

// Divisiones/carreras catalog — mirrors `DivisionesList.tsx`/`CarrerasList.tsx`
// division names; "División de Ciencias de la Salud" has no student-facing
// program elsewhere in this module yet, so it carries one token program here.
const DIVISIONES_CATALOGO = [
  'División de Tecnologías de la Información',
  'División de Ciencias Económico Administrativas',
  'División de Ciencias de la Salud',
  'División de Ingeniería',
]

const PROGRAMAS_POR_DIVISION: Record<string, string[]> = {
  'División de Tecnologías de la Información': ['Ingeniería en Desarrollo y Gestión de Software', 'Ingeniería en Redes y Telecomunicaciones'],
  'División de Ciencias Económico Administrativas': ['Licenciatura en Administración'],
  'División de Ciencias de la Salud': ['Licenciatura en Enfermería'],
  'División de Ingeniería': ['Ingeniería Industrial'],
}

// ─── Inline acceptance list — Screen 6's "view acceptance list without
// leaving the list" requirement; reads `mockDocumentAcceptances` (per-student
// rows with an `items[]` of accepted document ids) instead of a per-document
// aggregate, since that's how the domain models `DocumentAcceptance`. ──────

function AcceptanceList({ documentId }: { documentId: string }) {
  const rows = mockDocumentAcceptances
    .filter(da => da.items.some(item => item.documentId === documentId))
    .map(da => ({
      id: da.id,
      name: mockStudents.find(s => s.id === da.studentId)?.nombre ?? da.studentId,
      acceptedAt: da.acceptedAt,
    }))

  if (rows.length === 0) {
    return <p className="px-6 py-4 text-[12px] text-[#6B7280]">Sin aceptaciones registradas todavía.</p>
  }

  return (
    <div className="px-6 py-4">
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
        Estudiantes que aceptaron ({rows.length})
      </p>
      <ul className="space-y-1">
        {rows.map(r => (
          <li key={r.id} className="flex items-center justify-between text-[13px] text-[#333333] px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-md">
            <span>{r.name}</span>
            <span className="text-[12px] text-[#6B7280]">{r.acceptedAt}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Register/Edit modal — scope field-gating per spec: División required
// for DIVISION/PROGRAM, Programa required (and dependent on División) only
// for PROGRAM, both hidden for GLOBAL. ──────────────────────────────────────

function DocumentoModal({ mode, initial, onSave, onCancel }: {
  mode: 'create' | 'edit'
  initial?: InstitutionalDocument
  onSave: (doc: InstitutionalDocument) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [type, setType] = useState<InstitutionalDocumentType | ''>(initial?.type ?? '')
  const [scope, setScope] = useState<InstitutionalDocumentScope>(initial?.scope ?? 'GLOBAL')
  const [divisionId, setDivisionId] = useState(initial?.divisionId ?? '')
  const [programId, setProgramId] = useState(initial?.programId ?? '')
  const [version, setVersion] = useState(initial?.version ?? '')
  const [vigenteDesde, setVigenteDesde] = useState(initial?.vigenteDesde ?? '')
  const [file, setFile] = useState<UploadedFile | null>(
    initial ? { name: initial.driveUrl.split('/').pop() ?? initial.name, size: 0, status: 'done' } : null,
  )

  const programOptions = divisionId ? (PROGRAMAS_POR_DIVISION[divisionId] ?? []) : []

  function handleScopeChange(label: string) {
    const next = (Object.keys(SCOPE_LABELS) as InstitutionalDocumentScope[]).find(k => SCOPE_LABELS[k] === label) ?? 'GLOBAL'
    setScope(next)
    if (next === 'GLOBAL') setDivisionId('')
    if (next !== 'PROGRAM') setProgramId('')
  }

  function handleDivisionChange(value: string) {
    setDivisionId(value)
    setProgramId('') // reset dependent field when División changes
  }

  const canSave =
    !!name.trim() &&
    !!type &&
    !!version.trim() &&
    !!vigenteDesde &&
    (scope === 'GLOBAL' || !!divisionId) &&
    (scope !== 'PROGRAM' || !!programId) &&
    (mode === 'edit' || (!!file && file.status === 'done'))

  function handleSave() {
    if (!canSave || !type) return
    onSave({
      id: initial?.id ?? `doc-local-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || null,
      driveUrl: initial?.driveUrl ?? `https://drive.google.com/mock-upload/${file?.name ?? 'documento.pdf'}`,
      type,
      scope,
      divisionId: scope === 'GLOBAL' ? null : divisionId,
      programId: scope === 'PROGRAM' ? programId : null,
      periodId: initial?.periodId ?? null,
      status: initial?.status ?? 'ACTIVE',
      version: version.trim(),
      vigenteDesde,
      aceptaciones: initial?.aceptaciones ?? 0,
    })
  }

  return (
    <Modal
      title={mode === 'create' ? 'Registrar Documento Institucional' : 'Editar Documento Institucional'}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Guardar documento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Nombre del documento" required value={name} onChange={setName} placeholder="Ej. Reglamento Escolar 2026" />
        <TextField label="Descripción" value={description} onChange={setDescription} placeholder="Opcional" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <SelectField
            label="Tipo"
            required
            options={Object.values(DOC_TYPE_LABELS).map(l => ({ value: l, label: l }))}
            value={type ? DOC_TYPE_LABELS[type] : ''}
            onChange={label => setType((Object.keys(DOC_TYPE_LABELS) as InstitutionalDocumentType[]).find(k => DOC_TYPE_LABELS[k] === label) ?? '')}
            placeholder="Selecciona un tipo"
          />
          </div>
          <div>
            <TextField label="Versión" required value={version} onChange={setVersion} placeholder="Ej. v1.0" />
          </div>
        </div>

        <div>
          <SelectField
          label="Alcance"
          required
          options={Object.values(SCOPE_LABELS).map(l => ({ value: l, label: l }))}
          value={SCOPE_LABELS[scope]}
          onChange={handleScopeChange}
          placeholder="Selecciona un alcance"
        />
        </div>

        {scope !== 'GLOBAL' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>División</FieldLabel>
              <SearchSelect options={DIVISIONES_CATALOGO} value={divisionId} onChange={handleDivisionChange} placeholder="Selecciona una división" />
            </div>
            {scope === 'PROGRAM' && (
              <div>
                <FieldLabel required>Carrera</FieldLabel>
                <SearchSelect
                  options={programOptions}
                  value={programId}
                  onChange={setProgramId}
                  placeholder={divisionId ? 'Selecciona una carrera' : 'Selecciona una división primero'}
                  disabled={!divisionId}
                />
              </div>
            )}
          </div>
        )}

        <div>
          <FieldLabel required>Vigente desde</FieldLabel>
          <DatePicker value={vigenteDesde} onChange={setVigenteDesde} />
        </div>

        <FileUpload label="Documento (PDF)" accept=".pdf" required={mode === 'create'} value={file} onChange={setFile} />
      </div>
    </Modal>
  )
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function DocumentosInstitucionales() {
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [documents, setDocuments] = useState<InstitutionalDocument[]>(mockInstitutionalDocuments)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; doc?: InstitutionalDocument } | null>(null)

  function handleToggleStatus(id: string) {
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, status: d.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : d)))
  }

  function handleToggleRowStatus(doc: InstitutionalDocument) {
    handleToggleStatus(doc.id)
  }

  function handleSaveDocument(doc: InstitutionalDocument) {
    setDocuments(prev => (prev.some(d => d.id === doc.id) ? prev.map(d => (d.id === doc.id ? doc : d)) : [...prev, doc]))
    setToast(modal?.mode === 'create' ? 'Documento registrado correctamente.' : 'Documento actualizado correctamente.')
    setModal(null)
  }

  function scopeDisplay(doc: InstitutionalDocument): string {
    if (doc.scope === 'GLOBAL') return 'Global'
    if (doc.scope === 'DIVISION') return `División: ${doc.divisionId}`
    return `Carrera: ${doc.programId}`
  }

  const columns: ColumnDef<InstitutionalDocument>[] = [
    { key: 'name', header: 'Documento', type: 'name', sub: d => d.description ?? '' },
    { key: 'type', header: 'Tipo', type: 'text', value: d => DOC_TYPE_LABELS[d.type], className: 'w-36' },
    { key: 'scope', header: 'Alcance', type: 'text', value: scopeDisplay, className: 'w-56' },
    { key: 'version', header: 'Versión', render: d => <span className="font-mono text-[12px] text-[#6B7280]">{d.version}</span>, className: 'w-24' },
    { key: 'aceptaciones', header: 'Aceptaciones', type: 'count', value: d => d.aceptaciones.toLocaleString('es-MX'), className: 'w-24' },
    { key: 'status', header: 'Estado', type: 'status', className: 'w-36', activeLabel: 'Activo', inactiveLabel: 'Inactivo' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {modal && <DocumentoModal mode={modal.mode} initial={modal.doc} onSave={handleSaveDocument} onCancel={() => setModal(null)} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Inscripciones', to: '/inscripciones' },
          { label: 'Documentos Institucionales' },
        ]}
      />

      <PageHeader
        title="Documentos Institucionales"
        subtitle="Gestiona los reglamentos y avisos que los estudiantes deben aceptar al inscribirse."
        actions={[{ label: 'Registrar Documento', icon: <Plus size={15} />, onClick: () => setModal({ mode: 'create' })}]}
      />

      {/* Tabla desktop (md+) */}
      <DataTable
        columns={columns}
        status="idle"
        items={documents}
        keyFor={d => d.id}
        loadingLabel="Cargando documentos..."
        emptyTitle="Sin documentos registrados"
        emptyHint="Registra un documento institucional para comenzar."
        onToggleStatus={handleToggleRowStatus}
        actions={{ edit: row => setModal({ mode: 'edit', doc: row }), editTooltip: 'Editar' }}
        detail={{
          expandedId,
          onExpand: setExpandedId,
          tooltip: 'Ver aceptaciones',
          render: doc => <AcceptanceList documentId={doc.id} />,
        }}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status="idle"
        items={documents}
        keyFor={d => d.id}
        renderItem={doc => (
          <>
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="font-medium text-[13px] text-[#333333]">{doc.name}</span>
              <BadgePill value={doc.status} active={doc.status === 'ACTIVE'} activeLabel="Activo" inactiveLabel="Inactivo" />
            </div>
            {doc.description && <p className="text-[12px] text-[#6B7280] mb-1">{doc.description}</p>}
            <p className="text-[12px] text-[#6B7280] mb-1">{DOC_TYPE_LABELS[doc.type]} · {scopeDisplay(doc)}</p>
            <p className="text-[12px] text-[#6B7280] mb-1">Versión {doc.version}</p>
            <p className="text-[12px] text-[#6B7280] mb-3">{doc.aceptaciones.toLocaleString('es-MX')} aceptaciones</p>
            <div className="flex items-center gap-2 mb-3">
              <Switch checked={doc.status === 'ACTIVE'} onChange={() => handleToggleStatus(doc.id)} />
              <span className="text-[12px] text-[#6B7280]">{doc.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <Button variant="outline" size="sm" onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}>
                {expandedId === doc.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}Aceptaciones
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setModal({ mode: 'edit', doc })}>
                <Pencil size={13} />Editar
              </Button>
            </div>
            {expandedId === doc.id && (
              <div className="mt-3 border-t border-[#E5E7EB] pt-1">
                <AcceptanceList documentId={doc.id} />
              </div>
            )}
          </>
        )}
        loadingLabel="Cargando documentos..."
        emptyTitle="Sin documentos registrados"
        emptyHint="Registra un documento institucional para comenzar."
      />
    </PageContainer>
  )
}