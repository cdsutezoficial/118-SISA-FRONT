import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Search, Info } from 'lucide-react'
import { FieldLabel, FieldError, inputCls, Toast, ReadField, RadioCard } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, Button, SelectField } from '@app/core/components/form'
import { Breadcrumb, SearchInput } from '@app/core/components/list'
import { mockCandidates } from '../data/mockData'
import { STATUS_META, type Candidate } from '../data/types'

/**
 * Screen 14 — Aplicar Descuento a Pago de Admisión, per `03-admision.md`
 * ("Pantalla 14 — Aplicar Descuento a Pago de Admisión") and
 * `specs/admision-screens/spec.md`'s "Aplicar Descuento (Screen 14)"
 * requirement. Role: Servicios Escolares. Route: `/admision/descuentos`.
 *
 * Search-then-act pattern (distinct from `CandidatosList.tsx`'s live-filter
 * search): the candidate result card and "Configurar descuento" section only
 * appear after the user explicitly clicks [Buscar], per the original prompt's
 * "card que aparece tras buscar" wording.
 *
 * MOCK-ONLY LIMITATION (persistence): same limitation as every other
 * Admisión write-action screen (Screens 6, 8, 10, 11, 12, 9) — `mockCandidates`
 * is a static in-memory array with no shared mutation store across pages.
 * "Aplicar Descuento" therefore only updates a LOCAL copy of the found
 * candidate's targeted `PaymentRecord` (for the "card del candidato
 * actualizada" behavior the original prompt describes) and shows a success
 * toast; it does NOT mutate `mockCandidates`, so other screens (e.g.
 * `CandidatosList.tsx`) will still show the original payment/status data.
 *
 * CORRECTION (2026-07-02, PO review): a 100% Ficha de Admisión discount IS a
 * ficha-payment confirmation in every practical sense — the UX prompt itself
 * says "El sistema confirmará automáticamente este pago" — so it MUST trigger
 * the same `status -> 'PAID'` transition Screen 6 performs, not just mark the
 * `PaymentRecord` as `EXENTO`. Screen 15 (Habilitar Inducción) filters
 * candidates by "ficha pagada" — leaving status at `REGISTERED` after a 100%
 * ficha discount would incorrectly exclude these candidates. This is now
 * folded into the state machine as an equivalent path to Screen 6, not a new
 * transitioning action. A 100% "Curso de Inducción" discount also auto-enables
 * the candidate for induction (`induccionHabilitada: true`), per the spec's
 * explicit "100% induction discount auto-enables" scenario — induction
 * payment never transitions `Candidate.status` either way.
 */

type Concepto = 'Ficha de Admisión' | 'Curso de Inducción'
type TipoDescuento = 'Porcentaje' | 'Sin costo (100%)'

const CONCEPTOS: Concepto[] = ['Ficha de Admisión', 'Curso de Inducción']

interface FormErrors {
  concepto?: string
  tipo?: string
  porcentaje?: string
}

