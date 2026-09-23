import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { FieldLabel, FieldError, DatePicker, ReadField } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, TextAreaField } from '@app/core/components/form'
import { Breadcrumb } from '@app/core/components/list'
import { mockCandidates } from '../data/mockData'
import { EXAM_PASSING_SCORE, getExamResultLabel, type Candidate } from '../data/types'

/**
 * Screen 7 — Registro de Resultado de Examen de Admisión, per `03-admision.md`
 * ("Pantalla 7 — Registro de Resultado de Examen de Admisión") and
 * `specs/admision-screens/spec.md`'s "Registro de Examen (Screen 7)"
 * requirement. Role: Servicios Escolares.
 *
 * Unlike Screen 8 (Registro Inducción), the exam has NO payment prerequisite
 * — the form is always enabled. Structurally identical to
 * `RegistroInduccion.tsx` minus the gating banner, and using the exam's own
 * minimum passing score (`EXAM_PASSING_SCORE` = 60, distinct from
 * induction's 70).
 *
 * Saving does NOT alter `Candidate.status` — exam/induction results are
 * independent fields per the state machine (only ficha-payment confirmation,
 * Director selection, and matrícula generation transition status).
 *
 * Reached from `CandidatosList.tsx`'s "Registrar Examen" row action (only
 * enabled while status is `PAID`, per `isAdmisionActionEnabled`), via
 * `/admision/candidatos/examen?id=<candidateId>` — same `?id=` query-param
 * lookup + `mockCandidates[0]` fallback convention as the other Admisión
 * Registro screens.
 *
 * MOCK-ONLY LIMITATION: same as `RegistroInduccion.tsx`/`ConfirmarPagoFicha.tsx`
 * — `mockCandidates` has no shared mutation store across pages, so a valid
 * submit only simulates the save via toast + redirect; it does not persist
 * `examen` for other screens to see.
 */

interface FormErrors {
  fecha?: string
  calificacion?: string
}

export default function RegistroExamen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get('id')

  const found = mockCandidates.find(c => c.id === idParam)
  const candidate: Candidate = found ?? mockCandidates[0]

  const [fecha, setFecha] = useState('')
  const [calificacion, setCalificacion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  function clearErr(field: keyof FormErrors) {
    if (submitted) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!fecha) e.fecha = 'La fecha del examen es obligatoria.'
    if (!calificacion.trim()) e.calificacion = 'La calificación obtenida es obligatoria.'
    else if (isNaN(Number(calificacion)) || Number(calificacion) < 0 || Number(calificacion) > 100) {
      e.calificacion = 'Ingresa una calificación válida entre 0 y 100.'
    }
    return e
  }

  function handleGuardar() {
    const e = validate()
    setSubmitted(true)
    if (Object.keys(e).length > 0) { setErrors(e); return }

    // See file-level comment: mock-only simulated save, no shared mutation
    // store. Navigates back to the candidate's Detalle (Screen 5) with a
    // success toast via router state — same `state: { toast }` convention
    // used across the app's other Registro/Form screens.
    navigate(`/admision/candidatos/detalle?id=${candidate.id}`, {
      state: { toast: 'Resultado del examen de admisión registrado correctamente.' },
    })
  }

  const calificacionNum = Number(calificacion)
  const showResultado = calificacion.trim() !== '' && !isNaN(calificacionNum)
  const resultado = showResultado ? getExamResultLabel(calificacionNum) : null

  return (
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/admision' },
          { label: 'Admisión', to: '/admision' },
          { label: 'Candidatos', to: '/admision/candidatos' },
          { label: 'Detalle', to: `/admision/candidatos/detalle?id=${candidate.id}` },
          { label: 'Registrar Resultado de Examen' },
        ]}
      />

      <FormHeader
        title="Registrar Resultado del Examen de Admisión"
        subtitle="Captura la calificación obtenida en el examen de admisión."
      />

      {/* Informative card (read-only) */}
      <FormCard>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          <ReadField label="Candidato" value={candidate.nombre} />
          <ReadField label="Folio" value={candidate.folio} mono />
          <ReadField label="Carrera Solicitada" value={candidate.programa} />
        </div>
      </FormCard>

      {/* Form */}
      <FormCard>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-4">
            <FieldLabel required>Fecha del Examen</FieldLabel>
            <DatePicker value={fecha} onChange={v => { setFecha(v); clearErr('fecha') }} />
            {errors.fecha && <FieldError>{errors.fecha}</FieldError>}
          </div>
          <div className="col-span-12 sm:col-span-4">
            <TextField
              label="Calificación Obtenida"
              required
              type="number"
              min={0}
              max={100}
              step={1}
              numeric
              value={calificacion}
              onChange={v => { setCalificacion(v); clearErr('calificacion') }}
              error={errors.calificacion}
              placeholder="0-100"
            />
            {resultado && (
              <p className={`mt-1.5 text-[12px] font-semibold ${resultado === 'Aprobado' ? 'text-emerald-600' : 'text-red-600'}`}>
                Resultado: {resultado}
              </p>
            )}
          </div>
          <TextField
            label="Calificación Mínima Aprobatoria"
            value={String(EXAM_PASSING_SCORE)}
            disabled
            className="col-span-12 sm:col-span-4"
          />

          <TextAreaField
            label="Observaciones"
            value={observaciones}
            onChange={setObservaciones}
            rows={4}
            placeholder="Notas adicionales sobre el examen de admisión."
            className="col-span-12"
          />
        </div>
      </FormCard>

      {/* Actions */}
      <FormActions
        isView={false}
        onBack={() => navigate(`/admision/candidatos/detalle?id=${candidate.id}`)}
        onPrimary={handleGuardar}
        primaryLabel="Guardar Resultado"
      />
    </FormPage>
  )
}
