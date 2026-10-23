import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Search, Info } from 'lucide-react'
import { FieldLabel, FieldError, inputCls, Toast, ReadField, RadioCard } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, Button } from '@app/core/components/form'
import { Breadcrumb, SearchInput } from '@app/core/components/list'
import { apiGet, apiPost, apiPut, getApiErrorMessage } from '@app/core/infra/apiClient'
import { useRole } from '@app/core/infra/RoleContext'
import { STATUS_META, type CandidateListPage, type CandidateListRow } from '../data/types'

/**
 * Screen 14 — Aplicar Descuento (real backend, 2026-10-22).
 *
 * The flow the PO described, step by step:
 * 1. Staff (Servicios Escolares / Finanzas) look the applicant up by folio or
 *    CURP (`GET /candidates?search=`).
 * 2. The applicant's charges are listed with their price computed LIVE
 *    (`GET /finance/benefits/charges?candidateId=`): tariff in force for the
 *    concept − discount in force = total. Nothing is stored while a charge is
 *    open; the backend re-computes it again when the applicant clicks "Pagar".
 * 3. Staff pick ONE charge and register the discount on it
 *    (`POST /finance/benefits` with `paymentId`). The anchor and the concept
 *    come from the charge — this screen never sends a concept code.
 *
 * Rules (PO, 2026-10-23):
 * - ONE discount per charge. A charge that already has one opens it for
 *   EDITING (`PUT /finance/benefits/{id}`); there is no "add another".
 * - Once the charge is paid the discount can no longer be edited (read only).
 * - A discount on a charge already PAID is allowed once: the difference
 *   becomes saldo a favor for the applicant.
 *
 * A 100 % discount is `mode = FULL`: when the applicant goes to pay, the ficha
 * closes as exempt ($0 with receipt) without opening EVO.
 */

type TipoDescuento = 'PERCENT' | 'AMOUNT' | 'FULL'

/** One row of `GET /finance/benefits/charges` (`DebtQuoteResponse`). */
interface ChargeQuote {
  paymentId: string
  conceptCode: string
  conceptName: string
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'EXEMPT' | 'OVERDUE' | 'CANCELLED'
  originalAmount: number | null
  discountAmount: number | null
  amountDue: number | null
  amountPaid: number | null
  benefitId: string | null
  benefitMode: TipoDescuento | null
  benefitPercent: number | null
  benefitAmount: number | null
  benefitReason: string | null
  exempt: boolean
  live: boolean
  dueAt: string | null
  pricingError: string | null
}

/** The discount granted on a charge (`BenefitDetailResponse`). */
interface ChargeDiscount {
  id: string
  mode: TipoDescuento
  percent: number | null
  amount: number | null
  validFrom: string
  validTo: string | null
  status: 'ACTIVE' | 'USED' | 'CANCELLED' | 'EXPIRED'
  reason: string
  grantedByName: string
}

/** One row of `GET /finance/benefits/charges` (`ChargeResponse`). */
interface ChargeRow {
  charge: ChargeQuote
  discount: ChargeDiscount | null
  discountEditable: boolean
  creditAmount: number
}

interface FormErrors {
  cargo?: string
  tipo?: string
  valor?: string
  vigencia?: string
  motivo?: string
}

const CHARGE_STATUS_LABEL: Record<ChargeQuote['status'], string> = {
  PENDING: 'Pendiente',
  PARTIAL: 'Con abonos',
  PAID: 'Pagado',
  EXEMPT: 'Exento',
  OVERDUE: 'Vencido',
  CANCELLED: 'Cancelado',
}

/** Whether the charge can be opened on this screen (to add, edit or just view its discount). */
function selectable(r: ChargeRow): boolean {
  if (r.discount) return true
  return r.charge.status === 'PENDING' || r.charge.status === 'PAID'
}

/** What the screen does with the selected charge. */
type Modo = 'NUEVO' | 'EDITAR' | 'SOLO_LECTURA'

function modoDe(r: ChargeRow): Modo {
  if (!r.discount) return 'NUEVO'
  return r.discountEditable ? 'EDITAR' : 'SOLO_LECTURA'
}

const money = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

