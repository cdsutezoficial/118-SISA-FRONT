import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Check, ChevronDown, Loader2, Pencil, Save, Search, X } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, inputCls } from './ui'
import type { SelectOption } from './ui'
import { PageContainer } from './list'

// ─── Design tokens ────────────────────────────────────────────────────────────
// Primary: #009574, hover: #007a5e
// Text: #333333, secondary: #6B7280
// Border: #E5E7EB, bg-secondary: #F8F9FA
// Active tint: #e6f5f1 — see ui.tsx barrel header.

// ═══ Layout ═══════════════════════════════════════════════════════════════

// ─── FormPage ─────────────────────────────────────────────────────────────────
// Contenedor de formularios: mismo ancho que las listas (PageContainer, 1280px)
// para que todas las vistas queden alineadas.
export function FormPage({ children }: { children: ReactNode }) {
  return <PageContainer>{children}</PageContainer>
}

// ─── FormHeader ──────────────────────────────────────────────────────────────
// Título + subtítulo con un slot derecho (ModeSwitcher o acciones).
export function FormHeader({ title, subtitle, right }: {
  title: string
  subtitle?: string
  /** Área derecha del header (p.ej. <ModeSwitcher />). */
  right?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#333333]">{title}</h1>
        {subtitle && <p className="text-[14px] text-[#6B7280] mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

// ─── FormCard ─────────────────────────────────────────────────────────────────
// Tarjeta blanca del formulario. Con `loading` muestra el spinner en vez del
// contenido (patrón de carga de edit/view en todos los forms CRUD).
export function FormCard({ children, loading = false, loadingLabel = 'Cargando...' }: {
  children?: ReactNode
  /** true → muestra el spinner de carga en lugar del formulario. */
  loading?: boolean
  loadingLabel?: string
}) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
      {loading ? (
        <div className="flex flex-col items-center gap-3 text-[#6B7280] py-12">
          <Loader2 size={24} className="animate-spin text-[#009574]" />
          <p className="text-[13px] font-medium">{loadingLabel}</p>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

// ─── FormActions ─────────────────────────────────────────────────────────────
// Pie de acciones, dos variantes que comparten estilos:
//   - view:  [Regresar]            [Editar]
//   - ~view: [Cancelar]            [Guardar...]
// El botón secundario (Regresar/Cancelar) usa ArrowLeft/X; el primario
// (Editar/Guardar) usa Pencil/Save, con spinner cuando `isSubmitting`.
export function FormActions({ isView, onBack, onPrimary, primaryLabel, isSubmitting = false, primaryDisabled = false }: {
  isView: boolean
  /** Regresar (view) o Cancelar (register/edit). */
  onBack: () => void
  /** Editar (view) o Guardar (register/edit). */
  onPrimary: () => void
  primaryLabel: string
  isSubmitting?: boolean
  primaryDisabled?: boolean
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
      <Button variant="secondary" size="md" onClick={onBack} disabled={isSubmitting} className="w-full sm:w-auto">
        {isView ? <ArrowLeft size={14} /> : <X size={14} />}
        {isView ? 'Regresar' : 'Cancelar'}
      </Button>
      <Button variant="primary" size="md" onClick={onPrimary} loading={isSubmitting} disabled={primaryDisabled} className="w-full sm:w-auto">
        {!isSubmitting && (isView ? <Pencil size={14} /> : <Save size={14} />)}
        {primaryLabel}
      </Button>
    </div>
  )
}

// ═══ Buttons ═══════════════════════════════════════════════════════════════

// ─── Button ───────────────────────────────────────────────────────────────────
// Botón genérico con las variantes presentes en la app. Los botones fill-width
// (p.ej. en móvil) pasan `className="w-full"`.
const BTN_VARIANTS: Record<string, string> = {
  primary: 'bg-[#009574] hover:bg-[#007a5e] text-white',
  secondary: 'border border-[#E5E7EB] bg-white text-[#333333] hover:bg-[#F8F9FA]',
  danger: 'border border-red-200 bg-white text-red-500 hover:bg-red-50',
  ghost: 'text-[#009574] hover:text-[#007a5e]',
}
const BTN_SIZES: Record<string, string> = {
  sm: 'px-3 py-1.5 text-[12px]',
  md: 'px-4 py-2 text-[13px]',
}

export function Button({ children, onClick, type = 'button', variant = 'primary', size = 'md', disabled, loading, className }: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: keyof typeof BTN_VARIANTS
  size?: keyof typeof BTN_SIZES
  disabled?: boolean
  loading?: boolean
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className ?? ''}`}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

// ─── IconButton ───────────────────────────────────────────────────────────────
// Botón de solo icono (p.ej. eliminar fila en tablas de niveles/rangos).
export function IconButton({ icon, onClick, danger = false, disabled, className }: {
  icon: ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-md transition-colors ${
        danger ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-[#6B7280] hover:text-[#009574] hover:bg-[#e6f5f1]'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className ?? ''}`}
    >
      {icon}
    </button>
  )
}

// ═══ Fields ════════════════════════════════════════════════════════════════
// Patrón repetido en todos los forms: FieldLabel + control + FieldHelp/FieldError.
// Antes se escribía a mano con `inputCls(disabled, hasError)` en cada vista.

// ─── TextField ────────────────────────────────────────────────────────────────
export function TextField({ label, required, value, onChange, disabled, error, help, type = 'text', placeholder, placeholderHidden = false, mono, numeric, maxLength, min, max, step, readOnly, className }: {
  label?: string
  required?: boolean
  value: string
  /** Opcional cuando el campo es solo lectura (disabled/readOnly). */
  onChange?: (v: string) => void
  disabled?: boolean
  /** Texto de error — se pinta en rojo reemplazando el help. */
  error?: string
  help?: string
  type?: 'text' | 'number' | 'date' | 'email' | 'datetime-local' | 'password'
  placeholder?: string
  /** true → el placeholder queda oculto en modo view/disabled. */
  placeholderHidden?: boolean
  mono?: boolean
  numeric?: boolean
  maxLength?: number
  min?: number | string
  max?: number | string
  step?: number | string
  readOnly?: boolean
  className?: string
}) {
  const isDisabled = disabled || placeholderHidden
  const cls = `${inputCls(disabled ?? false, !!error)}${mono ? ' font-mono' : ''}${numeric ? ' tabular-nums' : ''}`
  return (
    <div className={className}>
      {label && <FieldLabel required={required}>{label}</FieldLabel>}
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={isDisabled}
        readOnly={readOnly}
        placeholder={placeholderHidden ? '' : placeholder}
        maxLength={maxLength}
        min={min}
        max={max}
        step={step}
        className={cls}
      />
      {error ? <FieldError>{error}</FieldError> : help ? <FieldHelp>{help}</FieldHelp> : null}
    </div>
  )
}

// ─── TextAreaField ────────────────────────────────────────────────────────────
export function TextAreaField({ label, required, value, onChange, disabled, error, help, placeholder, rows = 4, className }: {
  label?: string
  required?: boolean
  value: string
  onChange?: (v: string) => void
  disabled?: boolean
  error?: string
  help?: string
  placeholder?: string
  rows?: number
  className?: string
}) {
  return (
    <div className={className}>
      {label && <FieldLabel required={required}>{label}</FieldLabel>}
      <textarea
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        className={inputCls(disabled ?? false, !!error) + ' resize-none'}
      />
      {error ? <FieldError>{error}</FieldError> : help ? <FieldHelp>{help}</FieldHelp> : null}
    </div>
  )
}

// ─── SelectField ──────────────────────────────────────────────────────────────
// Select simple (options value/label) con dropdown custom (panel con check y
// chevron rotatorio), mismo diseño que SearchSelectField pero sin búsqueda.
export function SelectField({ label, required, value, onChange, disabled, error, help, options, placeholder = 'Seleccionar…', className }: {
  label?: string
  required?: boolean
  value: string
  onChange?: (v: string) => void
  disabled?: boolean
  error?: string
  help?: string
  options: SelectOption[]
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div className={className}>
      {label && <FieldLabel required={required}>{label}</FieldLabel>}
      {disabled ? (
        <div className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md text-[#6B7280] cursor-not-allowed select-none">
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown size={14} className="text-[#E5E7EB] flex-shrink-0" />
        </div>
      ) : (
        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-white border rounded-md text-left outline-none transition ${
              error
                ? 'border-red-400'
                : 'border-[#E5E7EB] hover:border-[#009574]/50 focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]'
            }`}
          >
            <span className={`truncate ${selected ? 'text-[#333333]' : 'text-[#6B7280]'}`}>
              {selected?.label ?? placeholder}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {value && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); onChange?.('') }}
                  onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onChange?.(''))}
                  className="text-[#6B7280] hover:text-[#333333] p-0.5 rounded"
                >
                  <X size={12} />
                </span>
              )}
              <ChevronDown size={14} className={`text-[#6B7280] transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {open && (
            <div className="absolute top-full mt-1 left-0 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 overflow-hidden">
              <ul className="max-h-52 overflow-y-auto py-1">
                {options.map(o => (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => { onChange?.(o.value); setOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-[13px] transition-colors flex items-center justify-between ${
                        o.value === value
                          ? 'bg-[#e6f5f1] text-[#009574] font-medium'
                          : 'text-[#333333] hover:bg-[#e6f5f1] hover:text-[#009574]'
                      }`}
                    >
                      {o.label}
                      {o.value === value && <Check size={13} className="flex-shrink-0" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {error ? <FieldError>{error}</FieldError> : help ? <FieldHelp>{help}</FieldHelp> : null}
    </div>
  )
}

// ═══ MiniTable ══════════════════════════════════════════════════════════════
// Tabla simple embebida en formularios (tarifas, niveles, rangos). Las celdas
// se delegan a `render` (escape hatch para inputs inline o badges); por defecto
// imprime `row[key]`.

// ─── MiniTable ────────────────────────────────────────────────────────────────
export interface MiniColumn<T> {
  key: string
  header: string
  /** Clases del <th> y <td> (p.ej. ancho o alineación `text-right`). */
  className?: string
  render?: (row: T) => ReactNode
}

export function MiniTable<T>({ columns, items, keyFor, className, footer }: {
  columns: MiniColumn<T>[]
  items: T[]
  keyFor: (row: T) => string
  className?: string
  /** Fila de pie (tfoot) a ancho completo — p.ej. subtotales. */
  footer?: ReactNode
}) {
  return (
    <table className={`w-full text-[12px] ${className ?? ''}`}>
      <thead>
        <tr className="bg-[#F8F9FA] border-b border-[#E5E7EB]">
          {columns.map(c => (
            <th key={c.key} className={`text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider ${c.className ?? ''}`}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map(row => (
          <tr key={keyFor(row)} className="border-b border-[#E5E7EB] last:border-0">
            {columns.map(c => (
              <td key={c.key} className={`px-3 py-2 ${c.className ?? ''}`}>
                {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {footer && (
        <tfoot>
          <tr className="bg-[#F8F9FA] border-t border-[#E5E7EB]">
            <td colSpan={columns.length} className="px-3 py-2">
              {footer}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

// ─── Picker (búsqueda/selección dentro de formularios) ─────────────────────────

export function PickerInput({ value, onChange, onFocus, readOnly, placeholder, disabled, className }: {
  value?: string
  onChange?: (v: string) => void
  onFocus?: () => void
  readOnly?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
      <input
        type="text"
        value={value}
        onChange={e => onChange?.(e.target.value)}
        onFocus={onFocus}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] transition ${readOnly ? 'cursor-pointer' : ''} ${className ?? ''}`}
      />
    </div>
  )
}

export function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[#6B7280] hover:text-[#333333] p-1 rounded flex-shrink-0">
      <X size={14} />
    </button>
  )
}

export function SelectedItem({ title, subtitle, onClear }: {
  title: ReactNode
  subtitle?: ReactNode
  onClear?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-[#e6f5f1] border border-[#009574]/30 rounded-md">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[#333333] truncate">{title}</p>
        {subtitle !== undefined && <p className="text-[12px] text-[#6B7280] font-mono truncate">{subtitle}</p>}
      </div>
      {onClear && <ClearButton onClick={onClear} />}
    </div>
  )
}

export function PickerPanel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute top-full mt-1 left-0 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 overflow-hidden">
      {children}
    </div>
  )
}

export function PickerOption({ onClick, disabled, children, className }: {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F8F9FA]'} ${className ?? ''}`}
      >
        {children}
      </button>
    </li>
  )
}

export function PickerLoading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <li className="px-3 py-3 text-center text-[12px] text-[#6B7280] flex items-center justify-center gap-2">
      <Loader2 size={13} className="animate-spin" />{label}
    </li>
  )
}

export function PickerError({ text }: { text: string }) {
  return (
    <li className="px-3 py-3 text-center text-[12px] text-red-600">{text}</li>
  )
}

export function PickerEmpty({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <li className="px-3 py-3 text-center text-[12px] text-[#6B7280] flex flex-col items-center gap-1.5">{icon}{text}</li>
  )
}