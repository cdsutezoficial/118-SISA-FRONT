import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ChevronRight, CreditCard } from 'lucide-react'
import { FieldLabel, FieldError, SimpleSelect, DatePicker, inputCls } from '../../shared/ui'
import { FileUpload, type UploadedFile } from '../../shared/FileUpload'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate } from '../../shared/admision/types'

/**
 * Screen 10 — Confirmación de Pago: Curso de Inducción, per `03-admision.md`
 * ("Pantalla 10") and `specs/admision-screens/spec.md`'s "Confirmar Pago
 * Inducción (Screen 10)" requirement. Role: Personal de Finanzas.
 *
 * Structurally mirrors `ConfirmarPagoFicha.tsx` (Screen 6) almost exactly —
 * same card-informativo + form + `FileUpload` + toast-redirect-to-detalle
 * pattern — just for the induction payment concept (`INDUCTION_COURSE`)
 * instead of the ficha payment concept (`ADMISSION_FICHA`).
 *
 * Reached from `CandidatosList.tsx`'s "Confirmar Pago Inducción" row action
 * (enabled while `status` is `PAID` or `EXAM_TAKEN`, per
 * `isAdmisionActionEnabled`), via
 * `/admision/candidatos/pago-induccion?id=<candidateId>` — same `?id=`
 * query-param lookup convention as `ConfirmarPagoFicha.tsx`/
 * `CandidatoDetalle.tsx`, with the same defensive fallback to
 * `mockCandidates[0]` if the id isn't found (e.g. direct navigation to the
 * route).
 *
 * MOCK-ONLY LIMITATION: per the spec, confirming this payment is what
 * unlocks Screen 8 (Registro de Inducción) for the candidate — conceptually
 * `pagoInduccion.status -> 'CONFIRMADO'`. It does NOT transition
 * `Candidate.status` (only ficha-payment confirmation, Director selection,
 * and matrícula generation transition status per the state machine).
 * However `mockCandidates` is a static in-memory array with no shared
 * mutation store across pages (a known Foundation B limitation — see
 * `ConfirmarPagoFicha.tsx`/`FileUpload.tsx`/`mockData.ts` history). This
 * screen therefore does NOT attempt to invent a new shared-state mechanism
 * (out of scope for this single-screen task): on a valid submit it simulates
 * the transition via a success toast + redirect only, exactly like
 * `ConfirmarPagoFicha.tsx` already does. The change is NOT expected to
 * persist or be reflected on other screens (e.g. Screen 8 will still show
 * the payment as unconfirmed after returning).
 */

// Mirrors `CandidatoRegistro.tsx`'s `INDUCCION_MONTO` convention — kept local
// (not imported) since that constant isn't exported there either. NOTE: the
// original UX prompt (`03-admision.md`, Pantalla 10) shows $200.00 as the
// suggested amount, but the codebase already established $350 as the
// induction amount (`CandidatoRegistro.tsx`'s `INDUCCION_MONTO` and every
// `mockCandidates` row's `pagoInduccion.monto`). Using $350 here for
// consistency with the rest of the app; see apply-progress notes for this
// discrepancy.
const INDUCCION_MONTO = 350

const METODOS_PAGO = ['Transferencia bancaria', 'Depósito en ventanilla', 'Pago en línea (Evo Payments)']

/** Placeholder induction-payment reference generator — same deterministic, backend-less style as `ConfirmarPagoFicha.tsx`'s `buildReferencia`, prefixed `REF-IND-` per the spec's `REF-IND-...` format. */
function buildReferencia(folio: string): string {
  const suffix = folio.split('-').pop() ?? '000000'
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `REF-IND-${yyyy}${mm}${dd}-${suffix}`
}

/** Read-only summary field — mirrors the page-local `ReadField` pattern already used in `ConfirmarPagoFicha.tsx`/`CandidatoDetalle.tsx`/`CandidatoRegistro.tsx`/`FichaConfirmacion.tsx`. */
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
  metodo?: string
  monto?: string
  comprobanteNumero?: string
}