/** Today as YYYY-MM-DD in the browser's (México) zone — not UTC, which is already tomorrow after 18:00. */
function localIsoDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return localIsoDate(new Date(y, m - 1 + months, d))
}

export default function AplicarDescuento() {
  const navigate = useNavigate()
  const { user } = useRole()

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [results, setResults] = useState<CandidateListRow[]>([])
  const [candidate, setCandidate] = useState<CandidateListRow | null>(null)

  const [charges, setCharges] = useState<ChargeRow[]>([])
  const [loadingCharges, setLoadingCharges] = useState(false)
  const [chargeId, setChargeId] = useState('')

  const [tipo, setTipo] = useState<TipoDescuento | ''>('')
  const [valor, setValor] = useState('')
  const [validFrom, setValidFrom] = useState(localIsoDate())
  const [validTo, setValidTo] = useState(addMonths(localIsoDate(), 3))
  const [motivo, setMotivo] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const selectedRow = charges.find(r => r.charge.paymentId === chargeId) ?? null
  const selected = selectedRow?.charge ?? null
  const modo: Modo | null = selectedRow ? modoDe(selectedRow) : null
  const pagado = selected?.status === 'PAID'

  function resetForm() {
    setChargeId('')
    setTipo('')
    setValor('')
    setMotivo('')
    setValidFrom(localIsoDate())
    setValidTo(addMonths(localIsoDate(), 3))
    setErrors({})
  }

  async function handleBuscar() {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setErrorMsg('')
    setCandidate(null)
    setCharges([])
    resetForm()
    try {
      const page = await apiGet<CandidateListPage>('/candidates', { search: q, page: 0, size: 10 })
      setResults(page.items)
      if (page.items.length === 1) setCandidate(page.items[0])
    } catch (err) {
      setResults([])
      setErrorMsg(getApiErrorMessage(err, 'No se pudo buscar el candidato.'))
    } finally {
      setSearching(false)
      setHasSearched(true)
    }
  }

  async function loadCharges(candidateId: string) {
    setLoadingCharges(true)
    setErrorMsg('')
    try {
      const data = await apiGet<ChargeRow[]>('/finance/benefits/charges', { candidateId })
      setCharges(data)
      return data
    } catch (err) {
      setCharges([])
      setErrorMsg(getApiErrorMessage(err, 'No se pudieron cargar los cargos del candidato.'))
      return null
    } finally {
      setLoadingCharges(false)
    }
  }

  /** Opens a charge: with a discount, the form is that discount (to edit or view). */
  function selectCharge(r: ChargeRow) {
    setChargeId(r.charge.paymentId)
    setErrors({})
    const d = r.discount
    if (d) {
      setTipo(d.mode)
      setValor(d.mode === 'PERCENT' ? String(d.percent ?? '') : d.mode === 'AMOUNT' ? String(d.amount ?? '') : '')
      setValidFrom(d.validFrom)
      setValidTo(d.validTo ?? d.validFrom)
      setMotivo(d.reason)
    } else {
      setTipo('')
      setValor('')
      setMotivo('')
      setValidFrom(localIsoDate())
      setValidTo(addMonths(localIsoDate(), 3))
    }
  }

  useEffect(() => {
    if (candidate) void loadCharges(candidate.id)
  }, [candidate])

  /** Preview of what the discount does to the selected charge's live tariff. */
  function preview(): { descuento: number; total: number; saldoAFavor: number } | null {
    if (!selected || selected.originalAmount == null || !tipo) return null
    const original = selected.originalAmount
    let descuento = 0
    if (tipo === 'FULL') descuento = original
    else if (tipo === 'PERCENT') descuento = Math.round(original * (Number(valor) || 0)) / 100
    else descuento = Math.min(Number(valor) || 0, original)
    const total = Math.max(original - descuento, 0)
    const saldoAFavor = pagado ? Math.max((selected.amountPaid ?? 0) - total, 0) : 0
    return { descuento, total, saldoAFavor }
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!selected) e.cargo = 'Selecciona el cargo al que se aplicará el descuento.'
    if (!tipo) e.tipo = 'Selecciona el tipo de descuento.'
    if (tipo === 'PERCENT') {
      const n = Number(valor)
      if (!valor.trim() || isNaN(n) || n <= 0 || n > 100) e.valor = 'El porcentaje debe ser mayor a 0 y hasta 100.'
    }
    if (tipo === 'AMOUNT') {
      const n = Number(valor)
      if (!valor.trim() || isNaN(n) || n <= 0) e.valor = 'Ingresa un monto mayor a 0.'
    }
    if (!validFrom || !validTo) e.vigencia = 'Indica la vigencia del descuento.'
    else if (validTo < validFrom) e.vigencia = 'La fecha final no puede ser anterior a la inicial.'
    if (!motivo.trim()) e.motivo = 'Indica el motivo del descuento.'
    return e
  }

  async function handleAplicar() {
    if (modo === 'SOLO_LECTURA') return
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0 || !selected || !candidate || !selectedRow) return
    setSaving(true)
    setErrorMsg('')
    const body = {
      mode: tipo,
      percent: tipo === 'PERCENT' ? Number(valor) : null,
      amount: tipo === 'AMOUNT' ? Number(valor) : null,
      validFrom,
      validTo,
      reason: motivo.trim(),
    }
    try {
      if (modo === 'EDITAR' && selectedRow.discount) {
        await apiPut(`/finance/benefits/${selectedRow.discount.id}`, { ...body, periodId: null, generationId: null })
      } else {
        await apiPost('/finance/benefits', {
          ...body,
          paymentId: selected.paymentId,
          grantedByName: user?.name || 'Personal',
        })
      }
      const fresh = await loadCharges(candidate.id)
      const row = fresh?.find(r => r.charge.paymentId === selected.paymentId)
      if (pagado && row && row.creditAmount > 0) {
        setToast(`Descuento registrado para ${candidate.folio} — ${selected.conceptName}. El cargo ya estaba pagado: se generó un saldo a favor de ${money(row.creditAmount)}.`)
      } else if (modo === 'EDITAR') {
        setToast(`Descuento actualizado para ${candidate.folio} — ${selected.conceptName}.`)
      } else {
        setToast(`Descuento registrado para ${candidate.folio} — ${selected.conceptName}. Se aplicará cuando el aspirante pague.`)
      }
      if (row) selectCharge(row)
      else resetForm()
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, 'No se pudo guardar el descuento.'))
    } finally {
      setSaving(false)
    }
  }

  const pv = preview()

  return (
    <FormPage>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb items={[{ label: 'Inicio', to: '/admision' }, { label: 'Admisión' }, { label: 'Descuentos' }]} />

      <FormHeader
        title="Aplicar Descuento"
        subtitle="Busca al aspirante por folio o CURP, elige uno de sus cargos. Cada cargo admite un solo descuento: si ya tiene uno, se edita. El monto se calcula al momento con la tarifa vigente."
      />

      <div className="flex items-center gap-3 mb-6">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por folio o CURP" />
        <Button onClick={() => void handleBuscar()} disabled={searching || !query.trim()}>
          {searching ? 'Buscando...' : 'Buscar'}
        </Button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg px-4 py-3 mb-6">{errorMsg}</div>
      )}

      {hasSearched && !searching && results.length === 0 && !errorMsg && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg px-6 py-10 mb-6 text-center">
          <Search size={32} className="mx-auto text-[#E5E7EB] mb-3" />
          <p className="text-[13px] font-medium text-[#6B7280]">No se encontró ningún aspirante con ese folio o CURP.</p>
        </div>
      )}

      {results.length > 1 && !candidate && (
        <FormCard>
          <h2 className="text-[14px] font-semibold text-[#333333] mb-3">Selecciona al aspirante</h2>
          <div className="flex flex-col gap-2">
            {results.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setCandidate(r)}
                className="text-left border border-[#E5E7EB] rounded-lg px-4 py-3 hover:border-[#009574] text-[13px]"
              >
                <span className="font-semibold">{r.folio}</span> — {r.fullName} · {r.curp} · {r.programName}
              </button>
            ))}
          </div>
        </FormCard>
      )}

      {candidate && (
        <>
          <FormCard>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
              <ReadField label="Nombre" value={candidate.fullName} />
              <ReadField label="Folio" value={candidate.folio} mono />
              <ReadField label="CURP" value={candidate.curp} mono />
              <ReadField label="Carrera" value={candidate.programName} />
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
                <span
                  className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_META[candidate.status]?.badgeClass ?? ''}`}
                >
                  {STATUS_META[candidate.status]?.label ?? candidate.status}
                </span>
              </div>
            </div>
          </FormCard>

          <FormCard>
            <h2 className="text-[14px] font-semibold text-[#333333] mb-1">Cargos del aspirante</h2>
            <p className="text-[12px] text-[#6B7280] mb-4">Precio calculado ahora: tarifa vigente del concepto − descuento vigente.</p>
            {loadingCharges && <p className="text-[13px] text-[#6B7280]">Cargando cargos...</p>}
            {!loadingCharges && charges.length === 0 && (
              <p className="text-[13px] text-[#6B7280]">El aspirante no tiene cargos registrados.</p>
            )}
            <div className="flex flex-col gap-2">
              {charges.map(r => {
                const c = r.charge
                const disabled = !selectable(r)
                const isSelected = c.paymentId === chargeId
                return (
                  <button
                    key={c.paymentId}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectCharge(r)}
                    className={`text-left rounded-lg px-4 py-3 border text-[13px] ${
                      isSelected ? 'border-[#009574] bg-[#e6f5f1]' : 'border-[#E5E7EB]'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#009574]'}`}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-semibold">{c.conceptName}</span>
                      <span className="text-[12px] text-[#6B7280]">{CHARGE_STATUS_LABEL[c.status]}</span>
                    </div>
                    {c.pricingError ? (
                      <p className="text-[12px] text-red-600 mt-1">{c.pricingError}</p>
                    ) : (
                      <p className="mt-1">
                        Cuesta {money(c.originalAmount)} − descuento {money(c.discountAmount)} ={' '}
                        <span className="font-semibold">{money(c.amountDue)}</span>
                      </p>
                    )}
                    {r.discount && (
                      <p className="mt-1 text-[12px] text-[#6B7280]">
                        Descuento: {r.discount.mode === 'FULL' ? '100 %' : r.discount.mode === 'PERCENT' ? `${r.discount.percent} %` : money(r.discount.amount)}
                        {' · '}Motivo: {r.discount.reason}
                        {!r.discountEditable && ' · ya no se puede editar'}
                      </p>
                    )}
                    {r.creditAmount > 0 && (
                      <p className="mt-1 text-[12px] font-semibold text-[#007a5e]">Saldo a favor generado: {money(r.creditAmount)}</p>
                    )}
                  </button>
                )
              })}
            </div>
            {errors.cargo && <FieldError>{errors.cargo}</FieldError>}
          </FormCard>

          {selected && (
            <FormCard>
              <h2 className="text-[14px] font-semibold text-[#333333] mb-4">
                {modo === 'NUEVO' ? 'Registrar descuento' : modo === 'EDITAR' ? 'Editar descuento' : 'Descuento aplicado'} — {selected.conceptName}
              </h2>
              {modo === 'SOLO_LECTURA' && (
                <div className="flex items-start gap-3 rounded-lg px-4 py-3 mb-4 bg-[#F8F9FA] border border-[#E5E7EB] text-[13px] text-[#6B7280]">
                  <Info size={18} className="flex-shrink-0 mt-0.5" />
                  <p>Este cargo ya está pagado (o el descuento ya se aplicó), así que el descuento ya no se puede editar.</p>
                </div>
              )}
              {modo === 'NUEVO' && pagado && (
                <div className="flex items-start gap-3 rounded-lg px-4 py-3 mb-4 bg-amber-50 border border-amber-200 text-[13px] text-amber-800">
                  <Info size={18} className="flex-shrink-0 mt-0.5" />
                  <p>Este cargo ya está pagado. La diferencia del descuento quedará como <strong>saldo a favor</strong> del aspirante y después ya no se podrá editar.</p>
                </div>
              )}
              <fieldset disabled={modo === 'SOLO_LECTURA'} className="grid grid-cols-12 gap-4">
                <div className="col-span-12">
                  <FieldLabel required>Tipo de descuento</FieldLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <RadioCard selected={tipo === 'PERCENT'} title="Porcentaje" onSelect={() => { setTipo('PERCENT'); setValor('') }} />
                    <RadioCard selected={tipo === 'AMOUNT'} title="Monto fijo" onSelect={() => { setTipo('AMOUNT'); setValor('') }} />
                    <RadioCard selected={tipo === 'FULL'} title="Sin costo (100%)" onSelect={() => { setTipo('FULL'); setValor('') }} />
                  </div>
                  {errors.tipo && <FieldError>{errors.tipo}</FieldError>}
                </div>

                {(tipo === 'PERCENT' || tipo === 'AMOUNT') && (
                  <div className="col-span-12 sm:col-span-4">
                    <FieldLabel required>{tipo === 'PERCENT' ? 'Porcentaje' : 'Monto'}</FieldLabel>
                    <div className="relative">
                      <input
                        type="number"
                        min={tipo === 'PERCENT' ? 1 : 0.01}
                        max={tipo === 'PERCENT' ? 100 : undefined}
                        step={tipo === 'PERCENT' ? 1 : 0.01}
                        value={valor}
                        onChange={e => setValor(e.target.value)}
                        className={`${inputCls(false, !!errors.valor)} pr-8`}
                        placeholder={tipo === 'PERCENT' ? 'ej. 50' : 'ej. 250.00'}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#6B7280]">
                        {tipo === 'PERCENT' ? '%' : '$'}
                      </span>
                    </div>
                    {errors.valor && <FieldError>{errors.valor}</FieldError>}
                  </div>
                )}

                <div className="col-span-6 sm:col-span-4">
                  <FieldLabel required>Vigente desde</FieldLabel>
                  <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className={inputCls(false, !!errors.vigencia)} />
                </div>
                <div className="col-span-6 sm:col-span-4">
                  <FieldLabel required>Vigente hasta</FieldLabel>
                  <input type="date" value={validTo} onChange={e => setValidTo(e.target.value)} className={inputCls(false, !!errors.vigencia)} />
                </div>
                {errors.vigencia && <div className="col-span-12"><FieldError>{errors.vigencia}</FieldError></div>}

                <div className="col-span-12">
                  <FieldLabel required>Motivo</FieldLabel>
                  <input
                    type="text"
                    maxLength={250}
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    className={inputCls(false, !!errors.motivo)}
                    placeholder="ej. Beca por promedio"
                  />
                  {errors.motivo && <FieldError>{errors.motivo}</FieldError>}
                </div>
              </fieldset>

              {pv && modo !== 'SOLO_LECTURA' && (
                <div className={`flex items-start gap-3 rounded-lg px-4 py-3.5 mt-5 ${tipo === 'FULL' ? 'bg-blue-50 border border-blue-200' : 'bg-[#e6f5f1] border border-[#009574]/30'}`}>
                  <Info size={18} className={`flex-shrink-0 mt-0.5 ${tipo === 'FULL' ? 'text-blue-500' : 'text-[#009574]'}`} />
                  <div className={`text-[13px] ${tipo === 'FULL' ? 'text-blue-700' : 'text-[#007a5e]'}`}>
                    <p>
                      Con la tarifa de hoy: {money(selected.originalAmount)} − {money(pv.descuento)} = <strong>{money(pv.total)}</strong>.
                    </p>
                    <p className="mt-1">
                      {pagado
                        ? `Ya pagó ${money(selected.amountPaid)}: se generará un saldo a favor de ${money(pv.saldoAFavor)}.`
                        : tipo === 'FULL'
                          ? 'Al pagar, el cargo quedará exento (pago de $0 con recibo) sin pasar por la pasarela.'
                          : 'El monto final se recalcula cuando el aspirante pague, con la tarifa vigente en ese momento.'}
                    </p>
                  </div>
                </div>
              )}
            </FormCard>
          )}

          <FormActions
            isView={false}
            onBack={() => navigate('/admision')}
            onPrimary={() => void handleAplicar()}
            primaryLabel={saving ? 'Guardando...' : modo === 'EDITAR' ? 'Guardar cambios' : 'Registrar descuento'}
            isSubmitting={saving}
            primaryDisabled={!selected || modo === 'SOLO_LECTURA'}
          />
        </>
      )}
    </FormPage>
  )
}
