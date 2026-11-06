import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Banknote, CheckCircle2, Printer, Wallet } from 'lucide-react'
import { ReadField, Toast } from '@app/core/components/ui'
import { Checkbox } from '@app/core/ui/checkbox'
import { Button, FormPage, FormHeader, FormCard } from '@app/core/components/form'
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
 * Cobra la ficha o la diferencia que dejó un cambio de carrera. Si la persona tiene
 * saldo a favor, por defecto se usa primero y en efectivo solo se cobra lo que falta;
 * si el saldo cubre todo, no se recibe dinero. El comprobante se reimprime con la
 * ficha en PDF.
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
  const [cobrando, setCobrando] = useState(false)
  const [recibo, setRecibo] = useState<PaymentConfirmationBackend | null>(null)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [toast, setToast] = useState('')
  // D12: la persona elige si usa su saldo; caja le pregunta.
  const [usarSaldo, setUsarSaldo] = useState(false)
  const [saldoUsado, setSaldoUsado] = useState(0)

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

  const adeudo = cobro ? Number(cobro.toCollect) : 0
  const saldoDisponible = cobro ? Number(cobro.availableCredit ?? 0) : 0
  const saldoAplicado = usarSaldo ? Math.min(saldoDisponible, adeudo) : 0
  const aCobrar = Math.round((adeudo - saldoAplicado) * 100) / 100
  const soloSaldo = saldoAplicado > 0 && aCobrar === 0

  async function registrarCobro() {
    if (!cobro) return
    setCobrando(true)
    try {
      const res = await apiPost<PaymentConfirmationBackend>(`/candidates/${id}/cash-payment`, {
        expectedAmount: aCobrar,
        useCredit: saldoAplicado > 0,
      })
      setSaldoUsado(saldoAplicado)
      setRecibo(res)
    } catch (err) {
      setToast((err as Partial<ApiError>).code === CASH_AMOUNT_CHANGED
        ? getApiErrorMessage(err, 'El monto a cobrar cambió. Revisa el nuevo monto.')
        : getApiErrorMessage(err, 'No se pudo registrar el cobro. No entregues comprobante.'))
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
              {saldoUsado > 0 && aCobrar === 0 ? (
                <>Se aplicaron <span className="font-semibold text-[#333333]">{mxn(saldoUsado)}</span> de saldo a
                  favor; no se recibió efectivo. </>
              ) : saldoUsado > 0 ? (
                <>Se aplicaron <span className="font-semibold text-[#333333]">{mxn(saldoUsado)}</span> de saldo a
                  favor y se recibieron <span className="font-semibold text-[#333333]">{mxn(Number(recibo.amount))}</span> en
                  efectivo. </>
              ) : (
                <>Se recibieron <span className="font-semibold text-[#333333]">{mxn(Number(recibo.amount))}</span> en
                  efectivo. </>
              )}
              Recibo <span className="font-mono font-semibold text-[#333333]">{recibo.receiptNumber}</span>.
              El candidato recibe su comprobante por correo.
            </p>
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
          {cobro.onlineSessionOpen && (
            <div className="mb-5 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-4 text-[12px] leading-relaxed text-[#92400E]">
              <p className="font-semibold">Tiene un pago en línea abierto sin cobrar.</p>
              <p>
                Puedes cobrar en efectivo. Pídele que cierre el pago en línea: si aun así lo termina, ese cobro
                quedará como saldo a favor a su nombre.
              </p>
            </div>
          )}
          {saldoDisponible > 0 && (
            <label
              htmlFor="usar-saldo"
              className={`mb-5 flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                usarSaldo ? 'border-[#009574] bg-[#E6F4F1]' : 'border-[#E5E7EB] bg-[#F9FAFB]'
              }`}
            >
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                usarSaldo ? 'bg-[#009574] text-white' : 'bg-[#E5E7EB] text-[#6B7280]'
              }`}>
                <Wallet size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#333333]">
                  Tiene {mxn(saldoDisponible)} de saldo a favor
                </p>
                <p className="text-[12px] text-[#6B7280]">
                  {!usarSaldo
                    ? 'Pregúntale si quiere usarlo. Si no, se cobra todo en efectivo.'
                    : soloSaldo
                      ? 'Cubre todo el adeudo: no se recibe efectivo.'
                      : `Se usan ${mxn(saldoAplicado)} y el resto se cobra en efectivo.`}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[12px] font-medium text-[#333333]">
                <Checkbox
                  id="usar-saldo"
                  checked={usarSaldo}
                  onCheckedChange={v => setUsarSaldo(v === true)}
                  disabled={cobrando}
                  className="size-5 border-[#9CA3AF] bg-white data-[state=checked]:border-[#009574] data-[state=checked]:bg-[#009574] data-[state=checked]:text-white"
                />
                Usar saldo
              </div>
            </label>
          )}

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
            {saldoAplicado > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-[#6B7280]">Saldo a favor aplicado</dt>
                <dd className="font-semibold text-[#009574]">− {mxn(saldoAplicado)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-dashed border-[#E5E7EB] pt-2">
              <dt className="font-semibold text-[#333333]">A cobrar en efectivo</dt>
              <dd className="text-[20px] font-bold text-[#009574]">{mxn(aCobrar)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button variant="secondary" onClick={() => navigate('/caja')} disabled={cobrando}>Cancelar</Button>
            <Button onClick={() => void registrarCobro()} loading={cobrando}>
              <Banknote size={14} /> {soloSaldo ? 'Aplicar saldo a favor' : `Registrar cobro de ${mxn(aCobrar)}`}
            </Button>
          </div>
        </FormCard>
      )}
    </FormPage>
  )
}
