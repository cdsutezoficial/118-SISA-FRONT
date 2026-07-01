import { useState, useRef, useEffect } from 'react'
import {
  ChevronRight, Info, AlertCircle,
  Plus, Trash2, Pencil, X, ChevronDown, Search,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'
import type { FormMode } from '../shared/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string }

interface RangoRow {
  id: string
  desde: string
  hasta: string
  letra: string
  descripcion: string
  aprobatorio: boolean
}

interface EscalaFormState {
  clasificacion: string
  calMin: string
  calMax: string
}

interface EscalaErrors {
  clasificacion?: string
  calMin?: string
  calMax?: string
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const clasificacionOptions: SelectOption[] = [
  { value: 'Básica',            label: 'Básica' },
  { value: 'Integradora',       label: 'Integradora' },
  { value: 'Ciencias Básicas',  label: 'Ciencias Básicas' },
  { value: 'Lengua Extranjera', label: 'Lengua Extranjera' },
  { value: 'Especialidad',      label: 'Especialidad' },
  { value: 'Transversal',       label: 'Transversal' },
]

const clasificacionStyle: Record<string, string> = {
  'Básica':            'bg-blue-50 text-blue-700 border border-blue-200',
  'Integradora':       'bg-teal-50 text-teal-700 border border-teal-200',
  'Ciencias Básicas':  'bg-violet-50 text-violet-700 border border-violet-200',
  'Lengua Extranjera': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Especialidad':      'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Transversal':       'bg-gray-100 text-gray-600 border border-gray-200',
}

const emptyForm: EscalaFormState = { clasificacion: '', calMin: '', calMax: '' }

const preloadedForm: EscalaFormState = { clasificacion: 'Básica', calMin: '0', calMax: '100' }

const preloadedRangos: RangoRow[] = [
  { id: '1', desde: '0',  hasta: '69',  letra: 'NA', descripcion: 'No Aprobatorio', aprobatorio: false },
  { id: '2', desde: '70', hasta: '84',  letra: 'SA', descripcion: 'Satisfactorio',  aprobatorio: true  },
  { id: '3', desde: '85', hasta: '100', letra: 'CO', descripcion: 'Competente',     aprobatorio: true  },
]

function newRango(): RangoRow {
  return { id: crypto.randomUUID(), desde: '', hasta: '', letra: '', descripcion: '', aprobatorio: false }
}

// ─── SearchSelect ──────────────────────────────────────────────────────────────

function SearchSelect({ options, value, onChange, placeholder, disabled, hasError }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void
  placeholder: string; disabled?: boolean; hasError?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])
  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
  const selected = options.find(o => o.value === value)

  if (disabled) {
    return (
      <div className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md text-[#6B7280] cursor-not-allowed select-none">
        {selected ? (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${clasificacionStyle[selected.value] ?? ''}`}>{selected.label}</span>
        ) : <span>{placeholder}</span>}
        <ChevronDown size={14} className="text-[#E5E7EB] flex-shrink-0" />
      </div>
    )
  }

  const border = hasError
    ? 'border-red-400'
    : 'border-[#E5E7EB] hover:border-[#009574]/50 focus-within:ring-2 focus-within:ring-[#009574]/30 focus-within:border-[#009574]'

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => { setOpen(!open); setQuery('') }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-white border rounded-md text-left outline-none transition ${border}`}>
        {selected ? (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${clasificacionStyle[selected.value] ?? 'bg-gray-100 text-gray-600'}`}>{selected.label}</span>
        ) : (
          <span className="text-[#6B7280]">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onChange('') }} onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onChange(''))} className="text-[#6B7280] hover:text-[#333333] p-0.5 rounded"><X size={12} /></span>}
          <ChevronDown size={14} className={`text-[#6B7280] transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-[#E5E7EB]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar clasificación..."
                className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:border-[#009574]" />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-3 py-2 text-[12px] text-[#6B7280] text-center">Sin resultados</li>
              : filtered.map(o => (
                <li key={o.value}>
                  <button type="button" onClick={() => { onChange(o.value); setOpen(false) }}
                    className={`w-full text-left px-3 py-2 transition-colors ${value === o.value ? 'bg-[#e6f5f1]' : 'hover:bg-[#F8F9FA]'}`}>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${clasificacionStyle[o.value] ?? 'bg-gray-100 text-gray-600'}`}>{o.label}</span>
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

// ─── Switch ─────────────────────────────────────────────────────────────────────

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:ring-offset-1 ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      } ${checked ? 'bg-[#009574]' : 'bg-[#E5E7EB]'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

// ─── Field helpers ─────────────────────────────────────────────────────────────

function Label({ label, required, htmlFor }: { label: string; required?: boolean; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[13px] font-medium text-[#333333] mb-1">
      {label}{required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  )
}
function FieldHelp({ text }: { text: string }) {
  return <p className="mt-1 flex items-center gap-1 text-[12px] text-[#6B7280]"><Info size={12} />{text}</p>
}
function FieldError({ text }: { text: string }) {
  return <p className="mt-1 flex items-center gap-1 text-[12px] text-red-600"><AlertCircle size={12} />{text}</p>
}
function inputCls(disabled: boolean, hasError = false) {
  if (disabled) return 'w-full px-3 py-2 text-[13px] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md text-[#6B7280] cursor-not-allowed select-none'
  if (hasError) return 'w-full px-3 py-2 text-[13px] bg-white border border-red-400 rounded-md text-[#333333] focus:outline-none focus:ring-2 focus:ring-red-300 transition'
  return 'w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] hover:border-[#009574]/50 transition'
}

// ─── Section separator ─────────────────────────────────────────────────────────

function SectionSep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-[#E5E7EB]" />
    </div>
  )
}

// ─── Mode switcher ─────────────────────────────────────────────────────────────

function ModeSwitcher({ mode, onChange }: { mode: FormMode; onChange: (m: FormMode) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg text-[12px] font-medium">
      {(['register', 'view', 'edit'] as FormMode[]).map(m => (
        <button key={m} onClick={() => onChange(m)} className={`px-3 py-1 rounded-md transition-colors ${mode === m ? 'bg-white text-[#009574] shadow-sm border border-[#E5E7EB]' : 'text-[#6B7280] hover:text-[#333333]'}`}>
          {m === 'register' ? 'Registrar' : m === 'view' ? 'Ver detalle' : 'Editar'}
        </button>
      ))}
    </div>
  )
}

// ─── Range bar preview ─────────────────────────────────────────────────────────

function RangeBar({ rangos, calMin, calMax }: { rangos: RangoRow[]; calMin: string; calMax: string }) {
  const min = Number(calMin)
  const max = Number(calMax)
  if (!calMin || !calMax || isNaN(min) || isNaN(max) || max <= min) return null
  const total = max - min
  const sorted = [...rangos]
    .filter(r => r.desde !== '' && r.hasta !== '')
    .sort((a, b) => Number(a.desde) - Number(b.desde))
  if (sorted.length === 0) return null

  const colors = ['bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-blue-400', 'bg-violet-400']

  return (
    <div className="mt-3 mb-1 px-1">
      <div className="flex h-6 rounded-lg overflow-hidden gap-px bg-[#E5E7EB]">
        {sorted.map((r, i) => {
          const width = ((Number(r.hasta) - Number(r.desde)) / total) * 100
          const color = r.aprobatorio ? colors[i % 2 === 0 ? 2 : 3] : colors[0]
          return (
            <div
              key={r.id}
              className={`relative flex items-center justify-center text-white text-[10px] font-bold ${color} transition-all`}
              style={{ width: `${width}%` }}
              title={`${r.desde}–${r.hasta}: ${r.descripcion}`}
            >
              {width > 8 && r.letra}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-0.5 text-[10px] text-[#6B7280] tabular-nums">
        <span>{calMin}</span>
        <span>{calMax}</span>
      </div>
    </div>
  )
}

// ─── Rango row ─────────────────────────────────────────────────────────────────

function RangoRowComp({ row, index, onChange, onRemove, disabled }: {
  row: RangoRow; index: number
  onChange: (u: RangoRow) => void
  onRemove: () => void
  disabled: boolean
}) {
  const [showTip, setShowTip] = useState(false)
  function cellInput(field: keyof RangoRow, type = 'text', extra = '') {
    const val = row[field] as string
    if (disabled) {
      return <span className={`text-[13px] text-[#333333] ${extra}`}>{val || '—'}</span>
    }
    return (
      <input
        type={type}
        value={val}
        placeholder={type === 'number' ? '0' : field === 'letra' ? 'Ej. NA' : 'Descripción'}
        maxLength={field === 'letra' ? 4 : undefined}
        onChange={e => onChange({ ...row, [field]: type === 'text' && field === 'letra' ? e.target.value.toUpperCase() : e.target.value })}
        className={`w-full px-2.5 py-2 text-[12px] border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:border-[#009574] focus:ring-1 focus:ring-[#009574]/20 hover:border-[#009574]/40 transition bg-white ${extra}`}
      />
    )
  }

  return (
    <tr className="border-b border-[#E5E7EB] last:border-0 group hover:bg-[#FAFAFA] transition-colors">
      <td className="px-3 py-2 text-[#6B7280] text-[12px] font-medium w-8 text-center">{index + 1}</td>
      <td className="px-2 py-2 w-24">{cellInput('desde', 'number', 'tabular-nums')}</td>
      <td className="px-2 py-2 w-24">{cellInput('hasta', 'number', 'tabular-nums')}</td>
      <td className="px-2 py-2 w-24">
        {disabled
          ? <span className="inline-block font-mono font-bold text-[13px] px-2 py-0.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded text-[#333333]">{row.letra || '—'}</span>
          : <input
              type="text" value={row.letra} maxLength={4}
              placeholder="Ej. NA"
              onChange={e => onChange({ ...row, letra: e.target.value.toUpperCase() })}
              className="w-full px-2.5 py-2 text-[12px] font-mono uppercase tracking-widest text-center border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:border-[#009574] focus:ring-1 focus:ring-[#009574]/20 hover:border-[#009574]/40 transition bg-white"
            />
        }
      </td>
      <td className="px-2 py-2">{cellInput('descripcion')}</td>
      <td className="px-3 py-2 w-28">
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${row.aprobatorio ? 'bg-emerald-50' : 'bg-[#F8F9FA]'}`}>
          <Switch checked={row.aprobatorio} onChange={v => onChange({ ...row, aprobatorio: v })} disabled={disabled} />
          <span className={`text-[11px] font-medium ${row.aprobatorio ? 'text-emerald-700' : 'text-[#6B7280]'}`}>
            {row.aprobatorio ? 'Sí' : 'No'}
          </span>
        </div>
      </td>
      <td className="px-2 py-2 w-10">
        {!disabled && (
          <div className="relative inline-flex">
            <button type="button" onClick={onRemove}
              onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}
              className="p-1.5 rounded-md text-[#6B7280] hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
              <Trash2 size={14} />
            </button>
            {showTip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#333333] text-white text-[11px] rounded whitespace-nowrap pointer-events-none z-50">
                Eliminar rango
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#333333]" />
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function EscalaForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const [form, setForm] = useState<EscalaFormState>(mode === 'register' ? { ...emptyForm } : { ...preloadedForm })
  const [rangos, setRangos] = useState<RangoRow[]>(mode === 'register' ? [newRango()] : preloadedRangos.map(r => ({ ...r })))
  const [errors, setErrors] = useState<EscalaErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const isView = mode === 'view'
  const isDisabled = isView

  function handleModeChange(m: FormMode) {
    if (m === 'register') navigate('/escalas/new')
    else navigate(`/escalas/form?mode=${m}${id ? `&id=${id}` : ''}`)
  }

  function clearErr(field: keyof EscalaErrors) {
    if (submitted) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): EscalaErrors {
    const e: EscalaErrors = {}
    if (!form.clasificacion) e.clasificacion = 'Selecciona una clasificación.'
    if (!form.calMin.trim()) e.calMin = 'La calificación mínima es obligatoria.'
    if (!form.calMax.trim()) e.calMax = 'La calificación máxima es obligatoria.'
    else if (Number(form.calMax) <= Number(form.calMin)) e.calMax = 'Debe ser mayor que la mínima.'
    return e
  }

  function handleSubmit() {
    const e = validate()
    setSubmitted(true)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setErrors({})
    navigate('/escalas', { state: { toast: mode === 'register' ? 'Escala de calificación registrada exitosamente.' : 'Escala actualizada exitosamente.' } })
  }

  const breadcrumbLabel = mode === 'register' ? 'Registrar Escala' : mode === 'view' ? 'Ver Detalle' : 'Editar Escala'
  const title = mode === 'register' ? 'Registrar Escala de Calificación' : mode === 'view' ? 'Detalle de Escala de Calificación' : 'Editar Escala de Calificación'
  const desc = mode === 'register'
    ? 'Define los rangos numéricos y su equivalencia en letra para una clasificación de materia dentro de este plan.'
    : mode === 'view'
    ? 'Información de la escala en modo solo lectura.'
    : 'Modifica los rangos y nomenclatura de esta escala.'

  return (
    <div className="max-w-[960px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4 flex-wrap">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/planes')} className="hover:text-[#009574] transition-colors">Planes de Estudio</button>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/planes/detalle')} className="hover:text-[#009574] transition-colors font-mono text-[12px]">IDGS-2022</button>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/escalas')} className="hover:text-[#009574] transition-colors">Escalas de Calificación</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">{breadcrumbLabel}</span>
      </nav>

      {/* Title row */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">{title}</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">{desc}</p>
        </div>
        <div className="mt-1"><ModeSwitcher mode={mode} onChange={handleModeChange} /></div>
      </div>

      <hr className="border-[#E5E7EB] my-6" />

      <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
        {isView && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-md px-4 py-3 mb-6 text-[13px] text-blue-700">
            <Info size={15} className="flex-shrink-0 mt-0.5" />
            <span>Estás viendo el detalle de la escala. Para realizar cambios, usa el botón <strong>Editar</strong>.</span>
          </div>
        )}

        {/* ── Sección 1: Configuración General ── */}
        <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Configuración General</p>

        <div className="grid grid-cols-12 gap-6 mb-2">
          {/* Clasificación (6) */}
          <div className="col-span-12 md:col-span-6">
            <Label label="Clasificación de Materia" required htmlFor="clasificacion" />
            <SearchSelect
              options={clasificacionOptions} value={form.clasificacion}
              onChange={v => { setForm({ ...form, clasificacion: v }); clearErr('clasificacion') }}
              placeholder="Selecciona la clasificación" disabled={isDisabled} hasError={!!errors.clasificacion}
            />
            {errors.clasificacion && <FieldError text={errors.clasificacion} />}
          </div>

          {/* Cal mínima (3) */}
          <div className="col-span-6 md:col-span-3">
            <Label label="Calificación Mínima" required htmlFor="calMin" />
            <input id="calMin" type="number" min={0} disabled={isDisabled}
              placeholder="Ej. 0" value={form.calMin}
              onChange={e => { setForm({ ...form, calMin: e.target.value }); clearErr('calMin') }}
              className={`${inputCls(isDisabled, !!errors.calMin)} tabular-nums`} />
            {errors.calMin ? <FieldError text={errors.calMin} /> : <FieldHelp text="Valor numérico mínimo válido para esta escala" />}
          </div>

          {/* Cal máxima (3) */}
          <div className="col-span-6 md:col-span-3">
            <Label label="Calificación Máxima" required htmlFor="calMax" />
            <input id="calMax" type="number" min={0} disabled={isDisabled}
              placeholder="Ej. 100" value={form.calMax}
              onChange={e => { setForm({ ...form, calMax: e.target.value }); clearErr('calMax') }}
              className={`${inputCls(isDisabled, !!errors.calMax)} tabular-nums`} />
            {errors.calMax ? <FieldError text={errors.calMax} /> : <FieldHelp text="Valor numérico máximo válido para esta escala" />}
          </div>
        </div>

        {/* ── Sección 2: Rangos y Nomenclatura ── */}
        <SectionSep label="Rangos y Nomenclatura" />

        <div className="flex items-start gap-2 text-[12px] text-[#6B7280] mb-4">
          <Info size={13} className="text-[#009574] flex-shrink-0 mt-0.5" />
          Define cada tramo de calificación con su letra equivalente. Al registrar una calificación, el sistema asignará automáticamente la letra del rango que la contenga.
        </div>

        {/* Range preview bar */}
        {(form.calMin !== '' && form.calMax !== '') && (
          <RangeBar rangos={rangos} calMin={form.calMin} calMax={form.calMax} />
        )}

        {/* Rangos table */}
        <div className="border border-[#E5E7EB] rounded-lg overflow-hidden mt-4">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                <th className="px-3 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-8 text-center">#</th>
                <th className="px-2 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider text-left w-24">Desde</th>
                <th className="px-2 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider text-left w-24">Hasta</th>
                <th className="px-2 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider text-left w-24">Letra</th>
                <th className="px-2 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider text-left">Descripción</th>
                <th className="px-3 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider text-left w-28">¿Aprobatorio?</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rangos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center">
                    <p className="text-[12px] text-[#6B7280]">Sin rangos. Agrega al menos uno para continuar.</p>
                  </td>
                </tr>
              ) : (
                rangos.map((row, idx) => (
                  <RangoRowComp
                    key={row.id} row={row} index={idx}
                    onChange={updated => setRangos(prev => prev.map(r => r.id === row.id ? updated : r))}
                    onRemove={() => setRangos(prev => prev.filter(r => r.id !== row.id))}
                    disabled={isDisabled}
                  />
                ))
              )}
            </tbody>
          </table>

          {!isDisabled && (
            <div className="border-t border-[#E5E7EB] px-3 py-2.5">
              <button type="button" onClick={() => setRangos(prev => [...prev, newRango()])}
                className="flex items-center gap-1.5 text-[12px] font-medium text-[#009574] hover:text-[#007a5e] transition-colors">
                <Plus size={14} />Agregar Rango
              </button>
            </div>
          )}
        </div>

        {/* Rangos summary */}
        {rangos.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#6B7280]">
            <span>
              {rangos.filter(r => r.aprobatorio).length} aprobatorio{rangos.filter(r => r.aprobatorio).length !== 1 ? 's' : ''},&nbsp;
              {rangos.filter(r => !r.aprobatorio).length} no aprobatorio{rangos.filter(r => !r.aprobatorio).length !== 1 ? 's' : ''}
            </span>
            <span>{rangos.length} rango{rangos.length !== 1 ? 's' : ''} configurado{rangos.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Action zone */}
      <div className="flex items-center justify-end gap-3 mt-6">
        {isView ? (
          <>
            <button onClick={() => navigate('/escalas')}
              className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              Regresar
            </button>
            <button onClick={() => handleModeChange('edit')}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Pencil size={14} />Editar
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/escalas')}
              className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              Cancelar
            </button>
            <button onClick={handleSubmit}
              className="px-5 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              {mode === 'register' ? 'Registrar Escala' : 'Guardar Cambios'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
