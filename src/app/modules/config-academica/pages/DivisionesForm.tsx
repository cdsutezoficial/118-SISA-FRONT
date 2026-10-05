import { useEffect, useRef, useState } from 'react'
import { UserX, Info } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, ModeSwitcher } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, TextAreaField, PickerInput, PickerPanel, PickerOption, PickerLoading, PickerError, PickerEmpty, SelectedItem } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut, getApiErrorMessage, type ApiError } from '@app/core/infra/apiClient'
import { useFieldValidation } from '@app/core/validation/useFieldValidation'
import {
	required,
	maxLength,
	lengthBetween,
	noControlChars,
	lettersOnly,
	lettersSpacesAndHyphens,
	normalizeCode,
	normalizeText,
} from '@app/core/validation/fieldRules'

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

// ─── Schema de validación ──────────────────────────────────────────────────────
// Se declara fuera del componente para que su identidad sea estable: el hook lo
// usa como dependencia de sus callbacks.
//
// Contenido permitido por campo (decisión de negocio 2026-10-04):
//   name        → letras y acentos, separados por espacios o guiones
//   code        → sólo letras, sin espacios, dígitos ni guiones
//   description → letras, números, acentos y símbolos; sólo se rechazan los
//                 caracteres de control (C0, DEL y C1)
//
// `name` y `description` son textos libres: NO llevan `normalize`, porque
// recortar en cada pulsación impediría escribir un espacio entre palabras. Se
// usa `validateOn: normalizeText`, que compacta los espacios de más y recorta
// **sólo al evaluar las reglas**, sin escribir de vuelta en el input: el usuario
// ve lo que escribió (y el cursor nunca le salta) mientras lo que se valida y lo
// que se manda es el texto limpio. El payload se arma con el mismo
// `normalizeText`.
//
// `code` sí lleva `normalize: normalizeCode` — recortar y pasar a mayúsculas
// mientras se teclea es exactamente lo que se hacía antes a mano.

const DIVISION_SCHEMA = {
  name: {
    validateOn: normalizeText,
    rules: [
      required('nombre de la división'),
      maxLength(150, 'nombre'),
      noControlChars('nombre'),
      lettersSpacesAndHyphens('nombre'),
    ],
  },
  code: {
    normalize: normalizeCode,
    rules: [required('clave', 'f'), lengthBetween(2, 12, 'clave', 'f'), lettersOnly('clave', 'f')],
  },
  description: {
    validateOn: normalizeText,
    rules: [maxLength(500, 'descripción', 'f'), noControlChars('descripción', 'f')],
  },
} as const

const DIVISION_INITIAL_VALUES = { name: '', code: '', description: '' }

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

  const [directorPersonId, setDirectorPersonId] = useState('')

  const {
    values,
    fieldError,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    reset,
    validate,
    isValid,
  } = useFieldValidation(DIVISION_SCHEMA, DIVISION_INITIAL_VALUES)

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
      reset()
      setDirectorPersonId('')
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id, reset])

  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<DivisionResponse>(`/divisions/${id}`)
      .then(data => {
        if (cancelled) return
        setFieldValue('name', data.name)
        setFieldValue('code', data.code)
        setFieldValue('description', data.description)
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
    // Marca todos los campos como tocados y valida. Si algo falla, no se
    // dispara ninguna petición.
    if (!validate()) return
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    const payload: DivisionFormPayload = {
      name: normalizeText(values.name),
      code: values.code,
      description: normalizeText(values.description),
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
      const apiErr = err as ApiError
      if (apiErr?.status === 409 && typeof apiErr.backendMessage === 'string') {
        if (apiErr.backendMessage.includes('nombre')) {
          setFieldError('name', apiErr.backendMessage)
          setSubmitStatus('idle')
          return
        }
        if (apiErr.backendMessage.includes('clave')) {
          setFieldError('code', apiErr.backendMessage)
          setSubmitStatus('idle')
          return
        }
      }
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
              value={values.name}
              onChange={handleChange('name')}
              onBlur={handleBlur('name')}
              disabled={disabled}
              error={fieldError('name')}
              maxLength={150}
              placeholder="Ej. División de Tecnologías de la Información"
              help="Nombre completo y oficial de la división académica."
              className="col-span-12 sm:col-span-8"
            />
            <TextField
              label="Clave"
              required={!isView}
              value={values.code}
              onChange={handleChange('code')}
              onBlur={handleBlur('code')}
              disabled={disabled}
              error={fieldError('code')}
              maxLength={12}
              placeholder="Ej. DTI"
              help="Identificador corto único. Sólo letras."
              className="col-span-12 sm:col-span-4"
            />
            <TextAreaField
              label="Descripción"
              value={values.description}
              onChange={handleChange('description')}
              onBlur={handleBlur('description')}
              disabled={disabled}
              error={fieldError('description')}
              maxLength={500}
              rows={4}
              placeholder="Descripción breve de la división y su enfoque académico."
              help="Letras, números, acentos y símbolos. Hasta 500 caracteres."
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
          primaryDisabled={!isView && !isValid}
        />
      )}
    </FormPage>
  )
}
