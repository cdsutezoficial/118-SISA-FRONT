import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Banknote, CheckCircle2, Printer } from 'lucide-react'
import { ReadField, Toast } from '@app/core/components/ui'
import { Button, FormPage, FormHeader, FormCard, TextField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner, LoadingState } from '@app/core/components/list'
import {
  apiDownload, apiGet, apiPost, getApiErrorMessage, saveBlobDownload, type ApiError,
} from '@app/core/infra/apiClient'
import type { CandidateFichaBackend, CashPaymentPreviewBackend, PaymentConfirmationBackend } from '../data/types'

/**
 * Cobro en efectivo en caja (F1). Lo usan Caja y Finanzas.
 *
 * Dos pasos, porque el dinero es físico:
 * 1. `GET /candidates/{id}/cash-payment` revisa todo lo que puede impedir el cobro
 *    (ficha vencida, sin cupo, un pago en línea en curso, ya pagada, descuento del
 *    100 %) y dice cuánto cobrar. Si algo lo impide, se muestra el motivo y no hay
 *    botón de cobro: el dinero no se recibe.
 * 2. `POST /candidates/{id}/cash-payment` con el monto mostrado vuelve a revisar y
 *    registra el cobro como efectivo, con quién cobró y el recibo. Si el monto cambió
 *    en medio (409 `ADMISSION_CASH_AMOUNT_CHANGED`), no registra nada y se vuelve a
 *    consultar.
 *
 * Cobra la ficha o la diferencia que dejó un cambio de carrera. El comprobante se
 * reimprime con la ficha en PDF.
 */

const CASH_AMOUNT_CHANGED = 'ADMISSION_CASH_AMOUNT_CHANGED'

const mxn = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface DatosFicha {
  folio: string
  nombre: string
  programa: string
}

