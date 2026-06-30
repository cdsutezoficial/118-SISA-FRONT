import { useState, useRef, useEffect } from 'react'
import {
  ChevronRight, Info, AlertCircle, CheckCircle2, X, ChevronDown, Search, BookOpen, Layers,
} from 'lucide-react'
import type { NavigateFn } from '../shared/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string; meta?: string }

interface FormState {
  materia: string
  clasificacion: string
  unidades: string
  tipo: string
  ordenKardex: string
  recursable: boolean
}

interface FormErrors {
  materia?: string
  clasificacion?: string
  unidades?: string
  tipo?: string
  ordenKardex?: string
}

// ─── Data ──────────────────────────────────────────────────────────────────────

// materia.meta holds clasificacion default
const materiaOptions: SelectOption[] = [
  { value: 'FP-101',  label: 'Fundamentos de Programación',         meta: 'Básica' },
  { value: 'CAL-101', label: 'Cálculo Diferencial',                  meta: 'Ciencias Básicas' },
  { value: 'ALG-101', label: 'Álgebra Lineal',                       meta: 'Matemáticas' },
  { value: 'ING-101', label: 'Inglés I',                             meta: 'Lengua Extranjera' },
  { value: 'POO-201', label: 'Programación Orientada a Objetos',     meta: 'Básica' },
  { value: 'BD-201',  label: 'Bases de Datos I',                     meta: 'Especialidad' },
  { value: 'DW-301',  label: 'Desarrollo Web Frontend',              meta: 'Especialidad' },
  { value: 'GP-501',  label: 'Gestión de Proyectos',                 meta: 'Transversal' },
]

const clasificacionOptions: SelectOption[] = [
  { value: 'Básica',            label: 'Básica' },
  { value: 'Integradora',       label: 'Integradora' },
  { value: 'Ciencias Básicas',  label: 'Ciencias Básicas' },
  { value: 'Matemáticas',       label: 'Matemáticas' },
  { value: 'Lengua Extranjera', label: 'Lengua Extranjera' },
  { value: 'Especialidad',      label: 'Especialidad' },
  { value: 'Transversal',       label: 'Transversal' },
]

const tipoOptions: SelectOption[] = [
  { value: 'CORE',       label: 'Troncal (CORE)' },
  { value: 'ELECTIVE',   label: 'Optativa (ELECTIVE)' },
  { value: 'INTERNSHIP', label: 'Estadías (INTERNSHIP)' },
]

const clasificacionStyle: Record<string, string> = {
  'Básica':            'bg-blue-50 text-blue-700 border border-blue-200',
  'Integradora':       'bg-teal-50 text-teal-700 border border-teal-200',
  'Ciencias Básicas':  'bg-violet-50 text-violet-700 border border-violet-200',
  'Matemáticas':       'bg-rose-50 text-rose-700 border border-rose-200',
  'Lengua Extranjera': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Especialidad':      'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Transversal':       'bg-gray-100 text-gray-600 border border-gray-200',
}

const empty: FormState = {
  materia: '', clasificacion: '', unidades: '', tipo: 'CORE', ordenKardex: '', recursable: true,
}

// ─── SearchSelect ──────────────────────────────────────────────────────────────

