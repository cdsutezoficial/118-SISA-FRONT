import { useEffect, useRef, useState } from 'react'
import { UserX, Info } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, ModeSwitcher } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, TextAreaField, PickerInput, PickerPanel, PickerOption, PickerLoading, PickerError, PickerEmpty, SelectedItem } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut, getApiErrorMessage } from '@app/core/infra/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────

type DivisionStatus = 'ACTIVE' | 'INACTIVE'

interface DivisionResponse {
  id: string
  name: string
  code: string
  description: string
  directorPersonId: string | null
  status: DivisionStatus
}

interface DivisionFormPayload {
  name: string
  code: string
  description: string
  directorPersonId: string | null
}

type DivisionField = 'name' | 'code' | 'description'
type DivisionFormErrors = Partial<Record<DivisionField, string>>

const DIVISION_CODE_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/

function normalizeDivisionCode(value: string): string {
  return value.trim().toUpperCase()
}

function validateDivisionForm(name: string, code: string, description: string): DivisionFormErrors {
  const errors: DivisionFormErrors = {}
  const normalizedName = name.trim()
  const normalizedCode = normalizeDivisionCode(code)
  const normalizedDescription = description.trim()

  if (!normalizedName) errors.name = 'El nombre de la división es requerido.'
  else if (normalizedName.length > 150) errors.name = 'El nombre no puede superar 150 caracteres.'
  else if (CONTROL_CHARACTERS.test(normalizedName)) errors.name = 'El nombre contiene caracteres no válidos.'

  if (!normalizedCode) errors.code = 'La clave es requerida.'
  else if (normalizedCode.length < 2 || normalizedCode.length > 12) errors.code = 'La clave debe tener entre 2 y 12 caracteres.'
  else if (!DIVISION_CODE_PATTERN.test(normalizedCode)) errors.code = 'La clave solo puede contener letras, números y guiones.'

  if (normalizedDescription.length > 500) errors.description = 'La descripción no puede superar 500 caracteres.'
  else if (CONTROL_CHARACTERS.test(normalizedDescription)) errors.description = 'La descripción contiene caracteres no válidos.'

  return errors
}

// Only the users search needs — `GET /users?role=DIRECTOR_DIVISION&divisionId=`
// (added 2026-07-28, plan `118-SISA-BACK/docs/plans/2026-07-28-director-division-role-filter.md`)
// resolves candidates who already hold that role scoped to THIS division. There
// is no `GET /persons/{id}` to resolve a stale `directorPersonId` whose role was
// later revoked — if the currently-saved director no longer appears in this
// list, we show the raw id with an explanatory note instead of a name (see
// `DirectorField` below).
interface DirectorCandidate {
  userId: string
  personId: string
  fullName: string
  username: string
}

interface UsersPageResponse {
  items: DirectorCandidate[]
}

// ─── DirectorField ──────────────────────────────────────────────────────────────
// Edit-mode-only picker: shows ONLY persons who already hold `DIRECTOR_DIVISION`
// scoped to this division (José, 2026-07-28) — never a free person search, and
// never shown in Registrar mode, since the role cannot be assigned before the
// division exists (chicken-and-egg: `UserRole.divisionId` needs a real division).