export default function ConfirmarPagoInduccion() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get('id')

  const found = mockCandidates.find(c => c.id === idParam)
  const candidate: Candidate = found ?? mockCandidates[0]

  const [referenciaGenerada] = useState(() => candidate.pagoInduccion.referencia ?? buildReferencia(candidate.folio))

  const [fecha, setFecha] = useState('')
  const [metodo, setMetodo] = useState('')
  const [monto, setMonto] = useState(INDUCCION_MONTO.toFixed(2))
  const [comprobanteNumero, setComprobanteNumero] = useState('')
  const [comprobante, setComprobante] = useState<UploadedFile | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  function clearErr(field: keyof FormErrors) {
    if (submitted) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!fecha) e.fecha = 'La fecha de pago es obligatoria.'
    if (!metodo) e.metodo = 'Selecciona el método de pago.'
    if (!monto.trim()) e.monto = 'El monto recibido es obligatorio.'
    else if (isNaN(Number(monto)) || Number(monto) <= 0) e.monto = 'Ingresa un monto válido mayor a 0.'
    if (!comprobanteNumero.trim()) e.comprobanteNumero = 'El número de comprobante/recibo es obligatorio.'
    return e
  }

  function handleConfirmar() {
    const e = validate()
    setSubmitted(true)
    if (Object.keys(e).length > 0) { setErrors(e); return }

    // See file-level comment: mock-only simulated transition, no shared
    // mutation store. Navigates back to the candidate's Detalle (Screen 5)
    // with a success toast via router state — the same `state: { toast }`
    // convention used across the app's other Registro/Form screens
    // (`ConfirmarPagoFicha.tsx`, `DivisionesForm.tsx`, `AsignarMateria.tsx`, etc.).
    navigate(`/admision/candidatos/detalle?id=${candidate.id}`, {
      state: { toast: 'Pago del curso de inducción confirmado. El candidato puede asistir al curso presentando su comprobante.' },
    })
  }

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
        <span className="text-[#333333] font-medium">Confirmar Pago Inducción</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Confirmar Pago del Curso de Inducción</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Registra el pago del curso de inducción del candidato. Este comprobante es requisito para asistir al curso y para que se pueda registrar el resultado.
        </p>
      </div>

      {/* Informative card (read-only) */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg px-6 py-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          <ReadField label="Candidato" value={candidate.nombre} />
          <ReadField label="Folio" value={candidate.folio} mono />
          <ReadField label="Programa" value={candidate.programa} />
          <ReadField label="Referencia Generada" value={referenciaGenerada} mono />
          <ReadField label="Monto Esperado" value={`$${INDUCCION_MONTO.toFixed(2)}`} />
        </div>
      </div>

      {/* Form */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-4">
            <FieldLabel required>Fecha de Pago</FieldLabel>
            <DatePicker value={fecha} onChange={v => { setFecha(v); clearErr('fecha') }} />
            {errors.fecha && <FieldError>{errors.fecha}</FieldError>}
          </div>
          <div className="col-span-12 sm:col-span-4">
            <FieldLabel required>Método de Pago</FieldLabel>
            <SimpleSelect
              options={METODOS_PAGO}
              value={metodo}
              onChange={v => { setMetodo(v); clearErr('metodo') }}
              placeholder="Selecciona un método"
            />
            {errors.metodo && <FieldError>{errors.metodo}</FieldError>}
          </div>
          <div className="col-span-12 sm:col-span-4">
            <FieldLabel required>Monto Recibido</FieldLabel>
            <input
              type="number"
              step="0.01"
              min={0}
              value={monto}
              onChange={e => { setMonto(e.target.value); clearErr('monto') }}
              className={inputCls(false, !!errors.monto)}
              placeholder="350.00"
            />
            {errors.monto && <FieldError>{errors.monto}</FieldError>}
          </div>

          <div className="col-span-12 sm:col-span-8">
            <FieldLabel required>Número de Comprobante / Recibo</FieldLabel>
            <input
              value={comprobanteNumero}
              onChange={e => { setComprobanteNumero(e.target.value); clearErr('comprobanteNumero') }}
              className={inputCls(false, !!errors.comprobanteNumero)}
              placeholder="Número de comprobante o recibo"
            />
            {errors.comprobanteNumero && <FieldError>{errors.comprobanteNumero}</FieldError>}
            <p className="text-[11px] text-[#6B7280] mt-1">El candidato debe presentar este comprobante para asistir al curso de inducción.</p>
          </div>
          <div className="col-span-12 sm:col-span-4">
            <FileUpload
              label="Comprobante Digital"
              accept="application/pdf,image/*"
              value={comprobante}
              onChange={setComprobante}
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
          onClick={handleConfirmar}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
        >
          <CreditCard size={14} />Confirmar Pago
        </button>
      </div>
    </div>
  )
}