function SearchSelect({ options, value, onChange, placeholder, disabled, hasError, showBadge }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void
  placeholder: string; disabled?: boolean; hasError?: boolean; showBadge?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase()) || o.value.toLowerCase().includes(query.toLowerCase())
  )
  const selected = options.find(o => o.value === value)

  if (disabled) {
    return (
      <div className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md text-[#6B7280] cursor-not-allowed select-none">
        <span className="truncate">{selected?.label ?? placeholder}</span>
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
        <span className={`truncate ${selected ? 'text-[#333333]' : 'text-[#6B7280]'}`}>
          {showBadge && selected
            ? <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${clasificacionStyle[selected.value] ?? 'bg-gray-100 text-gray-600'}`}>{selected.label}</span>
            : (selected?.label ?? placeholder)
          }
        </span>
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
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar..."
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{o.label}</span>
                      {o.meta && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${clasificacionStyle[o.meta] ?? 'bg-gray-100 text-gray-600'}`}>{o.meta}</span>
                      )}
                      {showBadge && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${clasificacionStyle[o.value] ?? 'bg-gray-100 text-gray-600'}`}>{o.label}</span>
                      )}
                    </div>
                    {!showBadge && <span className="font-mono text-[11px] text-[#6B7280]">{o.value}</span>}
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

function SimpleSelect({ options, value, onChange, placeholder, hasError }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void; placeholder: string; hasError?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])
  const selected = options.find(o => o.value === value)
  const border = hasError ? 'border-red-400' : 'border-[#E5E7EB] hover:border-[#009574]/50 focus-within:ring-2 focus-within:ring-[#009574]/30'
  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-white border rounded-md text-left outline-none transition ${border}`}>
        <span className={selected ? 'text-[#333333]' : 'text-[#6B7280]'}>{selected?.label ?? placeholder}</span>
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

// ─── Switch ─────────────────────────────────────────────────────────────────────

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:ring-offset-1 ${checked ? 'bg-[#009574]' : 'bg-[#E5E7EB]'}`}>
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
function inputCls(hasError = false) {
  if (hasError) return 'w-full px-3 py-2 text-[13px] bg-white border border-red-400 rounded-md text-[#333333] focus:outline-none focus:ring-2 focus:ring-red-300 transition'
  return 'w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] hover:border-[#009574]/50 transition'
}

// ─── Page ──────────────────────────────────────────────────────────────────────

interface Props { navigate: NavigateFn }

export default function AsignarMateria({ navigate }: Props) {
  const [form, setForm] = useState<FormState>({ ...empty })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  // Auto-preload clasificacion from materia selection
  function handleMateriaChange(v: string) {
    const mat = materiaOptions.find(m => m.value === v)
    setForm(f => ({ ...f, materia: v, clasificacion: mat?.meta ?? f.clasificacion }))
    if (submitted) setErrors(prev => ({ ...prev, materia: undefined }))
  }

  function clearErr(field: keyof FormErrors) {
    if (submitted) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!form.materia) e.materia = 'Selecciona una materia del catálogo.'
    if (!form.clasificacion) e.clasificacion = 'Selecciona la clasificación.'
    if (!form.unidades.trim()) e.unidades = 'Las unidades de evaluación son obligatorias.'
    else if (isNaN(Number(form.unidades)) || Number(form.unidades) < 1) e.unidades = 'Ingresa un número válido mayor a 0.'
    if (!form.tipo) e.tipo = 'Selecciona el tipo de materia.'
    if (!form.ordenKardex.trim()) e.ordenKardex = 'El orden en kardex es obligatorio.'
    else if (isNaN(Number(form.ordenKardex)) || Number(form.ordenKardex) < 1) e.ordenKardex = 'Ingresa un número válido mayor a 0.'
    return e
  }

  function handleSubmit() {
    const e = validate()
    setSubmitted(true)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    navigate({ page: 'plan-detalle', pendingToast: 'Materia asignada al nivel correctamente.' })
  }

  const selectedMateria = materiaOptions.find(m => m.value === form.materia)

  return (
    <div className="max-w-[860px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4 flex-wrap">
        <button onClick={() => navigate({ page: 'dashboard' })} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate({ page: 'planes-list' })} className="hover:text-[#009574] transition-colors">Planes de Estudio</button>
        <ChevronRight size={13} />
        <button onClick={() => navigate({ page: 'plan-detalle' })} className="hover:text-[#009574] transition-colors font-mono text-[12px]">IDGS-2022</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Asignar Materia</span>
      </nav>

      {/* Title */}
      <div className="mb-1">
        <h1 className="text-2xl font-semibold text-[#333333]">Asignar Materia al Nivel</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Selecciona una materia del catálogo y configura cómo se evaluará y mostrará dentro de este nivel del plan.
        </p>
      </div>

      <hr className="border-[#E5E7EB] my-6" />

      {/* Context card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg px-5 py-4 mb-6 flex items-center gap-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-[#e6f5f1]">
            <BookOpen size={16} className="text-[#009574]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-0.5">Plan</p>
            <p className="text-[13px] font-semibold text-[#333333]">
              <span className="font-mono mr-1.5">IDGS-2022</span>
              <span className="font-normal text-[#6B7280]">— Ingeniería en Desarrollo y Gestión de Software</span>
            </p>
          </div>
        </div>
        <div className="w-px h-8 bg-[#E5E7EB] flex-shrink-0" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-violet-50">
            <Layers size={16} className="text-violet-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-0.5">Nivel</p>
            <p className="text-[13px] font-semibold text-[#333333]">1er Cuatrimestre TSU</p>
          </div>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">

        {/* ── Sección 1: Materia ── */}
        <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Materia</p>

        <div className="grid grid-cols-12 gap-6 mb-6">
          {/* Materia (8) */}
          <div className="col-span-12 md:col-span-8">
            <Label label="Materia" required htmlFor="materia" />
            <SearchSelect
              options={materiaOptions}
              value={form.materia}
              onChange={handleMateriaChange}
              placeholder="Buscar materia del catálogo..."
            />
            {errors.materia
              ? <FieldError text={errors.materia} />
              : <FieldHelp text="Busca por nombre o clave" />
            }
          </div>

          {/* Clasificación (4) */}
          <div className="col-span-12 md:col-span-4">
            <Label label="Clasificación" required htmlFor="clasificacion" />
            <SearchSelect
              options={clasificacionOptions}
              value={form.clasificacion}
              onChange={v => { setForm(f => ({ ...f, clasificacion: v })); clearErr('clasificacion') }}
              placeholder="Selecciona clasificación"
              showBadge
            />
            {errors.clasificacion
              ? <FieldError text={errors.clasificacion} />
              : <FieldHelp text="Se precarga desde la materia; ajusta si aplica una diferente en este plan" />
            }
          </div>
        </div>

        {/* Materia preview card */}
        {selectedMateria && (
          <div className="flex items-center gap-3 bg-[#e6f5f1] border border-[#009574]/20 rounded-md px-4 py-2.5 mb-6">
            <div className="w-8 h-8 rounded-md bg-white border border-[#009574]/20 flex items-center justify-center flex-shrink-0">
              <BookOpen size={15} className="text-[#009574]" />
            </div>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-[13px] font-semibold text-[#333333] truncate">{selectedMateria.label}</span>
              <span className="font-mono text-[11px] bg-white border border-[#009574]/20 px-1.5 py-0.5 rounded text-[#009574] flex-shrink-0">{selectedMateria.value}</span>
              {form.clasificacion && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${clasificacionStyle[form.clasificacion] ?? 'bg-gray-100 text-gray-600'}`}>
                  {form.clasificacion}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Separador: Configuración en este Plan ── */}
        <div className="flex items-center gap-4 mb-6">
          <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">Configuración en este Plan</p>
          <div className="flex-1 h-px bg-[#E5E7EB]" />
        </div>

        {/* Fila 2: Unidades (3) + Tipo (4) + Orden (3) + Recursable (2) */}
        <div className="grid grid-cols-12 gap-6">
          {/* Unidades de Evaluación */}
          <div className="col-span-6 md:col-span-3">
            <Label label="Unidades de Evaluación" required htmlFor="unidades" />
            <input id="unidades" type="number" min={1} max={10}
              placeholder="Ej. 3" value={form.unidades}
              onChange={e => { setForm(f => ({ ...f, unidades: e.target.value })); clearErr('unidades') }}
              className={`${inputCls(!!errors.unidades)} tabular-nums`} />
            {errors.unidades
              ? <FieldError text={errors.unidades} />
              : <FieldHelp text="Número de parciales que registrará el docente" />
            }
          </div>

          {/* Tipo */}
          <div className="col-span-12 md:col-span-4">
            <Label label="Tipo" required htmlFor="tipo" />
            <SimpleSelect
              options={tipoOptions}
              value={form.tipo}
              onChange={v => { setForm(f => ({ ...f, tipo: v })); clearErr('tipo') }}
              placeholder="Selecciona el tipo"
              hasError={!!errors.tipo}
            />
            {errors.tipo && <FieldError text={errors.tipo} />}
          </div>

          {/* Orden en Kardex */}
          <div className="col-span-6 md:col-span-3">
            <Label label="Orden en Kardex" required htmlFor="ordenKardex" />
            <input id="ordenKardex" type="number" min={1}
              placeholder="Ej. 1" value={form.ordenKardex}
              onChange={e => { setForm(f => ({ ...f, ordenKardex: e.target.value })); clearErr('ordenKardex') }}
              className={`${inputCls(!!errors.ordenKardex)} tabular-nums`} />
            {errors.ordenKardex
              ? <FieldError text={errors.ordenKardex} />
              : <FieldHelp text="Posición en kardex y certificados de estudios" />
            }
          </div>

          {/* ¿Recursable? */}
          <div className="col-span-6 md:col-span-2 flex flex-col">
            <span className="block text-[13px] font-medium text-[#333333] mb-1">
              ¿Recursable?
            </span>
            <div className={`flex items-center gap-2 h-[38px] px-3 rounded-md border transition-colors ${form.recursable ? 'bg-[#e6f5f1] border-[#009574]/30' : 'bg-white border-[#E5E7EB]'}`}>
              <Switch checked={form.recursable} onChange={v => setForm(f => ({ ...f, recursable: v }))} />
              <span className={`text-[12px] font-medium ${form.recursable ? 'text-[#009574]' : 'text-[#6B7280]'}`}>
                {form.recursable ? 'Sí' : 'No'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action zone */}
      <div className="flex items-center justify-end gap-3 mt-6">
        <button
          onClick={() => navigate({ page: 'plan-detalle' })}
          className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          className="px-5 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
        >
          Asignar Materia
        </button>
      </div>
    </div>
  )
}
