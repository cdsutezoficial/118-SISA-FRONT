import { useState, useRef, useEffect } from 'react'
import {
  ChevronRight, Search, Eye, Pencil, ToggleLeft, Plus,
  ChevronLeft, ChevronRight as ChevRight, X, ChevronDown, BookOpen, Layers, BookMarked,
} from 'lucide-react'
import { Toast, ActionBtn } from '../shared/ui'
import type { NavigateFn } from '../shared/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Plan {
  id: number
  clave: string
  programa: string
  programaClave: string
  anio: number
  niveles: number
  materias: number
  estado: 'Activo' | 'Inactivo'
}

interface SelectOption { value: string; label: string }

// ─── Data ──────────────────────────────────────────────────────────────────────

const allPlanes: Plan[] = [
  { id: 1, clave: 'IDGS-2022', programa: 'Ingeniería en Desarrollo y Gestión de Software', programaClave: 'IDGS', anio: 2022, niveles: 11, materias: 44, estado: 'Activo' },
  { id: 2, clave: 'IRT-2022',  programa: 'Ingeniería en Redes y Telecomunicaciones',         programaClave: 'IRT',  anio: 2022, niveles: 11, materias: 42, estado: 'Activo' },
  { id: 3, clave: 'II-2021',   programa: 'Ingeniería Industrial',                             programaClave: 'II',   anio: 2021, niveles: 11, materias: 40, estado: 'Activo' },
  { id: 4, clave: 'AGE-2022',  programa: 'Administración y Gestión Empresarial',              programaClave: 'AGE',  anio: 2022, niveles: 6,  materias: 24, estado: 'Activo' },
]

const programaOptions: SelectOption[] = [
  { value: 'IDGS', label: 'Ing. en Desarrollo y Gestión de Software' },
  { value: 'IRT',  label: 'Ing. en Redes y Telecomunicaciones' },
  { value: 'II',   label: 'Ingeniería Industrial' },
  { value: 'AGE',  label: 'Administración y Gestión Empresarial' },
]

const estadoOptions: SelectOption[] = [
  { value: '', label: 'Todos' },
  { value: 'Activo',   label: 'Activo' },
  { value: 'Inactivo', label: 'Inactivo' },
]

// ─── SearchSelect ──────────────────────────────────────────────────────────────

