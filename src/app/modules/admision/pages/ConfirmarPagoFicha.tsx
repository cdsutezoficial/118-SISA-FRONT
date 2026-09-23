import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Loader2 } from 'lucide-react'
import { FieldLabel, FieldError, DatePicker, ReadField, Toast } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, SelectField } from '@app/core/components/form'
import { Breadcrumb } from '@app/core/components/list'
import { FileUpload, type UploadedFile } from '@app/core/components/FileUpload'
import { apiGet, apiPost, type ApiError } from '@app/core/infra/apiClient'
import { mockCandidates } from '../data/mockData'
import type { Candidate, CandidateFichaBackend, PaymentConfirmationBackend } from '../data/types'

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
 * REAL-BACKEND FLOW (wired to `118-SISA-BACK`):
 * - Backend-created candidates carry UUID ids. For those, this screen syncs
 *   the ticket display from `GET /candidates/{id}` (real ficha projection:
 *   folio, programa, referencia, monto) and confirms the payment with
 *   `POST /candidates/{id}/payments/confirm`, getting back the real receipt
 *   (`REC-...`). A 409 means the ficha is already paid (idempotent re-confirm)
 *   — shown as an info state, not an error.
 * - Mock candidates (non-UUID ids, direct mock navigation) keep the previous
 *   toast-only simulation: the transition is NOT persisted anywhere.
 */

// Mirrors `CandidatoRegistro.tsx`'s `FICHA_MONTO` convention — kept local
// (not imported) since that constant isn't exported there either.
const FICHA_MONTO = 500

const METODOS_PAGO = ['Transferencia bancaria', 'Depósito en ventanilla', 'Pago en línea (Evo Payments)']

