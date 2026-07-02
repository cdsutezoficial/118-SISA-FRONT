import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ChevronRight, CreditCard } from 'lucide-react'
import { FieldLabel, FieldError, SimpleSelect, DatePicker, inputCls } from '../../shared/ui'
import { FileUpload, type UploadedFile } from '../../shared/FileUpload'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate } from '../../shared/admision/types'

/**
 * Screen 6 — Confirmación de Pago de Ficha, per `03-admision.md` ("Pantalla 6")
 * and `specs/admision-screens/spec.md`'s "Confirmar Pago Ficha (Screen 6)"
 * requirement. Role: Personal de Finanzas.
 *
 * Reached from `CandidatosList.tsx`'s "Confirmar Pago Ficha" row action
 * (only enabled while `status === 'REGISTERED'`), via
 * `/admision/candidatos/pago-ficha?id=<candidateId>` — same `?id=` query-param
 * lookup convention as `CandidatoDetalle.tsx` (Screen 5), with the same
 * defensive fallback to `mockCandidates[0]` if the id isn't found (e.g. direct
 * navigation to the route).
 *
 * MOCK-ONLY LIMITATION: per the Candidate Status State Machine, confirming
 * this payment is one of the few actions allowed to transition
 * `status: REGISTERED -> PAID` (and `pagoFicha.status -> 'CONFIRMADO'`).
 * However `mockCandidates` is a static in-memory array with no shared
 * mutation store across pages (a known Foundation B limitation — see
 * `FileUpload.tsx`/`mockData.ts` history). This screen therefore does NOT
 * attempt to invent a new shared-state mechanism (out of scope for this
 * single-screen task): on a valid submit it simulates the transition via a
 * success toast + redirect only, exactly like `CandidatoRegistro.tsx` (Screen
 * 4) already does for its own new-candidate flow. The change is NOT expected
 * to persist or be reflected on other screens (e.g. `CandidatosList.tsx` will
 * still show the candidate as `REGISTERED` after returning).
 */

// Mirrors `CandidatoRegistro.tsx`'s `FICHA_MONTO` convention — kept local
// (not imported) since that constant isn't exported there either.
const FICHA_MONTO = 500

const METODOS_PAGO = ['Transferencia bancaria', 'Depósito en ventanilla', 'Pago en línea (Evo Payments)']

/** Placeholder bank reference — same deterministic, backend-less generator style used by `FichaConfirmacion.tsx`'s `buildReferencia`. */
function buildReferencia(folio: string): string {
  const suffix = folio.split('-').pop() ?? '000000'
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `REF-${yyyy}${mm}${dd}-${suffix}`
}

/** Read-only summary field — mirrors the page-local `ReadField` pattern already used in `CandidatoDetalle.tsx`/`CandidatoRegistro.tsx`/`FichaConfirmacion.tsx`. */
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
  referencia?: string
}

export default function ConfirmarPagoFicha() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get('id')

  const found = mockCandidates.find(c => c.id === idParam)
  const candidate: Candidate = found ?? mockCandidates[0]

  const [referenciaGenerada] = useState(() => candidate.pagoFicha.referencia ?? buildReferencia(candidate.folio))

  const [fecha, setFecha] = useState('')
  const [metodo, setMetodo] = useState('')
  const [monto, setMonto] = useState(FICHA_MONTO.toFixed(2))
  const [referenciaBancaria, setReferenciaBancaria] = useState('')
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
    if (!referenciaBancaria.trim()) e.referencia = 'La referencia bancaria o comprobante es obligatoria.'
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
    // (`DivisionesForm.tsx`, `AsignarMateria.tsx`, etc.).
    navigate(`/admision/candidatos/detalle?id=${candidate.id}`, {
      state: { toast: 'Pago confirmado. El candidato puede continuar con el proceso.' },
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
        <span className="text-[#333333] font-medium">Confirmar Pago</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Confirmar Pago de Ficha</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Registra el pago de ficha del candidato para habilitarlo en el proceso de admisión.
        </p>
      </div>

      {/* Informative card (read-only) */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg px-6 py-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          <ReadField label="Candidato" value={candidate.nombre} />
          <ReadField label="Folio" value={candidate.folio} mono />
          <ReadField label="Programa" value={candidate.programa} />
          <ReadField label="Referencia Generada" value={referenciaGenerada} mono />
          <ReadField label="Monto Esperado" value={`$${FICHA_MONTO.toFixed(2)}`} />
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
              placeholder="500.00"
            />
            {errors.monto && <FieldError>{errors.monto}</FieldError>}
          </div>

          <div className="col-span-12 sm:col-span-8">
            <FieldLabel required>Referencia Bancaria / Comprobante</FieldLabel>
            <input
              value={referenciaBancaria}
              onChange={e => { setReferenciaBancaria(e.target.value); clearErr('referencia') }}
              className={inputCls(false, !!errors.referencia)}
              placeholder="Número de referencia o folio del comprobante"
            />
            {errors.referencia && <FieldError>{errors.referencia}</FieldError>}
          </div>
          <div className="col-span-12 sm:col-span-4">
            <FileUpload
              label="Comprobante"
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
