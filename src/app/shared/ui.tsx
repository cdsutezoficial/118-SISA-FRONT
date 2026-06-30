import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ChevronDown, X, Check, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Pencil, Eye, RotateCcw } from 'lucide-react'
import { formatDate, MONTHS, DAYS } from './utils'

// ─── Design tokens ────────────────────────────────────────────────────────────
// Primary: #009574, hover: #007a5e
// Text: #333333, secondary: #6B7280
// Border: #E5E7EB, bg-secondary: #F8F9FA
// Active tint: #e6f5f1

// ─── inputCls ─────────────────────────────────────────────────────────────────
export function inputCls(disabled: boolean, hasError: boolean): string {
  if (disabled) return 'w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-[#F8F9FA] text-[#6B7280] cursor-not-allowed'
  if (hasError) return 'w-full px-3 py-2 text-[13px] border border-red-400 rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-red-300'
  return 'w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]'
}

// ─── FieldLabel ───────────────────────────────────────────────────────────────
export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[12px] font-semibold text-[#333333] mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

// ─── FieldHelp ────────────────────────────────────────────────────────────────
export function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-[#6B7280]">{children}</p>
}

// ─── FieldError ───────────────────────────────────────────────────────────────
export function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-red-500">{children}</p>
}

// ─── SearchSelect ─────────────────────────────────────────────────────────────
interface SearchSelectProps {
  options: string[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}

export function SearchSelect({ options, value, onChange, placeholder = 'Seleccionar…', disabled = false }: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()))

  if (disabled) {
    return (
      <div className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-[#F8F9FA] text-[#6B7280] cursor-not-allowed flex items-center justify-between">
        <span>{value || placeholder}</span>
        <ChevronDown size={14} className="text-[#6B7280]" />
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setQuery('') }}
        className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] flex items-center justify-between"
      >
        <span className={value ? 'text-[#333333]' : 'text-[#6B7280]'}>{value || placeholder}</span>
        <div className="flex items-center gap-1">
          {value && (
            <span onMouseDown={e => { e.stopPropagation(); onChange('') }} className="hover:text-red-500 text-[#6B7280] cursor-pointer">
              <X size={13} />
            </span>
          )}
          <ChevronDown size={14} className="text-[#6B7280]" />
        </div>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[#E5E7EB] rounded-md shadow-lg">
          <div className="p-2 border-b border-[#E5E7EB]">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-full px-2 py-1.5 text-[12px] border border-[#E5E7EB] rounded focus:outline-none focus:ring-1 focus:ring-[#009574]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-[#6B7280]">Sin resultados</p>
            ) : filtered.map(o => (
              <button
                key={o}
                type="button"
                onMouseDown={() => { onChange(o); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[#e6f5f1] hover:text-[#009574] transition-colors flex items-center justify-between ${o === value ? 'bg-[#e6f5f1] text-[#009574] font-medium' : 'text-[#333333]'}`}
              >
                {o}
                {o === value && <Check size={13} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SimpleSelect ─────────────────────────────────────────────────────────────
interface SimpleSelectProps {
  options: string[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}

export function SimpleSelect({ options, value, onChange, placeholder = 'Seleccionar…', disabled = false }: SimpleSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={`appearance-none ${inputCls(disabled, false)} pr-8`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
    </div>
  )
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────
function buildCalendar(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  // Monday-based: 0=Mon ... 6=Sun
  let startDow = first.getDay() - 1
  if (startDow < 0) startDow = 6
  const cells: (Date | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function parseDate(str: string): Date | null {
  if (!str) return null
  const [dd, mm, yyyy] = str.split('/').map(Number)
  if (!dd || !mm || !yyyy) return null
  return new Date(yyyy, mm - 1, dd)
}

// ─── DatePicker ───────────────────────────────────────────────────────────────
interface DatePickerProps {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  minDate?: Date
  placeholder?: string
}

export function DatePicker({ value, onChange, disabled = false, minDate, placeholder = 'dd/MM/yyyy' }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const parsed = parseDate(value)
  const [viewYear, setViewYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : today.getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(d: Date) {
    onChange(formatDate(d))
    setOpen(false)
  }

  function isDisabledDay(d: Date) {
    if (!minDate) return false
    return d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
  }

  const weeks = buildCalendar(viewYear, viewMonth)

  if (disabled) {
    return (
      <div className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-[#F8F9FA] text-[#6B7280] cursor-not-allowed">
        {value || placeholder}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-left focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] flex items-center justify-between"
      >
        <span className={value ? 'text-[#333333]' : 'text-[#6B7280]'}>{value || placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#6B7280]"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-xl p-3 w-64">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-[#F8F9FA]"><ChevronLeft size={14} /></button>
            <span className="text-[13px] font-semibold text-[#333333]">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-[#F8F9FA]"><ChevronRight size={14} /></button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => <div key={d} className="text-[10px] font-semibold text-[#6B7280] text-center py-0.5">{d}</div>)}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day, di) => {
                if (!day) return <div key={di} />
                const isSelected = parsed && day.toDateString() === parsed.toDateString()
                const isToday = day.toDateString() === today.toDateString()
                const isDis = isDisabledDay(day)
                return (
                  <button
                    key={di}
                    type="button"
                    disabled={isDis}
                    onClick={() => selectDay(day)}
                    className={`text-[12px] h-7 w-7 mx-auto rounded-full flex items-center justify-center transition-colors
                      ${isSelected ? 'bg-[#009574] text-white font-semibold' :
                        isToday ? 'border border-[#009574] text-[#009574]' :
                        isDis ? 'text-[#E5E7EB] cursor-not-allowed' :
                        'hover:bg-[#e6f5f1] text-[#333333]'}`}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MiniDatePicker ───────────────────────────────────────────────────────────
export function MiniDatePicker({ value, onChange, disabled = false }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const parsed = parseDate(value)
  const [viewYear, setViewYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : today.getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const weeks = buildCalendar(viewYear, viewMonth)

  if (disabled) {
    return <div className="px-2 py-1 text-[12px] border border-[#E5E7EB] rounded bg-[#F8F9FA] text-[#6B7280] w-28">{value || '—'}</div>
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="px-2 py-1 text-[12px] border border-[#E5E7EB] rounded bg-white text-[#333333] hover:border-[#009574] focus:outline-none w-28 text-left"
      >
        {value || 'dd/MM/yyyy'}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-xl p-3 w-60">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-[#F8F9FA]"><ChevronLeft size={13} /></button>
            <span className="text-[12px] font-semibold text-[#333333]">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-[#F8F9FA]"><ChevronRight size={13} /></button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => <div key={d} className="text-[9px] font-semibold text-[#6B7280] text-center">{d}</div>)}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day, di) => {
                if (!day) return <div key={di} />
                const isSelected = parsed && day.toDateString() === parsed.toDateString()
                return (
                  <button
                    key={di}
                    type="button"
                    onClick={() => { onChange(formatDate(day)); setOpen(false) }}
                    className={`text-[11px] h-6 w-6 mx-auto rounded-full flex items-center justify-center transition-colors
                      ${isSelected ? 'bg-[#009574] text-white font-semibold' : 'hover:bg-[#e6f5f1] text-[#333333]'}`}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Switch ───────────────────────────────────────────────────────────────────
export function Switch({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#009574]/30
        ${checked ? 'bg-[#009574]' : 'bg-[#E5E7EB]'}
        ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

// ─── ActionBtn ────────────────────────────────────────────────────────────────
export function ActionBtn({ icon, tooltip, onClick, danger = false, disabled = false }: {
  icon: React.ReactNode
  tooltip: string
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <div className="relative group inline-block">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`p-1.5 rounded-md transition-colors
          ${danger ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-[#6B7280] hover:text-[#009574] hover:bg-[#e6f5f1]'}
          ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
      >
        {icon}
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#333333] text-white text-[11px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
        {tooltip}
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className="fixed top-4 right-4 z-[200] flex items-center gap-3 bg-white border border-emerald-200 shadow-lg rounded-lg px-4 py-3 animate-in slide-in-from-top-2">
      <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
      <span className="text-[13px] font-medium text-[#333333]">{message}</span>
      <button onClick={onClose} className="ml-1 text-[#6B7280] hover:text-[#333333]"><X size={14} /></button>
    </div>
  )
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
export function ConfirmModal({ title, message, confirmLabel = 'Confirmar', onConfirm, onCancel }: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-sm mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#333333] mb-1">{title}</h3>
            <p className="text-[13px] text-[#6B7280]">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-[13px] font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-md transition-colors">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ModeSwitcher ─────────────────────────────────────────────────────────────
export function ModeSwitcher({ mode, registerUrl, formUrl }: {
  mode: 'register' | 'view' | 'edit'
  registerUrl: string
  formUrl: (mode: 'view' | 'edit') => string
}) {
  const navigate = useNavigate()
  const tabs = [
    { key: 'register' as const, label: 'Registrar', icon: <RotateCcw size={12} /> },
    { key: 'view' as const, label: 'Ver', icon: <Eye size={12} /> },
    { key: 'edit' as const, label: 'Editar', icon: <Pencil size={12} /> },
  ]
  return (
    <div className="inline-flex items-center border border-[#E5E7EB] rounded-lg overflow-hidden text-[12px]">
      {tabs.map(t => (
        <button
          key={t.key}
          type="button"
          onClick={() => navigate(t.key === 'register' ? registerUrl : formUrl(t.key))}
          className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors
            ${mode === t.key ? 'bg-[#009574] text-white' : 'bg-white text-[#6B7280] hover:bg-[#F8F9FA]'}`}
        >
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  )
}