export default function AplicarDescuento() {
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [resultCandidate, setResultCandidate] = useState<Candidate | null>(null)

  const [concepto, setConcepto] = useState<Concepto | ''>('')
  const [tipo, setTipo] = useState<TipoDescuento | ''>('')
  const [porcentaje, setPorcentaje] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [toast, setToast] = useState('')

  function handleBuscar() {
    const q = query.trim().toLowerCase()
    const found = q
      ? mockCandidates.find(
          c =>
            c.folio.toLowerCase().includes(q) ||
            c.nombre.toLowerCase().includes(q) ||
            c.curp.toLowerCase().includes(q),
        )
      : undefined

    setResultCandidate(found ?? null)
    setHasSearched(true)
    // Reset the discount form whenever a new search is performed.
    setConcepto('')
    setTipo('')
    setPorcentaje('')
    setErrors({})
    setSubmitted(false)
  }

  function clearErr(field: keyof FormErrors) {
    if (submitted) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!concepto) e.concepto = 'Selecciona el concepto del descuento.'
    if (!tipo) e.tipo = 'Selecciona el tipo de descuento.'
    if (tipo === 'Porcentaje') {
      if (!porcentaje.trim()) e.porcentaje = 'Ingresa el porcentaje de descuento.'
      else {
        const n = Number(porcentaje)
        if (isNaN(n) || n < 1 || n > 99) e.porcentaje = 'El porcentaje debe estar entre 1 y 99.'
      }
    }
    return e
  }

  function handleAplicar() {
    const e = validate()
    setSubmitted(true)
    if (Object.keys(e).length > 0 || !resultCandidate) { setErrors(e); return }

    const target = concepto === 'Ficha de Admisión' ? 'pagoFicha' : 'pagoInduccion'
    const original = resultCandidate[target]
    const updatedRecord =
      tipo === 'Sin costo (100%)'
        ? { ...original, status: 'EXENTO' as const, montoOriginal: original.monto, monto: 0 }
        : { ...original, montoOriginal: original.monto, monto: Number((original.monto * (1 - Number(porcentaje) / 100)).toFixed(2)) }

    const fichaExentaConfirmaPago =
      concepto === 'Ficha de Admisión' && tipo === 'Sin costo (100%)' && resultCandidate.status === 'REGISTERED'

    setResultCandidate({
      ...resultCandidate,
      [target]: updatedRecord,
      // A 100% ficha discount auto-confirms the payment — same transition as Screen 6.
      ...(fichaExentaConfirmaPago ? { status: 'PAID' as const } : {}),
      // 100% induction discount also auto-enables the candidate for induction.
      ...(concepto === 'Curso de Inducción' && tipo === 'Sin costo (100%)' ? { induccionHabilitada: true } : {}),
    })

    const detalle = tipo === 'Sin costo (100%)' ? 'sin costo' : `${porcentaje}% de descuento`
    setToast(`Descuento aplicado. Folio ${resultCandidate.folio} — ${concepto}: ${detalle}.`)
  }

  const showBanner = tipo !== ''
  const bannerIsFree = tipo === 'Sin costo (100%)'

  return (
    <FormPage>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/admision' },
          { label: 'Admisión' },
          { label: 'Descuentos' },
        ]}
      />

      <FormHeader
        title="Aplicar Descuento"
        subtitle="Busca un candidato y aplica un descuento a su pago de ficha de admisión o al curso de inducción."
      />

      {/* Search bar (full width) */}
      <div className="flex items-center gap-3 mb-6">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar por folio, nombre completo o CURP"
        />
        <Button onClick={handleBuscar}>Buscar</Button>
      </div>

      {hasSearched && !resultCandidate && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg px-6 py-10 mb-6 text-center">
          <Search size={32} className="mx-auto text-[#E5E7EB] mb-3" />
          <p className="text-[13px] font-medium text-[#6B7280]">No se encontró ningún candidato con ese folio, nombre o CURP.</p>
        </div>
      )}

      {resultCandidate && (
        <>
          {/* Result card (read-only) */}
          <FormCard>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
              <ReadField label="Nombre" value={resultCandidate.nombre} />
              <ReadField label="Folio" value={resultCandidate.folio} mono />
              <ReadField label="CURP" value={resultCandidate.curp} mono />
              <ReadField label="Programa" value={resultCandidate.programa} />
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
                <span
                  className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_META[resultCandidate.status].badgeClass}`}
                >
                  {STATUS_META[resultCandidate.status].label}
                </span>
              </div>
            </div>
          </FormCard>

          {/* Configurar descuento */}
          <FormCard>
            <h2 className="text-[14px] font-semibold text-[#333333] mb-4">Configurar descuento</h2>
            <div className="grid grid-cols-12 gap-4">
              <SelectField
                label="Concepto"
                required
                value={concepto}
                onChange={v => { setConcepto(v as Concepto); clearErr('concepto') }}
                error={errors.concepto}
                options={CONCEPTOS.map(c => ({ value: c, label: c }))}
                placeholder="Selecciona un concepto"
                className="col-span-12 sm:col-span-6"
              />
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel required>Tipo de descuento</FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  <RadioCard
                    selected={tipo === 'Porcentaje'}
                    title="Porcentaje"
                    onSelect={() => { setTipo('Porcentaje'); clearErr('tipo') }}
                  />
                  <RadioCard
                    selected={tipo === 'Sin costo (100%)'}
                    title="Sin costo (100%)"
                    onSelect={() => { setTipo('Sin costo (100%)'); setPorcentaje(''); clearErr('tipo') }}
                  />
                </div>
                {errors.tipo && <FieldError>{errors.tipo}</FieldError>}
              </div>

              {tipo === 'Porcentaje' && (
                <div className="col-span-12 sm:col-span-4">
                  <FieldLabel required>Porcentaje de descuento</FieldLabel>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={porcentaje}
                      onChange={e => { setPorcentaje(e.target.value); clearErr('porcentaje') }}
                      className={`${inputCls(false, !!errors.porcentaje)} pr-8`}
                      placeholder="ej. 50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#6B7280]">%</span>
                  </div>
                  {errors.porcentaje && <FieldError>{errors.porcentaje}</FieldError>}
                </div>
              )}
            </div>

            {/* Dynamic informative banner */}
            {showBanner && (
              <div
                className={`flex items-start gap-3 rounded-lg px-4 py-3.5 mt-5 ${
                  bannerIsFree ? 'bg-blue-50 border border-blue-200' : 'bg-[#e6f5f1] border border-[#009574]/30'
                }`}
              >
                <Info size={18} className={`flex-shrink-0 mt-0.5 ${bannerIsFree ? 'text-blue-500' : 'text-[#009574]'}`} />
                <div className={`text-[13px] ${bannerIsFree ? 'text-blue-700' : 'text-[#007a5e]'}`}>
                  {bannerIsFree ? (
                    <>
                      <p>El sistema confirmará automáticamente este pago. El candidato no tendrá que realizar ningún trámite.</p>
                      {concepto === 'Curso de Inducción' && (
                        <p className="mt-1">El candidato también quedará habilitado automáticamente para el curso de inducción.</p>
                      )}
                    </>
                  ) : (
                    <p>Se aplicará un {porcentaje || '__'}% de descuento sobre el monto original del pago.</p>
                  )}
                </div>
              </div>
            )}
          </FormCard>

          {/* Actions */}
          <FormActions
            isView={false}
            onBack={() => navigate('/admision')}
            onPrimary={handleAplicar}
            primaryLabel="Aplicar Descuento"
          />
        </>
      )}
    </FormPage>
  )
}
