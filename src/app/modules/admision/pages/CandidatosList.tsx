import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Plus as PlusIcon, CreditCard, Receipt, ClipboardCheck, GraduationCap, ArrowLeftRight, Eye as EyeIcon } from 'lucide-react'
import { Toast, ActionBtn, SearchSelect } from '@app/core/components/ui'
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  SearchInput,
  FilterBar,
  FilterSelect,
  ResultCount,
  Pagination,
  MobilePagination,
  DataTable,
  MobileCards,
  BadgePill,
  type ColumnDef,
  type BadgeStyle,
} from '@app/core/components/list'
import { usePendingToast } from '@app/core/infra/hooks'
import { mockCandidates } from '../data/mockData'
import { STATUS_META, isAdmisionActionEnabled, type Candidate, type CandidateStatus } from '../data/types'

// ─── Estado filter (corrected per `03-admision.md` — Corrección Pantalla 3) ───
// Uses the same 6 domain statuses + "Todos"; option labels/badges are sourced
// from STATUS_META so the filter and the row badges never drift out of sync.

const STATUS_ORDER: CandidateStatus[] = ['REGISTERED', 'PAID', 'EXAM_TAKEN', 'ACCEPTED', 'REJECTED', 'ENROLLED']
const estadoOptions = STATUS_ORDER.map(s => ({ value: s, label: STATUS_META[s].label }))
const statusBadgeMap: Record<string, BadgeStyle> = Object.fromEntries(
  STATUS_ORDER.map(s => [s, { label: STATUS_META[s].label, className: STATUS_META[s].badgeClass }]),
)

const perPage = 10

// ─── Cambiar Programa — inline modal, not a navigation ────────────────────────
// Per the nav-supplement prompt: "FLUJO: Cambio de Programa ... Modal inline
// con Select del nuevo programa + advertencia de cupo (no navega a otra
// pantalla)." Mirrors `CanalesDifusion.tsx`'s inline-modal convention.

function CambiarProgramaModal({ candidate, programas, onSave, onCancel }: {
  candidate: Candidate
  programas: string[]
  onSave: (nuevoPrograma: string) => void
  onCancel: () => void
}) {
  const opciones = programas.filter(p => p !== candidate.programa)
  const [nuevoPrograma, setNuevoPrograma] = useState(opciones[0] ?? '')

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-md mx-4 p-6">
        <h3 className="text-[15px] font-semibold text-[#333333] mb-1">Cambiar Programa</h3>
        <p className="text-[13px] text-[#6B7280] mb-4">
          Candidato: <strong className="text-[#333333]">{candidate.nombre}</strong> · Programa actual:{' '}
          <strong className="text-[#333333]">{candidate.programa}</strong>
        </p>

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-[#333333] mb-1">Nuevo Programa</label>
          <SearchSelect
            options={opciones}
            value={nuevoPrograma}
            onChange={setNuevoPrograma}
            placeholder="Selecciona un programa"
          />
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 mb-6 text-[12px] text-amber-700">
          Verifica que el nuevo programa cuente con cupo disponible en el periodo activo antes de confirmar el cambio.
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => nuevoPrograma && onSave(nuevoPrograma)}
            disabled={!nuevoPrograma}
            className="px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cambiar Programa
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Screen ────────────────────────────────────────────────────────────────────

/** Botón etiquetado del footer de la tarjeta móvil (mismo estilo que UsuariosList). */
function CardActionButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
    >
      {icon}{label}
    </button>
  )
}

