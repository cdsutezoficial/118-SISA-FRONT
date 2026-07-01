import { useState, useRef, useEffect } from 'react'
import {
  ChevronRight, Info, AlertCircle, X, ChevronDown, Search, Pencil, KeyRound,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'
import type { FormMode } from '../shared/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string }

interface FormState {
  nombres: string
  primerApellido: string
  segundoApellido: string
  curp: string
  correo: string
  username: string
  rol: string
  division: string
}

interface FormErrors {
  nombres?: string
  primerApellido?: string
  curp?: string
  correo?: string
  username?: string
  rol?: string
  division?: string
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const rolOptions: SelectOption[] = [
  { value: 'Administrador',            label: 'Administrador' },
  { value: 'Gestor Académico',         label: 'Gestor Académico' },
  { value: 'Docente',                  label: 'Docente' },
  { value: 'Jefatura de Estadías',     label: 'Jefatura de Estadías' },
  { value: 'Asistente de Estadías',    label: 'Asistente de Estadías' },
]

const divisionOptions: SelectOption[] = [
  { value: 'DTI',  label: 'División de Tecnologías de la Información' },
  { value: 'DIIM', label: 'División de Ingeniería Industrial y Mecatrónica' },
  { value: 'DNGE', label: 'División de Negocios y Gestión Empresarial' },
  { value: 'DCS',  label: 'División de Ciencias de la Salud' },
]

// Roles that require a division scope
const SCOPED_ROLES = new Set(['Gestor Académico', 'Jefatura de Estadías', 'Asistente de Estadías'])

const empty: FormState = {
  nombres: '', primerApellido: '', segundoApellido: '',
  curp: '', correo: '', username: '', rol: '', division: '',
}
const preloaded: FormState = {
  nombres: 'Rosa', primerApellido: 'Jiménez', segundoApellido: 'Morales',
  curp: 'JIMR900415MMSRRSA47', correo: 'rjimenez@utez.edu.mx',
  username: 'rjimenez', rol: 'Gestor Académico', division: 'DTI',
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
function inputCls(disabled: boolean, hasError = false) {
  if (disabled) return 'w-full px-3 py-2 text-[13px] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md text-[#6B7280] cursor-not-allowed select-none'
  if (hasError) return 'w-full px-3 py-2 text-[13px] bg-white border border-red-400 rounded-md text-[#333333] focus:outline-none focus:ring-2 focus:ring-red-300 transition'
  return 'w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] hover:border-[#009574]/50 transition'
}

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

// ─── CURP derived password preview ────────────────────────────────────────────

function PasswordHint({ curp }: { curp: string }) {
  const cleaned = curp.trim().toUpperCase()
  if (cleaned.length < 3) return null
  const digits = cleaned.slice(-3)
  return (
    <div className="flex items-center gap-2 bg-[#e6f5f1] border border-[#009574]/20 rounded-md px-3 py-2 mt-1">
      <KeyRound size={13} className="text-[#009574] flex-shrink-0" />
      <span className="text-[12px] text-[#6B7280]">Contraseña inicial:</span>
      <span className="font-mono font-bold text-[13px] text-[#009574] tracking-widest">{digits}</span>
      <span className="text-[11px] text-[#6B7280]">(últimos 3 dígitos de la CURP)</span>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function UsuariosForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const [form, setForm] = useState<FormState>(mode === 'register' ? { ...empty } : { ...preloaded })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const isView = mode === 'view'
  const isDisabled = isView
  const showDivision = SCOPED_ROLES.has(form.rol)

  function handleModeChange(m: FormMode) {
    if (m === 'register') navigate('/usuarios/new')
    else navigate(`/usuarios/form?mode=${m}${id ? `&id=${id}` : ''}`)
  }

  function clearErr(field: keyof FormErrors) {
    if (submitted) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!form.nombres.trim())        e.nombres = 'El nombre es obligatorio.'
    if (!form.primerApellido.trim()) e.primerApellido = 'El primer apellido es obligatorio.'
    if (!form.curp.trim())           e.curp = 'La CURP es obligatoria.'
    else if (form.curp.length !== 18) e.curp = 'La CURP debe tener exactamente 18 caracteres.'
    if (!form.correo.trim())         e.correo = 'El correo institucional es obligatorio.'
    else if (!form.correo.includes('@')) e.correo = 'Ingresa un correo válido.'
    if (!form.username.trim())       e.username = 'El nombre de usuario es obligatorio.'
    if (!form.rol)                   e.rol = 'Selecciona el rol principal.'
    if (showDivision && !form.division) e.division = 'Selecciona la división académica para este rol.'
    return e
  }

  function handleSubmit() {
    const e = validate()
    setSubmitted(true)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    navigate('/usuarios', { state: { toast: mode === 'register' ? 'Usuario registrado exitosamente.' : 'Usuario actualizado exitosamente.' } })
  }

  const breadcrumbLabel = mode === 'register' ? 'Registrar Usuario' : mode === 'view' ? 'Ver Detalle' : 'Editar Usuario'
  const title = mode === 'register' ? 'Registrar Usuario' : mode === 'view' ? 'Detalle del Usuario' : 'Editar Usuario'
  const desc = mode === 'register' ? 'Crea una nueva cuenta de acceso al sistema.' : mode === 'view' ? 'Información del usuario en modo solo lectura.' : 'Modifica los datos del usuario.'

  return (
    <div className="max-w-[860px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Identidad</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/usuarios')} className="hover:text-[#009574] transition-colors">Usuarios</button>
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
            <span>Estás viendo el detalle del usuario. Para realizar cambios, usa el botón <strong>Editar</strong>.</span>
          </div>
        )}

        {/* ── Sección: Datos Personales ── */}
        <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Datos Personales</p>

        {/* Fila 1: Nombre(s) + Apellidos */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          <div className="col-span-12 md:col-span-4">
            <Label label="Nombre(s)" required htmlFor="nombres" />
            <input id="nombres" type="text" disabled={isDisabled}
              placeholder="Ej. María Elena"
              value={form.nombres}
              onChange={e => { setForm(f => ({ ...f, nombres: e.target.value })); clearErr('nombres') }}
              className={inputCls(isDisabled, !!errors.nombres)} />
            {errors.nombres && <FieldError text={errors.nombres} />}
          </div>
          <div className="col-span-12 md:col-span-4">
            <Label label="Primer Apellido" required htmlFor="primerApellido" />
            <input id="primerApellido" type="text" disabled={isDisabled}
              placeholder="Ej. García"
              value={form.primerApellido}
              onChange={e => { setForm(f => ({ ...f, primerApellido: e.target.value })); clearErr('primerApellido') }}
              className={inputCls(isDisabled, !!errors.primerApellido)} />
            {errors.primerApellido && <FieldError text={errors.primerApellido} />}
          </div>
          <div className="col-span-12 md:col-span-4">
            <Label label="Segundo Apellido" htmlFor="segundoApellido" />
            <input id="segundoApellido" type="text" disabled={isDisabled}
              placeholder="Ej. López"
              value={form.segundoApellido}
              onChange={e => setForm(f => ({ ...f, segundoApellido: e.target.value }))}
              className={inputCls(isDisabled, false)} />
          </div>
        </div>

        {/* Fila 2: CURP + Correo */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-6">
            <Label label="CURP" required htmlFor="curp" />
            <input id="curp" type="text" disabled={isDisabled}
              placeholder="Ej. GALO900415MJCRPS09"
              maxLength={18}
              value={form.curp}
              onChange={e => { setForm(f => ({ ...f, curp: e.target.value.toUpperCase() })); clearErr('curp') }}
              className={`${inputCls(isDisabled, !!errors.curp)} font-mono uppercase tracking-widest`} />
            <div className="flex items-center justify-between mt-1">
              {errors.curp
                ? <FieldError text={errors.curp} />
                : <FieldHelp text="Se usarán los últimos 3 dígitos como contraseña inicial" />
              }
              <span className="text-[11px] text-[#6B7280] tabular-nums ml-auto pl-2">{form.curp.length}/18</span>
            </div>
            {!isDisabled && form.curp.length >= 3 && <PasswordHint curp={form.curp} />}
          </div>
          <div className="col-span-12 md:col-span-6">
            <Label label="Correo Institucional" required htmlFor="correo" />
            <input id="correo" type="email" disabled={isDisabled}
              placeholder="usuario@utez.edu.mx"
              value={form.correo}
              onChange={e => { setForm(f => ({ ...f, correo: e.target.value })); clearErr('correo') }}
              className={inputCls(isDisabled, !!errors.correo)} />
            {errors.correo && <FieldError text={errors.correo} />}
          </div>
        </div>

        {/* ── Separador: Acceso al Sistema ── */}
        <SectionSep label="Acceso al Sistema" />

        {/* Fila 3: Username + Rol */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          <div className="col-span-12 md:col-span-6">
            <Label label="Nombre de Usuario" required htmlFor="username" />
            <input id="username" type="text" disabled={isDisabled}
              placeholder="Ej. 202630001 o cmendoza"
              value={form.username}
              onChange={e => { setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') })); clearErr('username') }}
              className={`${inputCls(isDisabled, !!errors.username)} font-mono`} />
            {errors.username
              ? <FieldError text={errors.username} />
              : <FieldHelp text="Para estudiantes se usa la matrícula" />
            }
          </div>
          <div className="col-span-12 md:col-span-6">
            <Label label="Rol Principal" required htmlFor="rol" />
            <SearchSelect
              options={rolOptions} value={form.rol}
              onChange={v => { setForm(f => ({ ...f, rol: v, division: SCOPED_ROLES.has(v) ? f.division : '' })); clearErr('rol') }}
              placeholder="Selecciona el rol"
              disabled={isDisabled} hasError={!!errors.rol}
            />
            {errors.rol && <FieldError text={errors.rol} />}
          </div>
        </div>

        {/* Fila 4 (conditional): División Académica scope */}
        {showDivision && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12">
              <div className="flex items-start gap-2 mb-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 text-[12px] text-amber-700">
                <Info size={13} className="flex-shrink-0 mt-0.5" />
                <span>
                  El rol <strong>{form.rol}</strong> requiere definir el alcance divisional.
                  Este usuario solo podrá operar dentro de la división seleccionada.
                </span>
              </div>
              <Label label="División Académica (alcance)" required htmlFor="division" />
              <SearchSelect
                options={divisionOptions} value={form.division}
                onChange={v => { setForm(f => ({ ...f, division: v })); clearErr('division') }}
                placeholder="Selecciona la división"
                disabled={isDisabled} hasError={!!errors.division}
              />
              {errors.division
                ? <FieldError text={errors.division} />
                : <FieldHelp text="Este rol solo tendrá acceso a la división seleccionada" />
              }
            </div>
          </div>
        )}

        {/* Password note (register mode only) */}
        {mode === 'register' && (
          <div className="mt-6 flex items-start gap-2 text-[12px] text-[#6B7280] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md px-3 py-2.5">
            <KeyRound size={13} className="text-[#009574] flex-shrink-0 mt-0.5" />
            <span>
              La contraseña inicial se genera automáticamente con los últimos 3 caracteres de la CURP.
              El usuario deberá cambiarla en su primer inicio de sesión.
            </span>
          </div>
        )}
      </div>

      {/* Action zone */}
      <div className="flex items-center justify-end gap-3 mt-6">
        {isView ? (
          <>
            <button onClick={() => navigate('/usuarios')}
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
            <button onClick={() => navigate('/usuarios')}
              className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              Cancelar
            </button>
            <button onClick={handleSubmit}
              className="px-5 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              {mode === 'register' ? 'Registrar Usuario' : 'Guardar Cambios'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