export default function ConfirmarPagoFicha() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [datos, setDatos] = useState<DatosFicha | null>(null)
  const [cobro, setCobro] = useState<CashPaymentPreviewBackend | null>(null)
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(true)
  const [recibido, setRecibido] = useState('')
  const [errorRecibido, setErrorRecibido] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [recibo, setRecibo] = useState<PaymentConfirmationBackend | null>(null)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [toast, setToast] = useState('')

  const consultar = useCallback(async () => {
    setCargando(true)
    setMotivo('')
    try {
      setCobro(await apiGet<CashPaymentPreviewBackend>(`/candidates/${id}/cash-payment`))
    } catch (err) {
      setCobro(null)
      setMotivo(getApiErrorMessage(err, 'No se pudo consultar el adeudo del candidato.'))
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => {
    if (!id) {
      setCargando(false)
      setMotivo('Falta el candidato. Búscalo desde Caja.')
      return
    }
    apiGet<CandidateFichaBackend>(`/candidates/${id}`)
      .then(f => setDatos({
        folio: f.folio,
        nombre: `${f.firstName} ${f.lastName1} ${f.lastName2}`.trim(),
        programa: f.programName,
      }))
      .catch(() => setDatos(null))
    void consultar()
  }, [id, consultar])

  const aCobrar = cobro ? Number(cobro.toCollect) : 0
  const efectivo = Number(recibido)
  const cambio = recibido.trim() && !Number.isNaN(efectivo) && efectivo >= aCobrar ? efectivo - aCobrar : null

  async function registrarCobro() {
    if (!cobro) return
    if (recibido.trim() && (Number.isNaN(efectivo) || efectivo < aCobrar)) {
      setErrorRecibido(`El efectivo recibido no alcanza: faltan ${mxn(aCobrar - (Number.isNaN(efectivo) ? 0 : efectivo))}.`)
      return
    }
    setCobrando(true)
    try {
      setRecibo(await apiPost<PaymentConfirmationBackend>(`/candidates/${id}/cash-payment`, {
        expectedAmount: aCobrar,
      }))
    } catch (err) {
      setToast(getApiErrorMessage(err, 'No se pudo registrar el cobro. No entregues comprobante.'))
      if ((err as Partial<ApiError>).code === CASH_AMOUNT_CHANGED) setRecibido('')
      await consultar()
    } finally {
      setCobrando(false)
    }
  }

  async function reimprimir() {
    setImprimiendo(true)
    try {
      saveBlobDownload(await apiDownload(`/candidates/${id}/ficha.pdf`), `ficha-admision-${datos?.folio ?? id}.pdf`)
    } catch {
      setToast('No se pudo generar el comprobante en PDF.')
    } finally {
      setImprimiendo(false)
    }
  }

  return (
    <FormPage>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb items={[{ label: 'Caja', to: '/caja' }, { label: 'Cobro en efectivo' }]} />

      <FormHeader
        title={cobro?.programChange ? 'Cobro de diferencia por cambio de carrera' : 'Cobro de ficha en efectivo'}
        subtitle="Revisa el monto antes de recibir el dinero. Solo se cobra en efectivo."
      />

      <FormCard>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <ReadField label="Candidato" value={datos?.nombre ?? '—'} />
          <ReadField label="Folio" value={datos?.folio ?? cobro?.folio ?? '—'} mono />
          <ReadField label="Carrera" value={datos?.programa ?? '—'} />
          <ReadField label="Referencia" value={cobro?.referenceNumber ?? '—'} mono />
        </div>
      </FormCard>

      {cargando ? (
        <FormCard>
          <LoadingState label="Consultando el adeudo…" />
        </FormCard>
      ) : recibo ? (
        <FormCard>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 size={36} className="text-[#009574]" />
            <p className="text-[16px] font-bold text-[#333333]">Cobro registrado</p>
            <p className="text-[13px] text-[#6B7280]">
              Se recibieron <span className="font-semibold text-[#333333]">{mxn(Number(recibo.amount))}</span> en
              efectivo. Recibo <span className="font-mono font-semibold text-[#333333]">{recibo.receiptNumber}</span>.
              El candidato recibe su comprobante por correo.
            </p>
            {cambio != null && cambio > 0 && (
              <p className="text-[13px] font-semibold text-[#92400E]">Entrega de cambio: {mxn(cambio)}</p>
            )}
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Button variant="secondary" onClick={() => void reimprimir()} loading={imprimiendo}>
                <Printer size={14} /> Imprimir comprobante
              </Button>
              <Button onClick={() => navigate('/caja')}>Cobrar a otro candidato</Button>
            </div>
          </div>
        </FormCard>
      ) : !cobro ? (
        <FormCard>
          <ErrorBanner message={motivo} />
          <p className="text-[12px] text-[#6B7280]">No recibas el dinero. El candidato no puede pagar en caja por ahora.</p>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => navigate('/caja')}>Regresar</Button>
          </div>
        </FormCard>
      ) : (
        <FormCard>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-[#6B7280]">{cobro.programChange ? 'Total de la carrera nueva' : 'Total de la ficha'}</dt>
              <dd className="font-semibold text-[#333333]">{mxn(Number(cobro.total))}</dd>
            </div>
            {Number(cobro.alreadyPaid) > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-[#6B7280]">Pagado anteriormente</dt>
                <dd className="font-semibold text-[#333333]">{mxn(Number(cobro.alreadyPaid))}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-dashed border-[#E5E7EB] pt-2">
              <dt className="font-semibold text-[#333333]">A cobrar en efectivo</dt>
              <dd className="text-[20px] font-bold text-[#009574]">{mxn(aCobrar)}</dd>
            </div>
          </dl>

          <div className="mt-5 grid grid-cols-12 gap-4">
            <TextField
              label="Efectivo recibido (opcional, para calcular el cambio)"
              type="number"
              step="0.01"
              min={0}
              numeric
              value={recibido}
              onChange={v => { setRecibido(v); setErrorRecibido('') }}
              error={errorRecibido}
              placeholder={aCobrar.toFixed(2)}
              className="col-span-12 sm:col-span-6"
            />
            {cambio != null && (
              <div className="col-span-12 sm:col-span-6 flex items-end pb-2 text-[13px] text-[#333333]">
                Cambio: <span className="ml-1 font-semibold">{mxn(cambio)}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button variant="secondary" onClick={() => navigate('/caja')} disabled={cobrando}>Cancelar</Button>
            <Button onClick={() => void registrarCobro()} loading={cobrando}>
              <Banknote size={14} /> Registrar cobro de {mxn(aCobrar)}
            </Button>
          </div>
        </FormCard>
      )}
    </FormPage>
  )
}