function SearchSelect({ options, value, onChange, placeholder }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void; placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()) || o.value.toLowerCase().includes(query.toLowerCase()))
  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative w-64">
      <button type="button" onClick={() => { setOpen(!open); setQuery('') }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-left transition hover:border-[#009574]/50 focus:outline-none">
        <span className={`truncate ${selected ? 'text-[#333333]' : 'text-[#6B7280]'}`}>{selected ? selected.label : placeholder}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span role="button" tabIndex={0}
              onClick={e => { e.stopPropagation(); onChange('') }}
              onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onChange(''))}
              className="text-[#6B7280] hover:text-[#333333] p-0.5 rounded">
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-[#6B7280] transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-[#E5E7EB]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar programa..."
                className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:border-[#009574]" />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-3 py-2 text-[12px] text-[#6B7280] text-center">Sin resultados</li>
              : filtered.map(o => (
                <li key={o.value}>
                  <button type="button" onClick={() => { onChange(o.value); setOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${value === o.value ? 'bg-[#e6f5f1] text-[#009574] font-medium' : 'text-[#333333] hover:bg-[#F8F9FA]'}`}>
                    {o.label}
                  </button>
                </li>
              ))
            }
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── SimpleSelect ──────────────────────────────────────────────────────────────

function SimpleSelect({ options, value, onChange }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])
  const selected = options.find(o => o.value === value) ?? options[0]
  return (
    <div ref={ref} className="relative w-36">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-left hover:border-[#009574]/50 focus:outline-none transition">
        <span className="text-[#333333]">{selected.label}</span>
        <ChevronDown size={14} className={`text-[#6B7280] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 py-1">
          {options.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${value === o.value ? 'bg-[#e6f5f1] text-[#009574] font-medium' : 'text-[#333333] hover:bg-[#F8F9FA]'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

interface Props { navigate: NavigateFn; pendingToast?: string }

export default function PlanesList({ navigate, pendingToast }: Props) {
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [programaFilter, setProgramaFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 10

  useEffect(() => { if (pendingToast) setToast(pendingToast) }, [pendingToast])

  const filtered = allPlanes.filter(p => {
    const matchProg  = !programaFilter || p.programaClave === programaFilter
    const matchEst   = !estadoFilter   || p.estado === estadoFilter
    const q = search.toLowerCase()
    const matchQ = !q || p.clave.toLowerCase().includes(q) || p.programa.toLowerCase().includes(q) || String(p.anio).includes(q)
    return matchProg && matchEst && matchQ
  })

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated  = filtered.slice((page - 1) * perPage, page * perPage)
  const startRow   = filtered.length === 0 ? 0 : (page - 1) * perPage + 1
  const endRow     = Math.min(page * perPage, filtered.length)
  const hasFilters = !!programaFilter || !!estadoFilter || !!search

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate({ page: 'dashboard' })} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Planes de Estudio</span>
      </nav>

      {/* Title + action */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Planes de Estudio</h1>
          <p className="text-[14px] text-[#6B7280] mt-1 max-w-xl">
            Consulta y administra los planes de estudio de cada programa educativo. Cada programa puede tener múltiples planes con distintos años de vigencia.
          </p>
        </div>
        <button
          onClick={() => navigate({ page: 'plan-form', mode: 'register' })}
          className="flex items-center gap-2 bg-[#009574] hover:bg-[#007a5e] text-white text-[13px] font-semibold px-4 py-2 rounded-md transition-colors whitespace-nowrap mt-1"
        >
          <Plus size={15} />Registrar Plan de Estudios
        </button>
      </div>

      <hr className="border-[#E5E7EB] my-6" />

      {/* Filters + search */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <SearchSelect
          options={programaOptions} value={programaFilter}
          onChange={v => { setProgramaFilter(v); setPage(1) }}
          placeholder="Todos los programas"
        />
        <SimpleSelect
          options={estadoOptions} value={estadoFilter}
          onChange={v => { setEstadoFilter(v); setPage(1) }}
        />
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input type="text" placeholder="Buscar plan..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] transition" />
        </div>
        {hasFilters && (
          <button onClick={() => { setProgramaFilter(''); setEstadoFilter(''); setSearch(''); setPage(1) }}
            className="flex items-center gap-1 text-[12px] text-[#6B7280] hover:text-[#333333] transition-colors">
            <X size={13} />Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-10">#</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Clave del Plan</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa Educativo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28 text-center">Año de Vigencia</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32 text-center">Niveles</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32 text-center">Materias</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Estado</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <BookOpen size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">No se encontraron planes de estudio</p>
                    <p className="text-[12px]">Intenta ajustar los filtros de búsqueda</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => {
                const rowNum = (page - 1) * perPage + i + 1
                return (
                  <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3 text-[#6B7280] font-medium">{rowNum}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px] font-semibold bg-[#F8F9FA] border border-[#E5E7EB] px-2 py-0.5 rounded text-[#333333]">
                        {row.clave}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#333333]">{row.programa}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-[13px] font-semibold text-[#333333] tabular-nums">{row.anio}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-[#333333]">
                        <Layers size={13} className="text-[#6B7280]" />
                        <span className="font-semibold tabular-nums">{row.niveles}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-[#333333]">
                        <BookMarked size={13} className="text-[#6B7280]" />
                        <span className="font-semibold tabular-nums">{row.materias}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.estado === 'Activo' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <ActionBtn icon={<Eye size={15} />} tooltip="Ver detalle" onClick={() => navigate({ page: 'plan-detalle' })} />
                        <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => navigate({ page: 'plan-form', mode: 'edit' })} />
                        <ActionBtn icon={<ToggleLeft size={15} />} tooltip="Cambiar estado" danger />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB] bg-[#F8F9FA]">
          <p className="text-[12px] text-[#6B7280]">
            {filtered.length === 0 ? 'Sin registros' : `Mostrando ${startRow}–${endRow} de ${filtered.length} registros`}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#F8F9FA] transition-colors">
              <ChevronLeft size={13} />Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 text-[12px] font-medium rounded-md border transition-colors ${p === page ? 'bg-[#009574] text-white border-[#009574]' : 'bg-white text-[#333333] border-[#E5E7EB] hover:bg-[#F8F9FA]'}`}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
              className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#F8F9FA] transition-colors">
              Siguiente<ChevRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
