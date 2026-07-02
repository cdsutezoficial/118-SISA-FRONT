import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ChevronRight, Save } from 'lucide-react'
import { FieldLabel, FieldError, DatePicker, inputCls } from '../../shared/ui'
import { mockCandidates } from '../../shared/admision/mockData'
import { EXAM_PASSING_SCORE, getExamResultLabel, type Candidate } from '../../shared/admision/types'

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

/** Read-only summary field — mirrors the page-local `ReadField` pattern used across the Admisión Registro/Confirmar screens. */
function ReadField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[13px] text-[#333333] ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</p>
    </div>
  )
}

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
    <div className="max-w-[900px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4 flex-wrap">
        <button onClick={() => navigate('/admision')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/admision')} className="hover:text-[#009574] transition-colors">Admisión</button>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/admision/candidatos')} className="hover:text-[#009574] transition-colors">Candidatos</button>
        <ChevronRight size={13} />
        <button onClick={() => navigate(`/admision/candidatos/detalle?id=${candidate.id}`)} className="hover:text-[#009574] transition-colors">Detalle</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Registrar Resultado de Examen</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Registrar Resultado del Examen de Admisión</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Captura la calificación obtenida en el examen de admisión.
        </p>
      </div>

      {/* Informative card (read-only) */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg px-6 py-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          <ReadField label="Candidato" value={candidate.nombre} />
          <ReadField label="Folio" value={candidate.folio} mono />
          <ReadField label="Programa Solicitado" value={candidate.programa} />
        </div>
      </div>

      {/* Form */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-4">
            <FieldLabel required>Fecha del Examen</FieldLabel>
            <DatePicker value={fecha} onChange={v => { setFecha(v); clearErr('fecha') }} />
            {errors.fecha && <FieldError>{errors.fecha}</FieldError>}
          </div>
          <div className="col-span-12 sm:col-span-4">
            <FieldLabel required>Calificación Obtenida</FieldLabel>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={calificacion}
              onChange={e => { setCalificacion(e.target.value); clearErr('calificacion') }}
              className={inputCls(false, !!errors.calificacion)}
              placeholder="0-100"
            />
            {errors.calificacion && <FieldError>{errors.calificacion}</FieldError>}
            {resultado && (
              <p className={`mt-1.5 text-[12px] font-semibold ${resultado === 'Aprobado' ? 'text-emerald-600' : 'text-red-600'}`}>
                Resultado: {resultado}
              </p>
            )}
          </div>
          <div className="col-span-12 sm:col-span-4">
            <FieldLabel>Calificación Mínima Aprobatoria</FieldLabel>
            <input value={String(EXAM_PASSING_SCORE)} disabled className={inputCls(true, false)} />
          </div>

          <div className="col-span-12">
            <FieldLabel>Observaciones</FieldLabel>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={4}
              className={inputCls(false, false) + ' resize-none'}
              placeholder="Notas adicionales sobre el examen de admisión."
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate(`/admision/candidatos/detalle?id=${candidate.id}`)}
          className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleGuardar}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={14} />Guardar Resultado
        </button>
      </div>
    </div>
  )
}
