import type { ReactNode } from 'react'
import { ChevronRight, ChevronLeft, Loader2, Search, AlertCircle, Plus, Eye, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ActionBtn, Switch } from '@app/core/components/ui'

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

export function PageHeader({ title, subtitle, actions, divider, className }: {
  title: string
  subtitle?: string
  /** Botones a la derecha del encabezado (tipicamente un botón "Registrar"). */
  actions?: PageHeaderAction[]
  /** true → margen inferior reducido y un <hr> debajo (patrón Planes de Estudio). */
  divider?: boolean
  /** Clases extra del contenedor raíz. */
  className?: string
}) {
  return (
    <>
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${divider ? 'mb-1' : 'mb-6'} ${className ?? ''}`}>
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
      {divider && <hr className="border-[#E5E7EB] my-5 sm:my-6" />}
    </>
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

export function FilterSelect({ value, onChange, options, allLabel, className }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  allLabel: string
  /** Ancho extra (p.ej. `sm:w-64`) — por defecto `w-full sm:w-auto`. */
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full sm:w-auto px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] ${className ?? ''}`}
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
export function EmptyState({ title, hint, icon }: { title: string; hint: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 text-[#6B7280]">
      {icon ?? <Search size={36} className="text-[#E5E7EB]" />}
      <p className="text-[13px] font-medium">{title}</p>
      <p className="text-[12px]">{hint}</p>
    </div>
  )
}

// ─── Pagination ────────────────────────────────────────────────────────────────
// Paginación desktop (compacta, dentro de la tabla) — el patrón del Módulo 01.
export function Pagination({ page, totalPages, totalElements, perPage, onPageChange, suffix }: {
  page: number
  totalPages: number
  totalElements: number
  perPage: number
  onPageChange: (p: number) => void
  suffix?: string
}) {
  const startRow = totalElements === 0 ? 0 : (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalElements)
  return (
    <div className="px-4 py-3 border-t border-[#E5E7EB] flex items-center justify-between">
      <span className="text-[12px] text-[#6B7280]">
        {totalElements === 0 ? 'Sin registros' : `Mostrando ${startRow}–${endRow} de ${totalElements}${suffix ? ` ${suffix}` : ''}`}
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
export function MobilePagination({ page, totalPages, totalElements, perPage, onPageChange, suffix }: {
  page: number
  totalPages: number
  totalElements: number
  perPage: number
  onPageChange: (p: number) => void
  /** Sufijo de "de {n} resultado" (p.ej. "registros"). */
  suffix?: string
}) {
  const startRow = totalElements === 0 ? 0 : (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalElements)
  if (totalElements === 0) return null
  return (
    <div className="flex flex-col items-center gap-3 pt-2">
      <p className="text-[12px] text-[#6B7280]">
        Mostrando {startRow}–{endRow} de {totalElements}{suffix ? ` ${suffix}` : ''}
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

// ─── BadgePill ─────────────────────────────────────────────────────────────────
// Pill multi-estado: si hay un `map` valor→{label,className} se pinta con el color
// de ese valor; si no, cae al boolean Active/Inactive del StatusBadge.
export function BadgePill({ value, active, activeLabel, inactiveLabel, map }: {
  value: unknown
  active?: boolean
  activeLabel?: string
  inactiveLabel?: string
  map?: Record<string, BadgeStyle>
}) {
  const entry = value != null ? map?.[String(value)] : undefined
  if (entry) {
    return (
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${entry.className}`}>
        {entry.label}
      </span>
    )
  }
  return <StatusBadge active={!!active} activeLabel={activeLabel} inactiveLabel={inactiveLabel} />
}

// ─── TableActions ──────────────────────────────────────────────────────────────
// Contenedor de acciones de fila (ver/editar). Se combina con @app/core/components/ui
// (ActionBtn, Switch) para renderizar las acciones del patrón CRUD.
// Las acciones van SIEMPRE en una sola línea (sin wrap): el tooltip ya se
// renderiza por portal a <body> (ver ActionBtn) así que ya no infla el
// `scrollWidth` de la tabla. Si una columna tuviera demasiadas acciones, hay
// que compactar los botones (ActionBtn) en lugar de partir la línea.
export function TableActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-0.5">{children}</div>
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
// Esqueleto de la tabla desktop (md+) declarativo: encapsula el contenedor, thead,
// estados loading/empty y el footer (paginación). Las celdas NO se escriben en la
// vista: cada columna declara un `type` de celda y el componente pinta el diseño
// del <td> correspondiente (nombre, código mono, texto muted, contador, estado
// con switch+badge, badge multi-estado vía `badge` map, texto plano). Un `value`
// getter cubre lookups y valores derivados; `render` queda como escape hatch para
// lo que no tiene 1:1 (botón contextual). La columna de Acciones se agrega
// automáticamente cuando se pasa `actions`, y la de numeración con `numbered`.
export type CellType = 'name' | 'code' | 'muted' | 'count' | 'status' | 'badge' | 'text'

export interface BadgeStyle {
  label: string
  className: string
}

export interface ColumnDef<T> {
  /** Clave del campo/columna. Usa `value` si el texto no sale 1:1 de un campo de `row`. */
  key: string
  /** Texto del header ('' para una columna de acciones sin encabezado texto). */
  header: string
  /** Tipo de celda: cómo se pinta el valor. Por defecto 'text'. */
  type?: CellType
  /** Getter del valor cuando no hay 1:1 con `key` (lookups, fechas ya formateadas, celdas compuestas). */
  value?: (row: T) => string | number
  /** Map valor→{label,className} para `type: 'badge'` (y `'status'`) multi-estado con color por valor. */
  badge?: Record<string, BadgeStyle>
  /** Labels del pill para `type: 'status'`/`'badge'` cuando no hay `badge` map. */
  activeLabel?: string
  inactiveLabel?: string
  /** Clases extra del <th>, p.ej. 'w-24' para fijar ancho. */
  className?: string
  /** Clases extra del <td>. */
  cellClassName?: string
  /** Icono que se muestra en línea a la izquierda del texto (tipos 'name'/'count'/'muted'/'text'). */
  icon?: ReactNode
  /** Texto secundario pequeño (11px, muted) debajo del principal en el mismo <td>. */
  sub?: (row: T) => string
  /** true → <th> de acciones: sin estilos de texto (solo padding + ancho). Solo lo usa el componente. */
  actionCell?: boolean
  /** Escape hatch para celdas excepcionales (índice de fila, botón contextual, …). Recibe (row, index). */
  render?: (row: T, index: number) => ReactNode
}

export interface DataTableActions<T> {
  view?: (row: T) => void
  edit?: (row: T) => void
  delete?: (row: T) => void
  viewTooltip?: string
  editTooltip?: string
  deleteTooltip?: string
  /** Deshabilita el botón Editar de forma condicional (p.ej. filas CLOSED). */
  editDisabled?: (row: T) => boolean
  /** Nodo custom que se pinta ANTES de ver/editar/eliminar (botón contextual, avance de estado, …). */
  extraFirst?: (row: T) => ReactNode
  /** Nodo custom que se pinta DESPUÉS de ver/editar/eliminar (botones especiales, placeholders, …). */
  extra?: (row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  status: 'idle' | 'loading' | 'error' | string
  items: T[]
  keyFor: (item: T) => string
  loadingLabel: string
  emptyTitle: string
  emptyHint: string
  /** Icono del empty state (por defecto Search). */
  emptyIcon?: ReactNode
  footer?: ReactNode
  /** Acciones de fila (ver/editar/eliminar). Si se pasa, agrega la columna de acciones automáticamente. */
  actions?: DataTableActions<T>
  /** Callback para `type: 'status'`. Cambia el estado de `row`. */
  onToggleStatus?: (row: T) => void
  /** Id de la fila con el switch/badge en progreso (deshabilita el switch). */
  togglingId?: string | null
  /** Valor considerado "activo" para `type: 'status'`/`'badge'`. Por defecto 'ACTIVE'. */
  activeValue?: unknown
  /** true → agrega la columna '#' automáticamente, numerando las filas con el offset global. */
  numbered?: boolean
  /** Desplazamiento global de la primera fila de la página (p.ej. `(page - 1) * perPage`). */
  rowNumberOffset?: number
  /** Barra-título opcional dentro de la tarjeta (icono + texto), sobre la tabla. No lo usan las listas CRUD. */
  header?: ReactNode
  /** true → la tabla se muestra también en móvil (con scroll horizontal) en lugar de ocultarse (< md). */
  showOnMobile?: boolean
}

export function DataTable<T>({
  columns,
  status,
  items,
  keyFor,
  loadingLabel,
  emptyTitle,
  emptyHint,
  emptyIcon,
  footer,
  actions,
  onToggleStatus,
  togglingId,
  activeValue = 'ACTIVE',
  numbered = false,
  rowNumberOffset = 0,
  header,
  showOnMobile = false,
}: DataTableProps<T>) {
  const numberedColumn: ColumnDef<T> = {
    key: '__rowNum__',
    header: '#',
    className: 'w-8',
    render: (_, i) => <span className="text-[#6B7280] font-medium">{rowNumberOffset + i + 1}</span>,
  }
  const cols: ColumnDef<T>[] = numbered ? [numberedColumn, ...columns] : columns
  const allColumns: ColumnDef<T>[] = actions
    ? [...cols, { key: '__actions__', header: '', actionCell: true }]
    : cols
  const colSpan = allColumns.length

  /** Envuelve un texto de celda con icono a la izquierda y/o un sub-texto debajo. */
  function textNode(baseClass: string, text: string, col: ColumnDef<T>, row: T): ReactNode {
    const node: ReactNode = col.sub
      ? (
        <div className="flex flex-col">
          <span className={baseClass}>{text}</span>
          <span className="text-[11px] text-[#6B7280]">{col.sub(row)}</span>
        </div>
      )
      : <span className={baseClass}>{text}</span>
    if (!col.icon) return node
    return (
      <span className="inline-flex items-center gap-1.5">
        {col.icon}
        {node}
      </span>
    )
  }

  function renderCell(col: ColumnDef<T>, row: T, index: number): ReactNode {
    if (col.render) return col.render(row, index)
    const raw = col.value ? col.value(row) : (row as unknown as Record<string, unknown>)[col.key]
    const text = raw != null ? String(raw) : ''
    switch (col.type) {
      case 'name':
        return textNode('font-medium text-[#333333]', text, col, row)
      case 'code':
        return (
          <span className="font-mono text-[11px] bg-[#F8F9FA] border border-[#E5E7EB] px-1.5 py-0.5 rounded text-[#333333]">{text}</span>
        )
      case 'muted':
        return textNode('text-[#6B7280]', text, col, row)
      case 'count':
        return textNode('text-[#333333]', text, col, row)
      case 'status':
        return (
          <div className="flex items-center gap-2">
            {onToggleStatus && (
              <Switch
                checked={raw === activeValue}
                disabled={togglingId === keyFor(row)}
                onChange={() => onToggleStatus(row)}
              />
            )}
            <BadgePill value={raw} active={raw === activeValue} activeLabel={col.activeLabel} inactiveLabel={col.inactiveLabel} map={col.badge} />
          </div>
        )
      case 'badge':
        return <BadgePill value={raw} active={raw === activeValue} activeLabel={col.activeLabel} inactiveLabel={col.inactiveLabel} map={col.badge} />
      case 'text':
      default:
        return textNode('', text, col, row)
    }
  }

  function renderActions(row: T): ReactNode {
    if (!actions) return null
    return (
      <TableActions>
        {actions.extraFirst && actions.extraFirst(row)}
        {actions.view && <ActionBtn icon={<Eye size={15} />} tooltip={actions.viewTooltip ?? 'Ver'} onClick={() => actions.view!(row)} />}
        {actions.edit && <ActionBtn icon={<Pencil size={15} />} tooltip={actions.editTooltip ?? 'Editar'} disabled={actions.editDisabled?.(row) ?? false} onClick={() => actions.edit!(row)} />}
        {actions.delete && <ActionBtn danger icon={<Trash2 size={15} />} tooltip={actions.deleteTooltip ?? 'Eliminar'} onClick={() => actions.delete!(row)} />}
        {actions.extra && actions.extra(row)}
      </TableActions>
    )
  }

  return (
    <div className={`${showOnMobile ? 'block' : 'hidden md:block'} bg-white border border-[#E5E7EB] rounded-lg overflow-hidden`}>
      {header && (
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
          {header}
        </div>
      )}
      <div className="overflow-x-auto">
      <table className={`w-full text-[13px]${showOnMobile ? ' min-w-[640px] md:min-w-0' : ''}`}>
        <thead>
          <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
            {allColumns.map(col => (
              <th
                key={col.key}
                className={
                  col.actionCell
                    ? `px-2.5 py-3 ${col.className ?? 'w-24'}`
                    : `text-left px-2.5 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider ${col.className ?? ''}`
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
                <EmptyState title={emptyTitle} hint={emptyHint} icon={emptyIcon} />
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={keyFor(item)} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                {allColumns.map(col => (
                  <td key={col.key} className={`px-2.5 py-3 ${col.cellClassName ?? ''}`}>
                    {col.key === '__actions__' ? renderActions(item) : renderCell(col, item, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
      {footer && footer}
    </div>
  )
}

// ─── MobileCards ───────────────────────────────────────────────────────────────
// Vista mobile (< md) en tarjetas usada en todas las listas CRUD. Encapsula los
// estados loading/empty y la paginación mobile; el contenido de cada tarjeta se
// delega a `renderItem` (debe devolver el <div> interior de la card).
export function MobileCards<T>({ status, items, renderItem, keyFor, loadingLabel, emptyTitle, emptyHint, emptyIcon, pagination }: {
  status: 'idle' | 'loading' | 'error' | string
  items: T[]
  renderItem: (item: T) => ReactNode
  keyFor: (item: T) => string
  loadingLabel: string
  emptyTitle: string
  emptyHint: string
  emptyIcon?: ReactNode
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
          <EmptyState title={emptyTitle} hint={emptyHint} icon={emptyIcon} />
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