// Backend candidate ids are UUIDs; mock candidates use ids like "cand-01".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Placeholder bank reference — same deterministic, backend-less generator style used by `FichaConfirmacion.tsx`'s `buildReferencia`. */
function buildReferencia(folio: string): string {
  const suffix = folio.split('-').pop() ?? '000000'
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `REF-${yyyy}${mm}${dd}-${suffix}`
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
  const idParam = searchParams.get('id') ?? ''

  const esCandidatoReal = UUID_RE.test(idParam)
  const found = mockCandidates.find(c => c.id === idParam)
  const mockCandidate: Candidate = found ?? mockCandidates[0]

  const [ficha, setFicha] = useState(() => ({
    id: idParam || mockCandidate.id,
    folio: mockCandidate.folio,
    nombre: mockCandidate.nombre,
    programa: mockCandidate.programa,
    referencia: mockCandidate.pagoFicha.referencia ?? buildReferencia(mockCandidate.folio),
    monto: mockCandidate.pagoFicha.monto ?? FICHA_MONTO,
  }))
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [loadingFicha, setLoadingFicha] = useState(false)

  const [fecha, setFecha] = useState('')
  const [metodo, setMetodo] = useState('')
  const [monto, setMonto] = useState('')
  const [referenciaBancaria, setReferenciaBancaria] = useState('')
  const [comprobante, setComprobante] = useState<UploadedFile | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  // Real candidates: sync the ticket display from `GET /candidates/{id}` (the
  // same projection `CandidatoRegistro` created). Also reflects the real amount
  // and reference on the "Esperado" card where the mock demo used its local
  // `FICHA_MONTO`.
  useEffect(() => {
    if (!esCandidatoReal) {
      setMonto((mockCandidate.pagoFicha.monto ?? FICHA_MONTO).toFixed(2))
      return
    }
    setLoadingFicha(true)
    apiGet<CandidateFichaBackend>(`/candidates/${idParam}`)
      .then(f => {
        setFicha({
          id: idParam,
          folio: f.folio,
          nombre: `${f.firstName} ${f.lastName1} ${f.lastName2}`.trim(),
          programa: f.programName,
          referencia: f.referenceNumber,
          monto: Number(f.amount),
        })
        setMonto(Number(f.amount).toFixed(2))
        if (f.paymentStatus === 'PAID') setAlreadyPaid(true)
      })
      .catch(err => {
        const apiErr = err as Partial<ApiError>
        setToast(apiErr.status === 404 ? 'No se encontró el candidato.' : 'No se pudo cargar la ficha del candidato.')
      })
      .finally(() => setLoadingFicha(false))
  }, [idParam, esCandidatoReal, mockCandidate.pagoFicha.monto])

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

  async function handleConfirmar() {
    const e = validate()
    setSubmitted(true)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    if (alreadyPaid) return

    if (!esCandidatoReal) {
      // Mock simulation (same as pre-integration) so the staff mock demo still behaves.
      setBusy(true)
      setTimeout(() => {
        setBusy(false)
        navigate(`/admision/candidatos/detalle?id=${ficha.id}`, {
          state: { toast: 'Pago confirmado. El candidato puede continuar con el proceso.' },
        })
      }, 1200)
      return
    }

    // Real backend: `POST /candidates/{id}/payments/confirm` marks the ficha
    // PAID server-side and mails the confirmation receipt.
    setBusy(true)
    try {
      const res = await apiPost<PaymentConfirmationBackend>(`/candidates/${ficha.id}/payments/confirm`)
      navigate(`/admision/candidatos/detalle?id=${ficha.id}`, {
        state: { toast: `Pago confirmado. Recibo ${res.receiptNumber}. El candidato puede continuar con el proceso.` },
      })
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        setAlreadyPaid(true)
        setToast('Este candidato ya tiene la ficha pagada en el sistema.')
      } else if (apiErr.status === 404) {
        setToast('No se encontró el candidato. Vuelve a intentar.')
      } else {
        setToast('No se pudo confirmar el pago. Intenta de nuevo más tarde.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormPage>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/admision' },
          { label: 'Admisión', to: '/admision' },
          { label: 'Candidatos', to: '/admision/candidatos' },
          { label: 'Detalle', to: `/admision/candidatos/detalle?id=${ficha.id}` },
          { label: 'Confirmar Pago' },
        ]}
      />

      <FormHeader
        title="Confirmar Pago de Ficha"
        subtitle="Registra el pago de ficha del candidato para habilitarlo en el proceso de admisión."
      />

      {/* Informative card (read-only) */}
      <FormCard>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          <ReadField label="Candidato" value={ficha.nombre} />
          <ReadField label="Folio" value={ficha.folio} mono />
          <ReadField label="Programa" value={ficha.programa} />
          <ReadField label="Referencia Generada" value={ficha.referencia} mono />
          <ReadField label="Monto Esperado" value={`$${ficha.monto.toFixed(2)}`} />
        </div>
        {loadingFicha && (
          <div className="flex items-center gap-2 text-[12px] text-[#6B7280] mt-4">
            <Loader2 size={14} className="animate-spin text-[#009574]" /> Sincronizando datos con el sistema…
          </div>
        )}
        {alreadyPaid && (
          <div className="mt-4 flex items-start gap-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2.5">
            Este candidato ya figura con la ficha pagada.
          </div>
        )}
      </FormCard>

      {/* Form */}
      <FormCard>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-4">
            <FieldLabel required>Fecha de Pago</FieldLabel>
            <DatePicker value={fecha} onChange={v => { setFecha(v); clearErr('fecha') }} />
            {errors.fecha && <FieldError>{errors.fecha}</FieldError>}
          </div>
          <SelectField
            label="Método de Pago"
            required
            value={metodo}
            onChange={v => { setMetodo(v); clearErr('metodo') }}
            error={errors.metodo}
            options={METODOS_PAGO.map(m => ({ value: m, label: m }))}
            placeholder="Selecciona un método"
            className="col-span-12 sm:col-span-4"
          />
          <TextField
            label="Monto Recibido"
            required
            type="number"
            step="0.01"
            min={0}
            numeric
            value={monto}
            onChange={v => { setMonto(v); clearErr('monto') }}
            error={errors.monto}
            placeholder="500.00"
            className="col-span-12 sm:col-span-4"
          />
          <TextField
            label="Referencia Bancaria / Comprobante"
            required
            value={referenciaBancaria}
            onChange={v => { setReferenciaBancaria(v); clearErr('referencia') }}
            error={errors.referencia}
            placeholder="Número de referencia o folio del comprobante"
            className="col-span-12 sm:col-span-8"
          />
          <div className="col-span-12 sm:col-span-4">
            <FileUpload
              label="Comprobante"
              accept="application/pdf,image/*"
              value={comprobante}
              onChange={setComprobante}
            />
          </div>
        </div>
      </FormCard>

      {/* Actions */}
      <FormActions
        isView={false}
        onBack={() => navigate(`/admision/candidatos/detalle?id=${ficha.id}`)}
        onPrimary={handleConfirmar}
        primaryLabel={busy ? 'Confirmando Pago...' : 'Confirmar Pago'}
        isSubmitting={busy}
        primaryDisabled={alreadyPaid}
      />
    </FormPage>
  )
}