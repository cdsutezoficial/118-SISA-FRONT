import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, Search, BadgePercent, Info } from 'lucide-react'
import { FieldLabel, FieldError, SimpleSelect, inputCls, Toast } from '../../shared/ui'
import { mockCandidates } from '../../shared/admision/mockData'
import { STATUS_META, type Candidate } from '../../shared/admision/types'

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
 * JUDGMENT CALL — Candidate.status is NOT transitioned here: the spec's
 * "Candidate Status State Machine" requirement enumerates only ficha-payment
 * confirmation (Screen 6), Director selection (Screen 11), and matrícula
 * generation (Screen 12) as status-transitioning actions. A 100% ficha
 * discount auto-confirms the `PaymentRecord` (status -> 'EXENTO') exactly
 * like Screen 6 does for the underlying payment concept, but does not itself
 * re-implement Screen 6's `status -> 'PAID'` transition, since Screen 14 is
 * not listed among the state-machine's transitioning actions and duplicating
 * that transition here would be undocumented scope creep for a single-screen
 * mock task. A 100% "Curso de Inducción" discount also auto-enables the
 * candidate for induction (`induccionHabilitada: true`), per the spec's
 * explicit "100% induction discount auto-enables" scenario.
 */

type Concepto = 'Ficha de Admisión' | 'Curso de Inducción'
type TipoDescuento = 'Porcentaje' | 'Sin costo (100%)'

const CONCEPTOS: Concepto[] = ['Ficha de Admisión', 'Curso de Inducción']

/** Read-only summary field — mirrors the page-local `ReadField` pattern already used across the Admisión screens (`ConfirmarPagoFicha.tsx`, `PublicarResultados.tsx`, etc.). */
function ReadField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[13px] text-[#333333] ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</p>
    </div>
  )
}

/** Radio card — same shared visual as `CandidatoRegistro.tsx`'s `RadioCard` (Nacionalidad, isFirstChoice, método de pago), reproduced locally since it isn't exported there. */
function RadioCard({ selected, title, onSelect }: { selected: boolean; title: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors ${
        selected ? 'border-[#009574] bg-[#e6f5f1]' : 'border-[#E5E7EB] bg-white hover:border-[#009574]/50'
      }`}
    >
      <span
        className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
          selected ? 'border-[#009574]' : 'border-[#E5E7EB]'
        }`}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-[#009574]" />}
      </span>
      <span className="text-[13px] font-semibold text-[#333333]">{title}</span>
    </button>
  )
}

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

    setResultCandidate({
      ...resultCandidate,
      [target]: updatedRecord,
      // 100% induction discount also auto-enables the candidate for induction.
      ...(concepto === 'Curso de Inducción' && tipo === 'Sin costo (100%)' ? { induccionHabilitada: true } : {}),
    })

    const detalle = tipo === 'Sin costo (100%)' ? 'sin costo' : `${porcentaje}% de descuento`
    setToast(`Descuento aplicado. Folio ${resultCandidate.folio} — ${concepto}: ${detalle}.`)
  }

  const showBanner = tipo !== ''
  const bannerIsFree = tipo === 'Sin costo (100%)'

  return (
    <div className="max-w-[900px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/admision')} className="hover:text-[#009574] transition-colors">
          Inicio
        </button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Admisión</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Descuentos</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Aplicar Descuento</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Busca un candidato y aplica un descuento a su pago de ficha de admisión o al curso de inducción.
        </p>
      </div>

      {/* Search bar (full width) */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Buscar por folio, nombre completo o CURP"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleBuscar() }}
            className="w-full pl-9 pr-3 py-2.5 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] transition"
          />
        </div>
        <button
          onClick={handleBuscar}
          className="px-4 py-2.5 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
        >
          Buscar
        </button>
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
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-6 py-5 mb-6">
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
          </div>

          {/* Configurar descuento */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
            <h2 className="text-[14px] font-semibold text-[#333333] mb-4">Configurar descuento</h2>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel required>Concepto</FieldLabel>
                <SimpleSelect
                  options={CONCEPTOS}
                  value={concepto}
                  onChange={v => { setConcepto(v as Concepto); clearErr('concepto') }}
                  placeholder="Selecciona un concepto"
                />
                {errors.concepto && <FieldError>{errors.concepto}</FieldError>}
              </div>
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
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => navigate('/admision')}
              className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAplicar}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
            >
              <BadgePercent size={14} />Aplicar Descuento
            </button>
          </div>
        </>
      )}
    </div>
  )
}