function DirectorField({ divisionId, value, onChange, disabled }: {
  divisionId: string
  value: string
  onChange: (personId: string) => void
  disabled: boolean
}) {
  const [candidates, setCandidates] = useState<DirectorCandidate[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    apiGet<UsersPageResponse>('/users', { role: 'DIRECTOR_DIVISION', divisionId, status: 'ACTIVE', size: 100 })
      .then(data => { if (!cancelled) { setCandidates(data.items); setStatus('idle') } })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [divisionId])

  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  const selected = candidates.find(c => c.personId === value)
  // The saved directorPersonId may belong to someone whose DIRECTOR_DIVISION
  // role was revoked after being set as director — they won't be in
  // `candidates` anymore, and there's no `GET /persons/{id}` to resolve their
  // name from just the id.
  const isStaleDirector = !!value && !selected

  if (disabled) {
    return (
      <input value={selected ? `${selected.fullName} — ${selected.username}` : (value || '')} disabled readOnly className={inputCls(true, false)} />
    )
  }

  return (
    <div ref={ref} className="relative w-full">
      {selected ? (
        <SelectedItem title={selected.fullName} subtitle={selected.username} onClear={() => onChange('')} />
      ) : (
        <>
          <PickerInput readOnly onFocus={() => setOpen(true)} placeholder="Selecciona el director…" />
          {open && (
            <PickerPanel>
              <ul className="max-h-56 overflow-y-auto py-1">
                {status === 'loading' ? (
                  <PickerLoading label="Cargando…" />
                ) : status === 'error' ? (
                  <PickerError text="No se pudo consultar. Intenta de nuevo." />
                ) : candidates.length === 0 ? (
                  <PickerEmpty icon={<UserX size={20} className="text-[#E5E7EB]" />} text="Ningún usuario tiene el rol de Director asignado a esta división todavía." />
                ) : (
                  candidates.map(c => (
                    <PickerOption key={c.userId} onClick={() => { onChange(c.personId); setOpen(false) }}>
                      <div className="font-medium text-[#333333] truncate">{c.fullName}</div>
                      <div className="font-mono text-[11px] text-[#6B7280] truncate">{c.username}</div>
                    </PickerOption>
                  ))
                )}
              </ul>
            </PickerPanel>
          )}
        </>
      )}
      {isStaleDirector && (
        <div className="flex items-start gap-2 mt-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          <span>El director guardado (id: <span className="font-mono">{value}</span>) ya no tiene el rol de Director activo para esta división. Selecciona uno nuevo o vuelve a asignárselo desde Usuarios.</span>
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DivisionesForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  const [nombre, setNombre] = useState('')
  const [clave, setClave] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [directorPersonId, setDirectorPersonId] = useState('')
  const [errors, setErrors] = useState<DivisionFormErrors>({})

  // `loadStatus` covers the edit/view GET-by-id fetch; `submitStatus` covers
  // the register/edit POST-PUT submit — separate so a slow initial fetch
  // doesn't fight with the submit button's own loading state.
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    if (isRegister) {
      setNombre('')
      setClave('')
      setDescripcion('')
      setDirectorPersonId('')
      setErrors({})
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id])

  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<DivisionResponse>(`/divisions/${id}`)
      .then(data => {
        if (cancelled) return
        setNombre(data.name)
        setClave(data.code)
        setDescripcion(data.description)
        setDirectorPersonId(data.directorPersonId ?? '')
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        setLoadErrorMsg(getApiErrorMessage(err))
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode])

  const disabled = isView || loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'

  async function handleSubmit() {
    const validationErrors = validateDivisionForm(nombre, clave, descripcion)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    const payload: DivisionFormPayload = {
      name: nombre.trim(),
      code: normalizeDivisionCode(clave),
      description: descripcion.trim(),
      directorPersonId: directorPersonId.trim() || null,
    }
    try {
      if (isRegister) {
        const created = await apiPost<DivisionResponse>('/divisions', payload)
        navigate(`/divisiones/form?mode=view&id=${created.id}`, { state: { toast: 'División registrada exitosamente.' } })
      } else if (id) {
        await apiPut<DivisionResponse>(`/divisions/${id}`, payload)
        navigate(`/divisiones/form?mode=view&id=${id}`, { state: { toast: 'División actualizada exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      setSubmitErrorMsg(getApiErrorMessage(err))
    }
  }

  return (
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Divisiones Académicas', to: '/divisiones' },
          { label: isRegister ? 'Registrar División' : isView ? 'Ver División' : 'Editar División' },
        ]}
      />

      <FormHeader
        title={isRegister ? 'Registrar División' : isView ? 'Ver División' : 'Editar División'}
        subtitle={isRegister ? 'Completa los campos para registrar una nueva división académica.' : isView ? 'Información de la división académica.' : 'Modifica los datos de la división académica.'}
        right={
          <ModeSwitcher
            mode={mode}
            id={id}
            registerUrl="/divisiones/new"
            formUrl={m => `/divisiones/form?mode=${m}&id=${id}`}
          />
        }
      />

      {/* Load error banner (edit/view fetch failed) */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {/* Form card */}
      <FormCard loading={loadStatus === 'loading'} loadingLabel="Cargando división...">
        <div className="grid grid-cols-12 gap-4">
            <TextField
              label="Nombre de la División"
              required={!isView}
              value={nombre}
              onChange={value => { setNombre(value); if (errors.name) setErrors(previous => ({ ...previous, name: undefined })) }}
              disabled={disabled}
              error={errors.name}
              maxLength={150}
              placeholder="Ej. División de Tecnologías de la Información"
              help="Nombre completo y oficial de la división académica."
              className="col-span-12 sm:col-span-8"
            />
            <TextField
              label="Clave"
              required={!isView}
              value={clave}
              onChange={value => { setClave(normalizeDivisionCode(value)); if (errors.code) setErrors(previous => ({ ...previous, code: undefined })) }}
              disabled={disabled}
              error={errors.code}
              maxLength={12}
              placeholder="Ej. DTI"
              help="Identificador corto único."
              className="col-span-12 sm:col-span-4"
            />
            <TextAreaField
              label="Descripción"
              value={descripcion}
              onChange={value => { setDescripcion(value); if (errors.description) setErrors(previous => ({ ...previous, description: undefined })) }}
              disabled={disabled}
              maxLength={500}
              rows={4}
              placeholder="Descripción breve de la división y su enfoque académico."
              className="col-span-12"
            />
            {/* Director (persona) — only in Ver/Editar: the DIRECTOR_DIVISION role
                requires a real divisionId, so it can never be assigned before
                the division exists (José, 2026-07-28) — the field has nothing
                to search in Registrar mode. */}
            {!isRegister && (
              <div className="col-span-12">
                <FieldLabel>Director de División</FieldLabel>
                {id && <DirectorField divisionId={id} value={directorPersonId} onChange={setDirectorPersonId} disabled={disabled} />}
                <FieldHelp>
                  Solo se pueden elegir personas que ya tienen el rol de Director asignado para esta división
                  (pantalla Usuarios → Asignar Rol). Si aún no existe, asígnalo primero desde ahí.
                </FieldHelp>
              </div>
            )}
          </div>
      </FormCard>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <FormActions
          isView={isView}
          onBack={() => navigate('/divisiones')}
          onPrimary={isView ? () => navigate(`/divisiones/form?mode=edit&id=${id}`) : handleSubmit}
          primaryLabel={isView ? 'Editar' : isRegister ? 'Registrar División' : 'Guardar Cambios'}
          isSubmitting={isSubmitting}
        />
      )}
    </FormPage>
  )
}
