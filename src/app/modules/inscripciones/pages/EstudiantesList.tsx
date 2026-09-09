import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus as PlusIcon, ArrowLeftRight, BookOpen, Eye as EyeIcon } from 'lucide-react'
import { Toast, ActionBtn } from '@app/core/components/ui'
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
import { mockStudents } from '../data/mockData'
import { STUDENT_STATUS_META, type Student, type StudentStatus } from '../data/types'

// ─── Estado filter — same 7 domain statuses + "Todos", labels/badges sourced ──
// from STUDENT_STATUS_META so the filter and the row badges never drift apart.

const STATUS_ORDER: StudentStatus[] = ['PENDING', 'ACTIVE', 'PRE_LOW', 'TEMPORARY_LOW', 'LOW', 'GRADUATED', 'TITLED']
const estadoOptions = STATUS_ORDER.map(s => ({ value: s, label: STUDENT_STATUS_META[s].label }))
const statusBadgeMap: Record<string, BadgeStyle> = Object.fromEntries(
  STATUS_ORDER.map(s => [s, { label: STUDENT_STATUS_META[s].label, className: STUDENT_STATUS_META[s].badgeClass }]),
)

// Kardex lives in Módulo 05 (Calificaciones), not built yet in this frontend
// slice — the action is visible (per the Figma nav prompt) but disabled with
// an explanatory tooltip instead of navigating to a dead route.
const KARDEX_TOOLTIP = 'Kardex — disponible cuando se implemente el Módulo de Calificaciones'

const perPage = 10

const programaOptions = Array.from(new Set(mockStudents.map(s => s.programa)))
const nivelOptions = Array.from(new Set(mockStudents.map(s => s.nivelActual)))

export default function EstudiantesList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [programaFilter, setProgramaFilter] = useState('')
  const [nivelFilter, setNivelFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [page, setPage] = useState(1)

  const filtered = mockStudents.filter(s => {
    const matchPrograma = !programaFilter || s.programa === programaFilter
    const matchNivel = !nivelFilter || s.nivelActual === nivelFilter
    const matchEstado = !estadoFilter || s.status === estadoFilter
    const q = search.trim().toLowerCase()
    const matchSearch = !q || s.nombre.toLowerCase().includes(q) || s.matricula.toLowerCase().includes(q)
    return matchPrograma && matchNivel && matchEstado && matchSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage)

  const columns: ColumnDef<Student>[] = [
    { key: 'matricula', header: 'Matrícula', type: 'code', className: 'w-28' },
    { key: 'nombre', header: 'Nombre Completo', type: 'name' },
    { key: 'programa', header: 'Programa', type: 'text' },
    { key: 'nivelActual', header: 'Nivel Actual', type: 'text' },
    { key: 'grupo', header: 'Grupo', type: 'text', className: 'w-24' },
    { key: 'status', header: 'Estado', type: 'badge', badge: statusBadgeMap, className: 'w-28' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Inscripciones', to: '/inscripciones' },
          { label: 'Estudiantes' },
        ]}
      />

      <PageHeader
        title="Estudiantes"
        subtitle="Consulta todos los estudiantes activos del sistema."
        actions={[{ label: 'Inscribir Nuevo Ingreso', icon: <PlusIcon />, onClick: () => navigate('/inscripciones/nuevo-ingreso') }]}
      />

      <FilterBar>
        <FilterSelect
          value={programaFilter}
          onChange={v => { setProgramaFilter(v); setPage(1) }}
          allLabel="Todos los programas"
          className="w-full sm:w-64"
          options={programaOptions.map(p => ({ value: p, label: p }))}
        />
        <FilterSelect
          value={nivelFilter}
          onChange={v => { setNivelFilter(v); setPage(1) }}
          allLabel="Todos los niveles"
          className="w-full sm:w-56"
          options={nivelOptions.map(n => ({ value: n, label: n }))}
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
          placeholder="Buscar por nombre o matrícula..."
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
        loadingLabel="Cargando estudiantes..."
        emptyTitle="No se encontraron estudiantes"
        emptyHint="Intenta ajustar los filtros de búsqueda"
        footer={<Pagination page={page} totalPages={totalPages} totalElements={filtered.length} perPage={perPage} onPageChange={setPage} />}
        actions={{
          view: row => navigate(`/inscripciones/estudiantes/detalle?id=${row.id}`),
          viewTooltip: 'Ver detalle',
          extra: row => (
            <>
              <ActionBtn
                icon={<ArrowLeftRight size={15} />}
                tooltip="Reinscribir"
                onClick={() => navigate(`/inscripciones/reinscripcion?id=${row.id}`)}
              />
              <ActionBtn icon={<BookOpen size={15} />} tooltip={KARDEX_TOOLTIP} disabled />
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
            <p className="font-mono text-[11px] text-[#6B7280] mb-1">{row.matricula}</p>
            <p className="text-[12px] text-[#6B7280] mb-1">{row.programa}</p>
            <p className="text-[12px] text-[#6B7280] mb-3">Nivel {row.nivelActual} · Grupo {row.grupo}</p>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <button
                onClick={() => navigate(`/inscripciones/estudiantes/detalle?id=${row.id}`)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
              >
                <EyeIcon size={13} />Ver detalle
              </button>
              <button
                onClick={() => navigate(`/inscripciones/reinscripcion?id=${row.id}`)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
              >
                <ArrowLeftRight size={13} />Reinscribir
              </button>
              <button
                disabled
                title={KARDEX_TOOLTIP}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-[#6B7280] border border-[#E5E7EB] rounded-md opacity-60 cursor-not-allowed"
              >
                <BookOpen size={13} />Kardex
              </button>
            </div>
          </>
        )}
        loadingLabel="Cargando estudiantes..."
        emptyTitle="No se encontraron estudiantes"
        emptyHint="Intenta ajustar los filtros de búsqueda"
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={filtered.length} perPage={perPage} onPageChange={setPage} />}
      />
    </PageContainer>
  )
}