import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, ChevronDown, ChevronUp, Plus, Pencil } from 'lucide-react'
import { Toast, ActionBtn, SearchSelect, SimpleSelect, DatePicker, Switch, FieldLabel, inputCls } from '../../shared/ui'
import { FileUpload, type UploadedFile } from '../../shared/FileUpload'
import { usePendingToast } from '../../shared/hooks'
import { mockInstitutionalDocuments, mockDocumentAcceptances, mockStudents } from '../../shared/inscripciones/mockData'
import type { InstitutionalDocument, InstitutionalDocumentType, InstitutionalDocumentScope } from '../../shared/inscripciones/types'

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
  PROGRAM: 'Por Programa',
}

// Divisiones/programas catalog — mirrors `DivisionesList.tsx`/`ProgramasList.tsx`
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
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-[15px] font-semibold text-[#333333] mb-4">
          {mode === 'create' ? 'Registrar Documento Institucional' : 'Editar Documento Institucional'}
        </h3>

        <div className="space-y-4 mb-6">
          <div>
            <FieldLabel required>Nombre del documento</FieldLabel>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls(false, false)} placeholder="Ej. Reglamento Escolar 2026" />
          </div>
          <div>
            <FieldLabel>Descripción</FieldLabel>
            <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls(false, false)} placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Tipo</FieldLabel>
              <SimpleSelect
                options={Object.values(DOC_TYPE_LABELS)}
                value={type ? DOC_TYPE_LABELS[type] : ''}
                onChange={label => setType((Object.keys(DOC_TYPE_LABELS) as InstitutionalDocumentType[]).find(k => DOC_TYPE_LABELS[k] === label) ?? '')}
                placeholder="Selecciona un tipo"
              />
            </div>
            <div>
              <FieldLabel required>Versión</FieldLabel>
              <input value={version} onChange={e => setVersion(e.target.value)} className={inputCls(false, false)} placeholder="Ej. v1.0" />
            </div>
          </div>

          <div>
            <FieldLabel required>Alcance</FieldLabel>
            <SimpleSelect options={Object.values(SCOPE_LABELS)} value={SCOPE_LABELS[scope]} onChange={handleScopeChange} placeholder="Selecciona un alcance" />
          </div>

          {scope !== 'GLOBAL' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>División</FieldLabel>
                <SearchSelect options={DIVISIONES_CATALOGO} value={divisionId} onChange={handleDivisionChange} placeholder="Selecciona una división" />
              </div>
              {scope === 'PROGRAM' && (
                <div>
                  <FieldLabel required>Programa</FieldLabel>
                  <SearchSelect
                    options={programOptions}
                    value={programId}
                    onChange={setProgramId}
                    placeholder={divisionId ? 'Selecciona un programa' : 'Selecciona una división primero'}
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

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Guardar documento
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function DocumentosInstitucionales() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [documents, setDocuments] = useState<InstitutionalDocument[]>(mockInstitutionalDocuments)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; doc?: InstitutionalDocument } | null>(null)

  function handleToggleStatus(id: string) {
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, status: d.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : d)))
  }

  function handleSaveDocument(doc: InstitutionalDocument) {
    setDocuments(prev => (prev.some(d => d.id === doc.id) ? prev.map(d => (d.id === doc.id ? doc : d)) : [...prev, doc]))
    setToast(modal?.mode === 'create' ? 'Documento registrado correctamente.' : 'Documento actualizado correctamente.')
    setModal(null)
  }

  function scopeDisplay(doc: InstitutionalDocument): string {
    if (doc.scope === 'GLOBAL') return 'Global'
    if (doc.scope === 'DIVISION') return `División: ${doc.divisionId}`
    return `Programa: ${doc.programId}`
  }

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {modal && <DocumentoModal mode={modal.mode} initial={modal.doc} onSave={handleSaveDocument} onCancel={() => setModal(null)} />}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/inscripciones')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Inscripciones</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Documentos Institucionales</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Documentos Institucionales</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Gestiona los reglamentos y avisos que los estudiantes deben aceptar al inscribirse.</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors whitespace-nowrap mt-1"
        >
          <Plus size={15} />Registrar Documento
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Documento</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-36">Tipo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-56">Alcance</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Versión</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Aceptaciones</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-36">Estado</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {documents.map(doc => (
              <Fragment key={doc.id}>
                <tr className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#333333]">{doc.name}</p>
                    {doc.description && <p className="text-[12px] text-[#6B7280]">{doc.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-[#333333]">{DOC_TYPE_LABELS[doc.type]}</td>
                  <td className="px-4 py-3 text-[#333333]">{scopeDisplay(doc)}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#6B7280]">{doc.version}</td>
                  <td className="px-4 py-3 text-[#333333]">{doc.aceptaciones.toLocaleString('es-MX')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={doc.status === 'ACTIVE'} onChange={() => handleToggleStatus(doc.id)} />
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        doc.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {doc.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <ActionBtn
                        icon={expandedId === doc.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        tooltip="Ver aceptaciones"
                        onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                      />
                      <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => setModal({ mode: 'edit', doc })} />
                    </div>
                  </td>
                </tr>
                {expandedId === doc.id && (
                  <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                    <td colSpan={7} className="p-0">
                      <AcceptanceList documentId={doc.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
