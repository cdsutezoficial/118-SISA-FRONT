import { useState, useRef, useEffect } from 'react'
import { ChevronRight, Info, AlertCircle, X, ChevronDown, Search, UserCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string }

interface FormErrors {
  rol?: string
  division?: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const rolOptions: SelectOption[] = [
  { value: 'Administrador',          label: 'Administrador' },
  { value: 'Gestor Académico',        label: 'Gestor Académico' },
  { value: 'Docente',                 label: 'Docente' },
  { value: 'Jefatura de Estadías',    label: 'Jefatura de Estadías' },
  { value: 'Asistente de Estadías',   label: 'Asistente de Estadías' },
  { value: 'Director de División',    label: 'Director de División' },
]

const divisionOptions: SelectOption[] = [
  { value: 'DTI',  label: 'División de Tecnologías de la Información' },
  { value: 'DIIM', label: 'División de Ingeniería Industrial y Mecatrónica' },
  { value: 'DNGE', label: 'División de Negocios y Gestión Empresarial' },
  { value: 'DCS',  label: 'División de Ciencias de la Salud' },
]

const rolStyle: Record<string, string> = {
  'Administrador':          'bg-[#e6f5f1] text-[#009574] border border-[#009574]/30',
  'Gestor Académico':        'bg-teal-50 text-teal-700 border border-teal-200',
  'Docente':                 'bg-violet-50 text-violet-700 border border-violet-200',
  'Jefatura de Estadías':    'bg-blue-50 text-blue-700 border border-blue-200',
  'Asistente de Estadías':   'bg-amber-50 text-amber-700 border border-amber-200',
  'Director de División':    'bg-rose-50 text-rose-700 border border-rose-200',
}

// Roles that require a division scope
const SCOPED_ROLES = new Set(['Gestor Académico', 'Jefatura de Estadías', 'Asistente de Estadías', 'Director de División'])

// Roles that do NOT require scope (global access)
const GLOBAL_ROLES = new Set(['Administrador', 'Docente'])

// ─── SearchSelect ──────────────────────────────────────────────────────────────

function SearchSelect({ options, value, onChange, placeholder, hasError }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void
  placeholder: string; hasError?: boolean
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

  const border = hasError
    ? 'border-red-400'
    : 'border-[#E5E7EB] hover:border-[#009574]/50 focus-within:ring-2 focus-within:ring-[#009574]/30 focus-within:border-[#009574]'

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => { setOpen(!open); setQuery('') }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-white border rounded-md text-left outline-none transition ${border}`}>
        {selected ? (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${rolStyle[selected.value] ?? 'bg-gray-100 text-gray-600'}`}>
            {selected.label}
          </span>
        ) : (
          <span className="text-[#6B7280]">{placeholder}</span>
        )}
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
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar rol..."
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
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${rolStyle[o.value] ?? 'bg-gray-100 text-gray-600'}`}>
                      {o.label}
                    </span>
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

// ─── División SearchSelect ─────────────────────────────────────────────────────

function DivisionSelect({ options, value, onChange, placeholder, hasError }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void
  placeholder: string; hasError?: boolean
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
  const border = hasError
    ? 'border-red-400'
    : 'border-[#E5E7EB] hover:border-[#009574]/50 focus-within:ring-2 focus-within:ring-[#009574]/30 focus-within:border-[#009574]'

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => { setOpen(!open); setQuery('') }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-white border rounded-md text-left outline-none transition ${border}`}>
        <span className={`truncate ${selected ? 'text-[#333333]' : 'text-[#6B7280]'}`}>{selected?.label ?? placeholder}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onChange('') }} onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onChange(''))} className="text-[#6B7280] hover:text-[#333333] p-0.5 rounded">
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
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar división..."
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
                    <span className="font-mono text-[11px] text-[#6B7280] mr-2">{o.value}</span>
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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AsignarRol() {
  const navigate = useNavigate()
  const [rol, setRol] = useState('')
  const [division, setDivision] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const needsScope  = SCOPED_ROLES.has(rol)
  const isGlobal    = GLOBAL_ROLES.has(rol)

  function clearErr(field: keyof FormErrors) {
    if (submitted) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!rol) e.rol = 'Selecciona el rol a asignar.'
    if (needsScope && !division) e.division = 'Selecciona la división académica para este rol.'
    return e
  }

  function handleSubmit() {
    const e = validate()
    setSubmitted(true)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    navigate('/usuarios/detalle', { state: { toast: 'Rol asignado correctamente.' } })
  }

  return (
    <div className="max-w-[860px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4 flex-wrap">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Identidad</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/usuarios')} className="hover:text-[#009574] transition-colors">Usuarios</button>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/usuarios/detalle')} className="hover:text-[#009574] transition-colors">Ana García López</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Asignar Rol</span>
      </nav>

      {/* Title */}
      <div className="mb-1">
        <h1 className="text-2xl font-semibold text-[#333333]">Asignar Rol</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Agrega un nuevo rol de acceso para este usuario. Un usuario puede tener múltiples roles con distintos scopes.
        </p>
      </div>

      <hr className="border-[#E5E7EB] my-6" />

      {/* Context card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg px-5 py-4 mb-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
          AG
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#333333]">Ana García López</p>
          <p className="font-mono text-[12px] text-[#6B7280]">202630001@utez.edu.mx</p>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
        <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Rol a Asignar</p>

        {/* Fila 1: Rol (8) */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          <div className="col-span-12 md:col-span-8">
            <Label label="Rol" required htmlFor="rol" />
            <SearchSelect
              options={rolOptions} value={rol}
              onChange={v => { setRol(v); setDivision(''); clearErr('rol') }}
              placeholder="Selecciona el rol"
              hasError={!!errors.rol}
            />
            {errors.rol && <FieldError text={errors.rol} />}
          </div>
        </div>

        {/* Scope info for global roles */}
        {rol && isGlobal && (
          <div className="flex items-start gap-2 bg-[#F8F9FA] border border-[#E5E7EB] rounded-md px-3 py-2.5 mb-4 text-[12px] text-[#6B7280]">
            <Info size={13} className="text-[#009574] flex-shrink-0 mt-0.5" />
            <span>
              El rol <span className={`inline-flex text-[11px] font-semibold px-1.5 py-0.5 rounded-full mx-1 ${rolStyle[rol]}`}>{rol}</span>
              tiene acceso global al sistema. No requiere scope de división.
            </span>
          </div>
        )}

        {/* Fila 2: División (conditional, 8 cols) */}
        {needsScope && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-8">
              {/* Scope warning */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 mb-4 text-[12px] text-amber-700">
                <Info size={13} className="flex-shrink-0 mt-0.5" />
                <span>
                  El rol <span className={`inline-flex text-[11px] font-semibold px-1.5 py-0.5 rounded-full mx-1 ${rolStyle[rol]}`}>{rol}</span>
                  requiere definir su alcance divisional. El usuario solo podrá operar dentro de la división seleccionada.
                </span>
              </div>

              <Label label="División Académica (alcance)" required htmlFor="division" />
              <DivisionSelect
                options={divisionOptions} value={division}
                onChange={v => { setDivision(v); clearErr('division') }}
                placeholder="Selecciona la división"
                hasError={!!errors.division}
              />
              {errors.division
                ? <FieldError text={errors.division} />
                : <FieldHelp text="El rol solo tendrá acceso a los datos de esta división" />
              }
            </div>
          </div>
        )}

        {/* Preview when complete */}
        {rol && (!needsScope || division) && (
          <div className="mt-6 flex items-center gap-3 bg-[#e6f5f1] border border-[#009574]/20 rounded-md px-4 py-3">
            <UserCircle2 size={16} className="text-[#009574] flex-shrink-0" />
            <div className="flex items-center gap-2 flex-wrap text-[12px]">
              <span className="text-[#6B7280]">Se asignará el rol</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${rolStyle[rol] ?? 'bg-gray-100 text-gray-600'}`}>{rol}</span>
              {division && (
                <>
                  <span className="text-[#6B7280]">con alcance en</span>
                  <span className="font-semibold text-[#333333]">
                    {divisionOptions.find(d => d.value === division)?.label}
                  </span>
                </>
              )}
              <span className="text-[#6B7280]">a <strong className="text-[#333333]">Ana García López</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Action zone */}
      <div className="flex items-center justify-end gap-3 mt-6">
        <button
          onClick={() => navigate('/usuarios/detalle')}
          className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          className="px-5 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
        >
          Asignar Rol
        </button>
      </div>
    </div>
  )
}
