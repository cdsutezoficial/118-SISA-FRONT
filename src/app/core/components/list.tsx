import type { ReactNode } from 'react'
import { ChevronRight, ChevronLeft, Loader2, Search, AlertCircle, Plus, Eye, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ActionBtn } from '@app/core/components/ui'

// ─── Design tokens ────────────────────────────────────────────────────────────
// Primary: #009574, hover: #007a5e
// Text: #333333, secondary: #6B7280
// Border: #E5E7EB, bg-secondary: #F8F9FA
// Active tint: #e6f5f1 — see ui.tsx barrel header.

// ─── PageContainer ────────────────────────────────────────────────────────────
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {children}
    </div>
  )
}

// ─── Breadcrumb ────────────────────────────────────────────────────────────────
export interface BreadcrumbItem {
  label: string
  /** Omitir para el último ítem (sin link, texto destacado). */
  to?: string
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const navigate = useNavigate()
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={13} />}
            {item.to && !isLast ? (
              <button onClick={() => navigate(item.to!)} className="hover:text-[#009574] transition-colors">
                {item.label}
              </button>
            ) : (
              <span className={isLast ? 'text-[#333333] font-medium' : 'text-[#6B7280]'}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

// ─── PageHeader ────────────────────────────────────────────────────────────────
export interface PageHeaderAction {
  label: string
  onClick: () => void
  icon?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: {
  title: string
  subtitle?: string
  /** Botones a la derecha del encabezado (tipicamente un botón "Registrar"). */
  actions?: PageHeaderAction[]
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#333333]">{title}</h1>
        {subtitle && <p className="text-[14px] text-[#6B7280] mt-1">{subtitle}</p>}
      </div>
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              className="flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors sm:whitespace-nowrap sm:self-start"
            >
              {a.icon}{a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SearchInput ───────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative flex-1 sm:max-w-sm">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
      />
    </div>
  )
}

// ─── FilterBar ─────────────────────────────────────────────────────────────────
// Barra de filtros responsiva que acomoda un campo de búsqueda, filtros `select`
// extra y un contador de resultados. Orden de renderizado exacto del patrón CRUD:
// [filtros select...] [search] [count].
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
      {children}
    </div>
  )
}

export function FilterSelect({ value, onChange, options, allLabel }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  allLabel: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full sm:w-auto px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
    >
      <option value="">{allLabel}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function ResultCount({ count }: { count: number }) {
  return (
    <span className="text-[12px] text-[#6B7280] hidden sm:inline">
      {count} resultado{count !== 1 ? 's' : ''}
    </span>
  )
}

// ─── ErrorBanner ───────────────────────────────────────────────────────────────
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
      {message}
    </div>
  )
}

// ─── LoadingState ──────────────────────────────────────────────────────────────
// Uso dentro de una celda `<td colSpan={n}>` o en un bloque móvil.
export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-[#6B7280]">
      <Loader2 size={24} className="animate-spin text-[#009574]" />
      <p className="text-[13px] font-medium">{label}</p>
    </div>
  )
}

// ─── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-[#6B7280]">
      <Search size={36} className="text-[#E5E7EB]" />
      <p className="text-[13px] font-medium">{title}</p>
      <p className="text-[12px]">{hint}</p>
    </div>
  )
}

