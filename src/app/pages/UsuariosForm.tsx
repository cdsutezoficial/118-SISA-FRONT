import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ChevronRight, Search, X, Loader2, AlertCircle, KeyRound, UserPlus, Users,
} from 'lucide-react'
import { Wizard, type WizardStep } from '../shared/Wizard'
import { FieldLabel, FieldError, FieldHelp, inputCls } from '../shared/ui'
import { apiGet, apiPost } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PersonSummary {
  id: string
  curp: string
  firstName: string
  lastName1: string
  lastName2: string | null
  institutionalEmail: string
  hasUser: boolean
}

interface PersonsPageResponse {
  items: PersonSummary[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

interface PersonResponse {
  id: string
  curp: string
  firstName: string
  lastName1: string
  lastName2: string | null
  institutionalEmail: string
}

interface CreateUserResponse {
  userId: string
  username: string
  mustChangePassword: boolean
}

interface NewPersonForm {
  curp: string
  firstName: string
  lastName1: string
  lastName2: string
  institutionalEmail: string
}

interface NewPersonErrors {
  curp?: string
  firstName?: string
  lastName1?: string
  institutionalEmail?: string
}

type PersonMode = 'search' | 'create'

const emptyNewPerson: NewPersonForm = {
  curp: '', firstName: '', lastName1: '', lastName2: '', institutionalEmail: '',
}

function personFullName(p: { firstName: string; lastName1: string; lastName2: string | null }): string {
  return [p.firstName, p.lastName1, p.lastName2].filter(Boolean).join(' ')
}

// ─── PersonSearchField ─────────────────────────────────────────────────────────
// Bespoke async searchable select against `GET /persons?search=` (debounced,
// same 300ms pattern as `UsuariosList.tsx`'s free-text filter). Deliberately
// NOT built on `shared/ui.tsx`'s `SearchSelectField` — that component filters
// a static in-memory `options` array, it has no remote-fetch or per-item
// disabled-state concept, both of which this field needs (live backend search,
// and greying out persons that already have a `User` account).

function PersonSearchField({ selected, onSelect, onClear }: {
  selected: PersonSummary | null
  onSelect: (p: PersonSummary) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<PersonSummary[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setStatus('loading')
    apiGet<PersonsPageResponse>('/persons', { search: debouncedQuery || undefined, page: 0, size: 10 })
      .then(data => { if (!cancelled) { setResults(data.items); setStatus('idle') } })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [debouncedQuery, open])

  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-[#e6f5f1] border border-[#009574]/30 rounded-md">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#333333] truncate">{personFullName(selected)}</p>
          <p className="text-[12px] text-[#6B7280] font-mono truncate">{selected.institutionalEmail}</p>
        </div>
        <button type="button" onClick={onClear} className="text-[#6B7280] hover:text-[#333333] p-1 rounded flex-shrink-0">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Busca por nombre, CURP o correo…"
          className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] transition"
        />
      </div>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 overflow-hidden">
          <ul className="max-h-56 overflow-y-auto py-1">
            {status === 'loading' ? (
              <li className="px-3 py-3 text-center text-[12px] text-[#6B7280] flex items-center justify-center gap-2">
                <Loader2 size={13} className="animate-spin" />Buscando…
              </li>
            ) : status === 'error' ? (
              <li className="px-3 py-3 text-center text-[12px] text-red-600">No se pudo buscar. Intenta de nuevo.</li>
            ) : results.length === 0 ? (
              <li className="px-3 py-3 text-center text-[12px] text-[#6B7280]">Sin resultados</li>
            ) : (
              results.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={p.hasUser}
                    onClick={() => { if (p.hasUser) return; onSelect(p); setOpen(false); setQuery('') }}
                    className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${p.hasUser ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F8F9FA]'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#333333] truncate">{personFullName(p)}</span>
                      {p.hasUser && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 flex-shrink-0 whitespace-nowrap">
                          Ya tiene cuenta
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-[#6B7280] truncate">{p.curp} · {p.institutionalEmail}</div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function UsuariosForm() {
  const navigate = useNavigate()

  const [personMode, setPersonMode] = useState<PersonMode>('search')
  const [selectedPerson, setSelectedPerson] = useState<PersonSummary | null>(null)
  const [newPerson, setNewPerson] = useState<NewPersonForm>({ ...emptyNewPerson })
  const [newPersonErrors, setNewPersonErrors] = useState<NewPersonErrors>({})
  const [newPersonSubmitted, setNewPersonSubmitted] = useState(false)

  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const [passwordSubmitted, setPasswordSubmitted] = useState(false)

  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  const institutionalEmail = personMode === 'create' ? newPerson.institutionalEmail : (selectedPerson?.institutionalEmail ?? '')

  const step1Valid = personMode === 'search'
    ? !!selectedPerson
    : newPerson.curp.length === 18
      && !!newPerson.firstName.trim()
      && !!newPerson.lastName1.trim()
      && !!newPerson.institutionalEmail.trim()
      && newPerson.institutionalEmail.includes('@')

  const step2Valid = !!temporaryPassword.trim()

  function clearNewPersonErr(field: keyof NewPersonErrors) {
    if (newPersonSubmitted) setNewPersonErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function handleModeSwitch(mode: PersonMode) {
    setPersonMode(mode)
    setSelectedPerson(null)
    setNewPerson({ ...emptyNewPerson })
    setNewPersonErrors({})
    setNewPersonSubmitted(false)
  }

  async function handleFinish() {
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    try {
      let personId: string
      if (personMode === 'create') {
        const created = await apiPost<PersonResponse>('/persons', {
          curp: newPerson.curp,
          firstName: newPerson.firstName,
          lastName1: newPerson.lastName1,
          lastName2: newPerson.lastName2.trim() || null,
          institutionalEmail: newPerson.institutionalEmail,
        })
        personId = created.id
      } else if (selectedPerson) {
        personId = selectedPerson.id
      } else {
        return
      }
      const result = await apiPost<CreateUserResponse>('/users', { personId, temporaryPassword })
      navigate(`/usuarios/asignar-rol?userId=${result.userId}`, {
        state: { toast: 'Usuario registrado exitosamente. Asigna al menos un rol para activarlo.' },
      })
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        // Backend: DuplicateCurpException / DuplicateInstitutionalEmailException
        // (creating the Person) or PersonAlreadyHasUserException (creating the
        // User for a Person that got a second account between search and submit).
        setSubmitErrorMsg(apiErr.message ?? 'Ya existe una persona o usuario con esos datos.')
      } else if (apiErr.status === 400) {
        setSubmitErrorMsg(apiErr.message ?? 'Revisa los datos capturados.')
      } else if (apiErr.status === 401) {
        setSubmitErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      } else if (apiErr.status === 403) {
        setSubmitErrorMsg('No tienes permiso para registrar usuarios.')
      } else if (apiErr.status === 404) {
        setSubmitErrorMsg('La persona seleccionada ya no existe. Vuelve a buscarla o créala de nuevo.')
      } else {
        setSubmitErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      }
    }
  }

  const isSubmitting = submitStatus === 'submitting'

  const steps: WizardStep[] = [
    {
      id: 'persona',
      label: 'Persona',
      isValid: step1Valid,
      render: (
        <div>
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Selecciona o registra la persona</p>

          <div className="flex items-center gap-1 p-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg text-[12px] font-medium mb-5 w-fit">
            <button
              type="button"
              onClick={() => handleModeSwitch('search')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${personMode === 'search' ? 'bg-white text-[#009574] shadow-sm border border-[#E5E7EB]' : 'text-[#6B7280] hover:text-[#333333]'}`}
            >
              <Users size={13} />Buscar persona existente
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('create')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${personMode === 'create' ? 'bg-white text-[#009574] shadow-sm border border-[#E5E7EB]' : 'text-[#6B7280] hover:text-[#333333]'}`}
            >
              <UserPlus size={13} />Crear nueva persona
            </button>
          </div>

          {personMode === 'search' ? (
            <div>
              <FieldLabel required>Persona</FieldLabel>
              <PersonSearchField
                selected={selectedPerson}
                onSelect={setSelectedPerson}
                onClear={() => setSelectedPerson(null)}
              />
              <FieldHelp>Las personas que ya tienen una cuenta de usuario aparecen marcadas y no pueden seleccionarse.</FieldHelp>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 md:col-span-6">
                <FieldLabel required>Nombre(s)</FieldLabel>
                <input
                  value={newPerson.firstName}
                  onChange={e => { setNewPerson(f => ({ ...f, firstName: e.target.value })); clearNewPersonErr('firstName') }}
                  placeholder="Ej. María Elena"
                  className={inputCls(false, !!newPersonErrors.firstName)}
                />
                {newPersonErrors.firstName && <FieldError>{newPersonErrors.firstName}</FieldError>}
              </div>
              <div className="col-span-12 md:col-span-3">
                <FieldLabel required>Apellido Paterno</FieldLabel>
                <input
                  value={newPerson.lastName1}
                  onChange={e => { setNewPerson(f => ({ ...f, lastName1: e.target.value })); clearNewPersonErr('lastName1') }}
                  placeholder="Ej. García"
                  className={inputCls(false, !!newPersonErrors.lastName1)}
                />
                {newPersonErrors.lastName1 && <FieldError>{newPersonErrors.lastName1}</FieldError>}
              </div>
              <div className="col-span-12 md:col-span-3">
                <FieldLabel>Apellido Materno</FieldLabel>
                <input
                  value={newPerson.lastName2}
                  onChange={e => setNewPerson(f => ({ ...f, lastName2: e.target.value }))}
                  placeholder="Ej. López"
                  className={inputCls(false, false)}
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <FieldLabel required>CURP</FieldLabel>
                <input
                  value={newPerson.curp}
                  onChange={e => { setNewPerson(f => ({ ...f, curp: e.target.value.toUpperCase() })); clearNewPersonErr('curp') }}
                  placeholder="Ej. GALO900415MJCRPS09"
                  maxLength={18}
                  className={`${inputCls(false, !!newPersonErrors.curp)} font-mono uppercase tracking-widest`}
                />
                <div className="flex items-center justify-between mt-1">
                  {newPersonErrors.curp
                    ? <FieldError>{newPersonErrors.curp}</FieldError>
                    : <FieldHelp>Debe tener exactamente 18 caracteres.</FieldHelp>
                  }
                  <span className="text-[11px] text-[#6B7280] tabular-nums ml-auto pl-2">{newPerson.curp.length}/18</span>
                </div>
              </div>
              <div className="col-span-12 md:col-span-6">
                <FieldLabel required>Correo Institucional</FieldLabel>
                <input
                  type="email"
                  value={newPerson.institutionalEmail}
                  onChange={e => { setNewPerson(f => ({ ...f, institutionalEmail: e.target.value })); clearNewPersonErr('institutionalEmail') }}
                  placeholder="usuario@utez.edu.mx"
                  className={inputCls(false, !!newPersonErrors.institutionalEmail)}
                />
                {newPersonErrors.institutionalEmail
                  ? <FieldError>{newPersonErrors.institutionalEmail}</FieldError>
                  : <FieldHelp>Se usará como nombre de usuario de la cuenta.</FieldHelp>
                }
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'cuenta',
      label: 'Cuenta',
      isValid: step2Valid,
      render: (
        <div>
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Datos de acceso</p>

          <div className="grid grid-cols-12 gap-6 mb-6">
            <div className="col-span-12 md:col-span-6">
              <FieldLabel>Correo Institucional (usuario)</FieldLabel>
              <input
                value={institutionalEmail}
                disabled
                readOnly
                className={inputCls(true, false) + ' font-mono'}
              />
              <FieldHelp>Este será el nombre de usuario de la cuenta.</FieldHelp>
            </div>
            <div className="col-span-12 md:col-span-6">
              <FieldLabel required>Contraseña Temporal</FieldLabel>
              <input
                type="text"
                value={temporaryPassword}
                onChange={e => { setTemporaryPassword(e.target.value); if (passwordSubmitted) setPasswordError(undefined) }}
                placeholder="Ej. Bienvenido123"
                className={`${inputCls(false, !!passwordError)} font-mono`}
              />
              {passwordError
                ? <FieldError>{passwordError}</FieldError>
                : <FieldHelp>El usuario deberá cambiarla en su primer inicio de sesión.</FieldHelp>
              }
            </div>
          </div>

          <div className="flex items-start gap-2 text-[12px] text-[#6B7280] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md px-3 py-2.5">
            <KeyRound size={13} className="text-[#009574] flex-shrink-0 mt-0.5" />
            <span>El usuario deberá cambiar esta contraseña temporal en su primer inicio de sesión.</span>
          </div>

          {submitStatus === 'error' && submitErrorMsg && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mt-4">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              {submitErrorMsg}
            </div>
          )}
        </div>
      ),
    },
  ]

  function handleComplete() {
    if (!step1Valid || !step2Valid) return
    if (personMode === 'create') {
      const e: NewPersonErrors = {}
      if (!newPerson.firstName.trim()) e.firstName = 'El nombre es obligatorio.'
      if (!newPerson.lastName1.trim()) e.lastName1 = 'El primer apellido es obligatorio.'
      if (newPerson.curp.length !== 18) e.curp = 'La CURP debe tener exactamente 18 caracteres.'
      if (!newPerson.institutionalEmail.trim() || !newPerson.institutionalEmail.includes('@')) e.institutionalEmail = 'Ingresa un correo válido.'
      setNewPersonSubmitted(true)
      if (Object.keys(e).length > 0) { setNewPersonErrors(e); return }
    }
    if (!temporaryPassword.trim()) {
      setPasswordSubmitted(true)
      setPasswordError('La contraseña temporal es obligatoria.')
      return
    }
    void handleFinish()
  }

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Identidad</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/usuarios')} className="hover:text-[#009574] transition-colors">Usuarios</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Registrar Usuario</span>
      </nav>

      {/* Title */}
      <div className="mb-1">
        <h1 className="text-2xl font-semibold text-[#333333]">Registrar Usuario</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">Crea una nueva cuenta de acceso al sistema.</p>
      </div>

      <hr className="border-[#E5E7EB] my-6" />

      <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
        {isSubmitting ? (
          <div className="flex flex-col items-center gap-3 text-[#6B7280] py-12">
            <Loader2 size={24} className="animate-spin text-[#009574]" />
            <p className="text-[13px] font-medium">Registrando usuario...</p>
          </div>
        ) : (
          <Wizard steps={steps} onComplete={handleComplete} finishLabel="Registrar Usuario" />
        )}
      </div>
    </div>
  )
}