export default function CandidatosList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates)
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [programaFilter, setProgramaFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [page, setPage] = useState(1)
  const [cambiarProgramaTarget, setCambiarProgramaTarget] = useState<Candidate | null>(null)

  const programas = Array.from(new Set(mockCandidates.map(c => c.programa)))

  const filtered = candidates.filter(c => {
    const matchPrograma = !programaFilter || c.programa === programaFilter
    const matchEstado = !estadoFilter || c.status === estadoFilter
    const q = search.trim().toLowerCase()
    const matchSearch =
      !q ||
      c.nombre.toLowerCase().includes(q) ||
      c.curp.toLowerCase().includes(q) ||
      c.folio.toLowerCase().includes(q)
    return matchPrograma && matchEstado && matchSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage)

  function handleCambiarPrograma(nuevoPrograma: string) {
    if (!cambiarProgramaTarget) return
    const targetId = cambiarProgramaTarget.id
    const nombre = cambiarProgramaTarget.nombre
    setCandidates(prev => prev.map(c => (c.id === targetId ? { ...c, programa: nuevoPrograma } : c)))
    setCambiarProgramaTarget(null)
    setToast(`Programa actualizado para ${nombre}.`)
  }

  const columns: ColumnDef<Candidate>[] = [
    { key: 'folio', header: 'Folio', type: 'code', className: 'w-32' },
    { key: 'nombre', header: 'Nombre Completo', type: 'name' },
    { key: 'programa', header: 'Programa Solicitado', type: 'text' },
    { key: 'status', header: 'Estado', type: 'badge', badge: statusBadgeMap, className: 'w-28' },
    { key: 'fechaRegistro', header: 'Fecha de Registro', type: 'muted', className: 'w-24' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {cambiarProgramaTarget && (
        <CambiarProgramaModal
          candidate={cambiarProgramaTarget}
          programas={programas}
          onSave={handleCambiarPrograma}
          onCancel={() => setCambiarProgramaTarget(null)}
        />
      )}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Admisión', to: '/admision' },
          { label: 'Candidatos' },
        ]}
      />

      <PageHeader
        title="Candidatos"
        subtitle="Seguimiento de todos los aspirantes del periodo de admisión activo."
        actions={[{ label: 'Registrar Candidato', icon: <PlusIcon />, onClick: () => navigate('/admision/candidatos/registrar') }]}
      />

      <FilterBar>
        <FilterSelect
          value={programaFilter}
          onChange={v => { setProgramaFilter(v); setPage(1) }}
          allLabel="Todos los programas"
          className="w-full sm:w-64"
          options={programas.map(p => ({ value: p, label: p }))}
        />
        <FilterSelect
          value={estadoFilter}
          onChange={v => { setEstadoFilter(v); setPage(1) }}
          allLabel="Todos los estados"
          options={estadoOptions}
        />
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Buscar por nombre, CURP o folio..."
        />
        <ResultCount count={filtered.length} />
      </FilterBar>

      {/* Tabla desktop (md+) */}
      <DataTable
        columns={columns}
        status="idle"
        items={pageItems}
        keyFor={row => row.id}
        numbered
        loadingLabel="Cargando candidatos..."
        emptyTitle="No se encontraron candidatos"
        emptyHint="Intenta ajustar los filtros de búsqueda"
        footer={<Pagination page={page} totalPages={totalPages} totalElements={filtered.length} perPage={perPage} onPageChange={setPage} />}
        actions={{
          view: row => navigate(`/admision/candidatos/detalle?id=${row.id}`),
          viewTooltip: 'Ver detalle',
          extra: row => (
            <>
              {isAdmisionActionEnabled(row, 'CONFIRMAR_PAGO_FICHA') && (
                <ActionBtn
                  icon={<CreditCard size={15} />}
                  tooltip="Confirmar Pago Ficha"
                  onClick={() => navigate(`/admision/candidatos/pago-ficha?id=${row.id}`)}
                />
              )}
              {isAdmisionActionEnabled(row, 'CONFIRMAR_PAGO_INDUCCION') && (
                <ActionBtn
                  icon={<Receipt size={15} />}
                  tooltip="Confirmar Pago Inducción"
                  onClick={() => navigate(`/admision/candidatos/pago-induccion?id=${row.id}`)}
                />
              )}
              {isAdmisionActionEnabled(row, 'REGISTRAR_EXAMEN') && (
                <ActionBtn
                  icon={<ClipboardCheck size={15} />}
                  tooltip="Registrar Examen"
                  onClick={() => navigate(`/admision/candidatos/examen?id=${row.id}`)}
                />
              )}
              {isAdmisionActionEnabled(row, 'REGISTRAR_INDUCCION') && (
                <ActionBtn
                  icon={<GraduationCap size={15} />}
                  tooltip="Registrar Inducción"
                  onClick={() => navigate(`/admision/candidatos/induccion?id=${row.id}`)}
                />
              )}
              {isAdmisionActionEnabled(row, 'CAMBIAR_PROGRAMA') && (
                <ActionBtn
                  icon={<ArrowLeftRight size={15} />}
                  tooltip="Cambiar Programa"
                  onClick={() => setCambiarProgramaTarget(row)}
                />
              )}
            </>
          ),
        }}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status="idle"
        items={pageItems}
        keyFor={row => row.id}
        renderItem={row => (
          <>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-medium text-[13px] text-[#333333]">{row.nombre}</span>
              <BadgePill value={row.status} map={statusBadgeMap} />
            </div>
            <p className="font-mono text-[11px] text-[#6B7280] mb-1">Folio: {row.folio}</p>
            <p className="text-[12px] text-[#6B7280] mb-1">{row.programa}</p>
            <p className="text-[12px] text-[#6B7280] mb-3">{row.fechaRegistro}</p>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <CardActionButton
                icon={<EyeIcon size={13} />}
                label="Ver detalle"
                onClick={() => navigate(`/admision/candidatos/detalle?id=${row.id}`)}
              />
              {isAdmisionActionEnabled(row, 'CONFIRMAR_PAGO_FICHA') && (
                <CardActionButton icon={<CreditCard size={13} />} label="Pago Ficha" onClick={() => navigate(`/admision/candidatos/pago-ficha?id=${row.id}`)} />
              )}
              {isAdmisionActionEnabled(row, 'CONFIRMAR_PAGO_INDUCCION') && (
                <CardActionButton icon={<Receipt size={13} />} label="Pago Inducción" onClick={() => navigate(`/admision/candidatos/pago-induccion?id=${row.id}`)} />
              )}
              {isAdmisionActionEnabled(row, 'REGISTRAR_EXAMEN') && (
                <CardActionButton icon={<ClipboardCheck size={13} />} label="Registrar Examen" onClick={() => navigate(`/admision/candidatos/examen?id=${row.id}`)} />
              )}
              {isAdmisionActionEnabled(row, 'REGISTRAR_INDUCCION') && (
                <CardActionButton icon={<GraduationCap size={13} />} label="Registrar Inducción" onClick={() => navigate(`/admision/candidatos/induccion?id=${row.id}`)} />
              )}
              {isAdmisionActionEnabled(row, 'CAMBIAR_PROGRAMA') && (
                <CardActionButton icon={<ArrowLeftRight size={13} />} label="Cambiar Programa" onClick={() => setCambiarProgramaTarget(row)} />
              )}
            </div>
          </>
        )}
        loadingLabel="Cargando candidatos..."
        emptyTitle="No se encontraron candidatos"
        emptyHint="Intenta ajustar los filtros de búsqueda"
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={filtered.length} perPage={perPage} onPageChange={setPage} />}
      />
    </PageContainer>
  )
}