// ─── Pagination ────────────────────────────────────────────────────────────────
// Paginación desktop (compacta, dentro de la tabla) — el patrón del Módulo 01.
export function Pagination({ page, totalPages, totalElements, perPage, onPageChange }: {
  page: number
  totalPages: number
  totalElements: number
  perPage: number
  onPageChange: (p: number) => void
}) {
  const startRow = totalElements === 0 ? 0 : (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalElements)
  return (
    <div className="px-4 py-3 border-t border-[#E5E7EB] flex items-center justify-between">
      <span className="text-[12px] text-[#6B7280]">
        {totalElements === 0 ? 'Sin registros' : `Mostrando ${startRow}–${endRow} de ${totalElements}`}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
          className="p-1.5 rounded border border-[#E5E7EB] text-[#6B7280] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#F8F9FA]">
          <ChevronLeft size={14} />
        </button>
        <button className="px-3 py-1 rounded border border-[#009574] bg-[#009574] text-white text-[12px] font-semibold">{page}</button>
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages || totalPages === 0}
          className="p-1.5 rounded border border-[#E5E7EB] text-[#6B7280] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#F8F9FA]">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── MobilePagination ──────────────────────────────────────────────────────────
// Paginación móvil (cards) — "Anterior / pág / Siguiente".
export function MobilePagination({ page, totalPages, totalElements, perPage, onPageChange }: {
  page: number
  totalPages: number
  totalElements: number
  perPage: number
  onPageChange: (p: number) => void
}) {
  const startRow = totalElements === 0 ? 0 : (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalElements)
  if (totalElements === 0) return null
  return (
    <div className="flex flex-col items-center gap-3 pt-2">
      <p className="text-[12px] text-[#6B7280]">
        Mostrando {startRow}–{endRow} de {totalElements}
      </p>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronLeft size={13} />Anterior
        </button>
        <span className="px-3 py-1.5 text-[12px] font-semibold text-[#009574] border border-[#009574] rounded-md bg-white tabular-nums">
          {page} / {totalPages}
        </span>
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages || totalPages === 0}
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed">
          Siguiente<ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── StatusBadge ───────────────────────────────────────────────────────────────
// Etiqueta pill de estado genérica usada en listados (ACTIVE/INACTIVE → Activo/Inactivo).
export function StatusBadge({ active, activeLabel = 'Activo', inactiveLabel = 'Inactivo' }: {
  active: boolean
  activeLabel?: string
  inactiveLabel?: string
}) {
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
      active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
    }`}>
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}

// ─── TableActions ──────────────────────────────────────────────────────────────
// Contenedor de acciones de fila (ver/editar). Se combina con @app/core/components/ui
// (ActionBtn, Switch) para renderizar las acciones del patrón CRUD.
export function TableActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>
}

// ─── DefaultView/Edit actions (reutilizable) ───────────────────────────────────
export function ViewEditActions({ onView, onEdit, viewTooltip = 'Ver', editTooltip = 'Editar' }: {
  onView?: () => void
  onEdit?: () => void
  viewTooltip?: string
  editTooltip?: string
}) {
  return (
    <TableActions>
      {onView && <ActionBtn icon={<Eye size={15} />} tooltip={viewTooltip} onClick={onView} />}
      {onEdit && <ActionBtn icon={<Pencil size={15} />} tooltip={editTooltip} onClick={onEdit} />}
    </TableActions>
  )
}

// ─── ListPageHeader factory action helper ──────────────────────────────────────
export function newAction(label: string, onClick: () => void): PageHeaderAction {
  return { label, onClick, icon: <Plus size={15} /> }
}

// ─── DataTable ─────────────────────────────────────────────────────────────────
// Esqueleto de la tabla desktop (md+) usado en todas las listas CRUD.
// Encapsula el contenedor, thead declarativo, estados loading/empty y el footer
// (paginación). El cuerpo de cada fila se delega a `renderRow` (debe devolver
// un <tr> completo para un item). Cubre el patrón del Módulo 01 sin cambios
// visuales.
export interface ColumnDef {
  /** Texto del header ('' para una columna de acciones sin encabezado texto). */
  header: string
  /** Clases extra del <th>, p.ej. 'w-24' para fijar ancho. */
  className?: string
  /** true → <th> de acciones: sin estilos de texto (solo padding + ancho). */
  actionCell?: boolean
}

interface DataTableProps<T> {
  columns: ColumnDef[]
  status: 'idle' | 'loading' | 'error' | string
  items: T[]
  renderRow: (item: T) => ReactNode
  keyFor: (item: T) => string
  loadingLabel: string
  emptyTitle: string
  emptyHint: string
  footer?: ReactNode
}

export function DataTable<T>({
  columns,
  status,
  items,
  renderRow,
  keyFor,
  loadingLabel,
  emptyTitle,
  emptyHint,
  footer,
}: DataTableProps<T>) {
  const colSpan = columns.length
  return (
    <div className="hidden md:block bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
            {columns.map((col, i) => (
              <th
                key={i}
                className={
                  col.actionCell
                    ? `px-4 py-3 ${col.className ?? 'w-24'}`
                    : `text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider ${col.className ?? ''}`
                }
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {status === 'loading' ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-16 text-center">
                <LoadingState label={loadingLabel} />
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-16 text-center">
                <EmptyState title={emptyTitle} hint={emptyHint} />
              </td>
            </tr>
          ) : (
            items.map(item => <tr key={keyFor(item)} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">{renderRow(item)}</tr>)
          )}
        </tbody>
      </table>
      {footer && footer}
    </div>
  )
}

// ─── MobileCards ───────────────────────────────────────────────────────────────
// Vista mobile (< md) en tarjetas usada en todas las listas CRUD. Encapsula los
// estados loading/empty y la paginación mobile; el contenido de cada tarjeta se
// delega a `renderItem` (debe devolver el <div> interior de la card).
export function MobileCards<T>({ status, items, renderItem, keyFor, loadingLabel, emptyTitle, emptyHint, pagination }: {
  status: 'idle' | 'loading' | 'error' | string
  items: T[]
  renderItem: (item: T) => ReactNode
  keyFor: (item: T) => string
  loadingLabel: string
  emptyTitle: string
  emptyHint: string
  pagination?: ReactNode
}) {
  return (
    <div className="md:hidden space-y-3">
      {status === 'loading' ? (
        <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
          <LoadingState label={loadingLabel} />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
          <EmptyState title={emptyTitle} hint={emptyHint} />
        </div>
      ) : (
        items.map(item => (
          <div key={keyFor(item)} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
            {renderItem(item)}
          </div>
        ))
      )}
      {pagination && pagination}
    </div>
  )
}
