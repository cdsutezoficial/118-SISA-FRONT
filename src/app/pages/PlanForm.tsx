import { useState, useRef, useEffect } from 'react'
import {
  ChevronRight, Info, AlertCircle, CheckCircle2,
  Plus, Trash2, Sparkles, X, ChevronDown, Search, Pencil,
} from 'lucide-react'
import type { NavigateFn, FormMode } from '../shared/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string }

interface NivelRow {
  id: string
  nombre: string
  tipo: string
}

interface PlanForm {
  programa: string
  anio: string
  clave: string
  nombre: string
  calAprobatoria: string
}

interface PlanErrors {
  programa?: string
  anio?: string
  clave?: string
  nombre?: string
  calAprobatoria?: string
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const programaOptions: SelectOption[] = [
  { value: 'IDGS', label: 'Ing. en Desarrollo y Gestión de Software' },
  { value: 'IRT',  label: 'Ing. en Redes y Telecomunicaciones' },
  { value: 'II',   label: 'Ingeniería Industrial' },
  { value: 'AGE',  label: 'Administración y Gestión Empresarial' },
]

const tipoNivelOptions: SelectOption[] = [
  { value: 'TSU',                     label: 'TSU' },
  { value: 'Continuidad Ingeniería',  label: 'Continuidad Ingeniería' },
  { value: 'Continuidad Licenciatura',label: 'Continuidad Licenciatura' },
  { value: 'Otro',                    label: 'Otro' },
]

const tipoNivelStyle: Record<string, string> = {
  'TSU':                      'bg-violet-50 text-violet-700 border border-violet-200',
  'Continuidad Ingeniería':   'bg-blue-50 text-blue-700 border border-blue-200',
  'Continuidad Licenciatura': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Otro':                     'bg-gray-100 text-gray-600 border border-gray-200',
}

const emptyForm: PlanForm = {
  programa: '', anio: '', clave: '', nombre: '', calAprobatoria: '',
}
const preloadedForm: PlanForm = {
  programa: 'IDGS', anio: '2022', clave: 'IDGS-2022',
  nombre: 'Plan de Estudios IDGS 2022', calAprobatoria: '70',
}
const preloadedNiveles: NivelRow[] = [
  { id: '1', nombre: '1er Cuatrimestre TSU',  tipo: 'TSU' },
  { id: '2', nombre: '2do Cuatrimestre TSU',  tipo: 'TSU' },
  { id: '3', nombre: '3er Cuatrimestre TSU',  tipo: 'TSU' },
  { id: '4', nombre: '4to Cuatrimestre TSU',  tipo: 'TSU' },
  { id: '5', nombre: '5to Cuatrimestre TSU',  tipo: 'TSU' },
  { id: '6', nombre: '6to Cuatrimestre TSU',  tipo: 'TSU' },
  { id: '7', nombre: '7mo Cuatrimestre — Continuidad Ing.',  tipo: 'Continuidad Ingeniería' },
  { id: '8', nombre: '8vo Cuatrimestre — Continuidad Ing.',  tipo: 'Continuidad Ingeniería' },
  { id: '9', nombre: '9no Cuatrimestre — Continuidad Ing.',  tipo: 'Continuidad Ingeniería' },
  { id: '10', nombre: '10mo Cuatrimestre — Continuidad Ing.', tipo: 'Continuidad Ingeniería' },
  { id: '11', nombre: '11vo Cuatrimestre — Continuidad Ing.', tipo: 'Continuidad Ingeniería' },
]

function newNivel(): NivelRow {
  return { id: crypto.randomUUID(), nombre: '', tipo: 'TSU' }
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
  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()) || o.value.toLowerCase().includes(query.toLowerCase()))
  const selected = options.find(o => o.value === value)

  if (disabled) {
    return (
      <div className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md text-[#6B7280] cursor-not-allowed select-none">
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown size={14} className="text-[#E5E7EB] flex-shrink-0" />
      </div>
    )
  }
  const border = hasError ? 'border-red-400' : 'border-[#E5E7EB] hover:border-[#009574]/50 focus-within:ring-2 focus-within:ring-[#009574]/30 focus-within:border-[#009574]'
  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => { setOpen(!open); setQuery('') }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-white border rounded-md text-left outline-none transition ${border}`}>
        <span className={`truncate ${selected ? 'text-[#333333]' : 'text-[#6B7280]'}`}>{selected?.label ?? placeholder}</span>
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

// ─── Nivel tipo select (compact) ───────────────────────────────────────────────

function TipoSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])
  const selected = tipoNivelOptions.find(o => o.value === value)
  if (disabled) {
    return (
      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${tipoNivelStyle[value] ?? tipoNivelStyle['Otro']}`}>{value}</span>
    )
  }
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-md hover:border-[#009574]/50 focus:outline-none transition">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tipoNivelStyle[value] ?? tipoNivelStyle['Otro']}`}>{selected?.label ?? 'Tipo'}</span>
        <ChevronDown size={12} className={`text-[#6B7280] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-52 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 py-1">
          {tipoNivelOptions.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${value === o.value ? 'bg-[#e6f5f1]' : 'hover:bg-[#F8F9FA]'}`}>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tipoNivelStyle[o.value]}`}>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
function inputCls(disabled: boolean, hasError: boolean) {
  if (disabled) return 'w-full px-3 py-2 text-[13px] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md text-[#6B7280] cursor-not-allowed select-none'
  if (hasError) return 'w-full px-3 py-2 text-[13px] bg-white border border-red-400 rounded-md text-[#333333] focus:outline-none focus:ring-2 focus:ring-red-300 transition'
  return 'w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] hover:border-[#009574]/50 transition'
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed top-5 right-5 z-[100] flex items-center gap-3 bg-white border border-emerald-200 shadow-lg rounded-lg px-4 py-3">
      <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
      <span className="text-[13px] font-medium text-[#333333]">{message}</span>
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

// ─── Section separator ─────────────────────────────────────────────────────────

function SectionSep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-[#E5E7EB]" />
    </div>
  )
}

// ─── NivelRow ──────────────────────────────────────────────────────────────────

function NivelRowComp({ row, index, onChange, onRemove, disabled }: {
  row: NivelRow; index: number
  onChange: (updated: NivelRow) => void
  onRemove: () => void
  disabled: boolean
}) {
  const [showTip, setShowTip] = useState(false)
  return (
    <tr className="border-b border-[#E5E7EB] last:border-0 group hover:bg-[#FAFAFA] transition-colors">
      <td className="px-4 py-2.5 text-[#6B7280] text-[12px] font-medium w-10">{index + 1}</td>
      <td className="px-3 py-2 flex-1">
        {disabled ? (
          <span className="text-[13px] font-medium text-[#333333]">{row.nombre}</span>
        ) : (
          <input
            type="text"
            placeholder="Ej. 1er Cuatrimestre TSU"
            value={row.nombre}
            onChange={e => onChange({ ...row, nombre: e.target.value })}
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] hover:border-[#009574]/50 transition"
          />
        )}
      </td>
      <td className="px-3 py-2 w-60">
        <TipoSelect value={row.tipo} onChange={v => onChange({ ...row, tipo: v })} disabled={disabled} />
      </td>
      <td className="px-3 py-2 w-12">
        {!disabled && (
          <div className="relative inline-flex">
            <button
              type="button"
              onClick={onRemove}
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              className="p-1.5 rounded-md text-[#6B7280] hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={14} />
            </button>
            {showTip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#333333] text-white text-[11px] rounded whitespace-nowrap pointer-events-none z-50">
                Eliminar nivel
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

interface Props { navigate: NavigateFn; mode: FormMode }

export default function PlanForm({ navigate, mode: initialMode }: Props) {
  const [mode, setMode] = useState<FormMode>(initialMode)
  const [form, setForm] = useState<PlanForm>(initialMode === 'register' ? { ...emptyForm } : { ...preloadedForm })
  const [niveles, setNiveles] = useState<NivelRow[]>(initialMode === 'register' ? [newNivel()] : preloadedNiveles.map(n => ({ ...n })))
  const [errors, setErrors] = useState<PlanErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const isView = mode === 'view'
  const isDisabled = isView

  // Auto-suggest clave when programa + anio are filled
  const suggestedClave = form.programa && form.anio ? `${form.programa}-${form.anio}` : null
  const showSuggestion = suggestedClave && form.clave !== suggestedClave && !isDisabled && mode === 'register'

  function handleModeChange(m: FormMode) {
    setMode(m)
    setErrors({})
    setSubmitted(false)
    if (m === 'register') { setForm({ ...emptyForm }); setNiveles([newNivel()]) }
    else { setForm({ ...preloadedForm }); setNiveles(preloadedNiveles.map(n => ({ ...n }))) }
  }

  function clearErr(field: keyof PlanErrors) {
    if (submitted) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): PlanErrors {
    const e: PlanErrors = {}
    if (!form.programa) e.programa = 'Selecciona el programa educativo.'
    if (!form.anio.trim()) e.anio = 'El año de vigencia es obligatorio.'
    else if (isNaN(Number(form.anio)) || Number(form.anio) < 2000) e.anio = 'Ingresa un año válido (ej. 2022).'
    if (!form.clave.trim()) e.clave = 'La clave del plan es obligatoria.'
    if (!form.nombre.trim()) e.nombre = 'El nombre del plan es obligatorio.'
    if (!form.calAprobatoria.trim()) e.calAprobatoria = 'Campo obligatorio.'
    else if (isNaN(Number(form.calAprobatoria)) || Number(form.calAprobatoria) < 0) e.calAprobatoria = 'Ingresa un valor numérico válido.'
    return e
  }

  function handleSubmit() {
    const e = validate()
    setSubmitted(true)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setErrors({})
    if (mode === 'register') {
      navigate({ page: 'plan-detalle', pendingToast: 'Plan registrado. Ahora asigna materias a cada nivel.' })
    } else {
      navigate({ page: 'planes-list', pendingToast: 'Plan de estudios actualizado exitosamente.' })
    }
  }

  const breadcrumbLabel = mode === 'register' ? 'Registrar Plan' : mode === 'view' ? 'Ver Detalle' : 'Editar Plan'
  const title = mode === 'register' ? 'Registrar Plan de Estudios' : mode === 'view' ? 'Detalle del Plan de Estudios' : 'Editar Plan de Estudios'
  const desc = mode === 'register'
    ? 'Define un nuevo plan de estudios para un programa educativo, sus niveles y las materias que los componen.'
    : mode === 'view'
    ? 'Información del plan en modo solo lectura.'
    : 'Modifica el plan de estudios y sus niveles.'

  return (
    <div className="max-w-[960px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} />}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate({ page: 'dashboard' })} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate({ page: 'planes-list' })} className="hover:text-[#009574] transition-colors">Planes de Estudio</button>
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
            <span>Estás viendo el detalle del plan. Para realizar cambios, usa el botón <strong>Editar</strong>.</span>
          </div>
        )}

        {/* ── Sección 1: Datos del Plan ── */}
        <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Datos del Plan</p>

        {/* Fila 1: Programa (8) + Año (4) */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          <div className="col-span-12 md:col-span-8">
            <Label label="Programa Educativo" required htmlFor="programa" />
            <SearchSelect
              options={programaOptions} value={form.programa}
              onChange={v => { setForm({ ...form, programa: v }); clearErr('programa') }}
              placeholder="Selecciona el programa" disabled={isDisabled} hasError={!!errors.programa}
            />
            {errors.programa && <FieldError text={errors.programa} />}
          </div>
          <div className="col-span-12 md:col-span-4">
            <Label label="Año de Vigencia" required htmlFor="anio" />
            <input id="anio" type="number" min={2000} max={2099} disabled={isDisabled}
              placeholder="Ej. 2022" value={form.anio}
              onChange={e => { setForm({ ...form, anio: e.target.value }); clearErr('anio') }}
              className={`${inputCls(isDisabled, !!errors.anio)} tabular-nums`} />
            {errors.anio ? <FieldError text={errors.anio} /> : <FieldHelp text="Año a partir del cual aplica este plan" />}
          </div>
        </div>

        {/* Fila 2: Clave (4) + Nombre (8) */}
        <div className="grid grid-cols-12 gap-6 mb-2">
          <div className="col-span-12 md:col-span-4">
            <Label label="Clave del Plan" required htmlFor="clave" />
            <input id="clave" type="text" disabled={isDisabled}
              placeholder="Ej. IDGS-2022" value={form.clave}
              onChange={e => { setForm({ ...form, clave: e.target.value.toUpperCase() }); clearErr('clave') }}
              className={`${inputCls(isDisabled, !!errors.clave)} font-mono uppercase tracking-widest`} />
            {errors.clave
              ? <FieldError text={errors.clave} />
              : showSuggestion
              ? (
                <button type="button" onClick={() => setForm(f => ({ ...f, clave: suggestedClave! }))}
                  className="mt-1 flex items-center gap-1 text-[12px] text-[#009574] hover:text-[#007a5e] transition-colors">
                  <Sparkles size={11} />
                  Usar <span className="font-mono font-semibold">{suggestedClave}</span>
                </button>
              )
              : <FieldHelp text="Se sugiere generar como: CLAVE_PROGRAMA-AÑO" />
            }
          </div>
          <div className="col-span-12 md:col-span-8">
            <Label label="Nombre del Plan" required htmlFor="nombre" />
            <input id="nombre" type="text" disabled={isDisabled}
              placeholder="Ej. Plan de Estudios IDGS 2022" value={form.nombre}
              onChange={e => { setForm({ ...form, nombre: e.target.value }); clearErr('nombre') }}
              className={inputCls(isDisabled, !!errors.nombre)} />
            {errors.nombre && <FieldError text={errors.nombre} />}
          </div>
        </div>

        {/* ── Sección 2: Parámetros de Calificación ── */}
        <SectionSep label="Parámetros de Calificación" />

        <div className="grid grid-cols-12 gap-6 mb-4">
          <div className="col-span-12 md:col-span-4">
            <Label label="Mínima Aprobatoria" required htmlFor="calAprobatoria" />
            <input id="calAprobatoria" type="number" min={0} disabled={isDisabled}
              placeholder="Ej. 70" value={form.calAprobatoria}
              onChange={e => { setForm({ ...form, calAprobatoria: e.target.value }); clearErr('calAprobatoria') }}
              className={`${inputCls(isDisabled, !!errors.calAprobatoria)} tabular-nums`} />
            {errors.calAprobatoria
              ? <FieldError text={errors.calAprobatoria} />
              : <FieldHelp text="Calificación mínima para aprobar una materia en este plan" />
            }
          </div>
        </div>

        <div className="flex items-start gap-2 text-[12px] text-[#6B7280] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md px-3 py-2.5">
          <Info size={13} className="text-[#009574] flex-shrink-0 mt-0.5" />
          <span>
            Las escalas de calificación (rangos numéricos, letras y nomenclaturas por clasificación de materia) se configuran desde el detalle del plan, en la pestaña <strong className="text-[#333333]">Escalas de Calificación</strong>.
          </span>
        </div>

        {/* ── Sección 3: Niveles del Plan ── */}
        <SectionSep label="Niveles del Plan" />

        <div className="flex items-start gap-2 text-[12px] text-[#6B7280] mb-4">
          <Info size={13} className="text-[#009574] flex-shrink-0 mt-0.5" />
          Define los niveles académicos del plan. Cada nivel agrupa las materias de un periodo o cuatrimestre. Podrás asignar materias a cada nivel desde el detalle del plan.
        </div>

        {/* Niveles table */}
        <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-10">#</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nombre del Nivel</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-60">Tipo</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {niveles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center">
                    <div className="flex flex-col items-center gap-2 text-[#6B7280]">
                      <p className="text-[12px]">Sin niveles. Agrega al menos uno para continuar.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                niveles.map((row, idx) => (
                  <NivelRowComp
                    key={row.id} row={row} index={idx}
                    onChange={updated => setNiveles(prev => prev.map(n => n.id === row.id ? updated : n))}
                    onRemove={() => setNiveles(prev => prev.filter(n => n.id !== row.id))}
                    disabled={isDisabled}
                  />
                ))
              )}
            </tbody>
          </table>

          {!isDisabled && (
            <div className="border-t border-[#E5E7EB] px-4 py-2.5">
              <button type="button" onClick={() => setNiveles(prev => [...prev, newNivel()])}
                className="flex items-center gap-1.5 text-[12px] font-medium text-[#009574] hover:text-[#007a5e] transition-colors">
                <Plus size={14} />Agregar Nivel
              </button>
            </div>
          )}
        </div>

        {niveles.length > 0 && (
          <p className="mt-2 text-[11px] text-[#6B7280] text-right">
            {niveles.length} nivel{niveles.length !== 1 ? 'es' : ''} definido{niveles.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Action zone */}
      <div className="mt-6 flex flex-col gap-2">
        <div className="flex items-center justify-end gap-3">
          {isView ? (
            <>
              <button onClick={() => navigate({ page: 'planes-list' })}
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
              <button onClick={() => navigate({ page: 'planes-list' })}
                className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
                Cancelar
              </button>
              <button onClick={handleSubmit}
                className="px-5 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
                {mode === 'register' ? 'Registrar Plan' : 'Guardar Cambios'}
              </button>
            </>
          )}
        </div>
        {!isView && (
          <p className="text-[12px] text-[#6B7280] text-right">
            Una vez registrado el plan, podrás asignar materias a cada nivel desde la pantalla de detalle.
          </p>
        )}
      </div>
    </div>
  )
}
