import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  UserCheck, CreditCard, ClipboardCheck, GraduationCap, PencilLine, PiggyBank, ArrowRight, Receipt,
  History, Wallet, Clock,
} from 'lucide-react'
import { Toast, Tabs, ReadField } from '@app/core/components/ui'
import { FormHeader, FormCard, Button } from '@app/core/components/form'
import { Breadcrumb, PageContainer, BadgePill, ErrorBanner, type BadgeStyle } from '@app/core/components/list'
import { apiGet, getApiErrorMessage } from '@app/core/infra/apiClient'
import { usePendingToast } from '@app/core/infra/hooks'
import { useRole } from '@app/core/infra/RoleContext'
import { DesgloseCobro } from '../components/DesgloseCobro'
import {
  type CandidateDetailBackend,
  type CandidateDetailPaymentBackend,
  type CandidateAccountBackend,
  type CandidateCharge,
  type CandidateChargeRole,
  type FinancePaymentStatus,
  STATUS_META,
  type CandidateStatus,
} from '../data/types'

// ─── Tabs ───────────────────────────────────────────────────────────────────

type TabKey = 'info' | 'pagos' | 'examen' | 'induccion'

// ─── Badge maps (para BadgePill core) ─────────────────────────────────────────

const statusBadgeMap: Record<string, BadgeStyle> = Object.fromEntries(
  (Object.keys(STATUS_META) as CandidateStatus[]).map(s => [s, { label: STATUS_META[s].label, className: STATUS_META[s].badgeClass }]),
)

/** Estado del cargo en Finanzas. */
const chargeBadgeMap: Record<FinancePaymentStatus, BadgeStyle> = {
  PENDING: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  PARTIAL: { label: 'Pago parcial', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  PAID: { label: 'Pagado', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  EXEMPT: { label: 'Exento', className: 'bg-sky-50 text-sky-700 border border-sky-200' },
  OVERDUE: { label: 'Vencido', className: 'bg-red-50 text-red-700 border border-red-200' },
  CANCELLED: { label: 'Cancelado', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
}

const inductionBadgeMap: Record<CandidateDetailPaymentBackend['paymentStatus'], BadgeStyle> = {
  PENDING: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  PAID: { label: 'Confirmado', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
}

const ROLE_META: Record<CandidateChargeRole, { title: string; hint: string }> = {
  CURRENT_FICHA: { title: 'Ficha de admisión vigente', hint: 'El cobro que cuenta para su lugar.' },
  PENDING_DIFFERENCE: {
    title: 'Diferencia por cambio de carrera',
    hint: 'Lo que falta pagar en el portal de la ficha después de cambiar a una carrera más cara.',
  },
  HISTORY: {
    title: 'Ficha anterior',
    hint: 'Se reemplazó por un cambio de carrera. Lo pagado se abonó al cobro nuevo.',
  },
  OTHER: { title: 'Otro cobro', hint: '' },
}

const METHOD_LABEL: Record<string, string> = {
  ONLINE: 'Pago en línea',
  CARD: 'Tarjeta en caja',
  CASH: 'Efectivo en caja',
  CREDIT: 'Saldo a favor',
}

const GENDER_LABEL: Record<string, string> = { M: 'Masculino', F: 'Femenino', NB: 'No binario' }

const MARITAL_LABEL: Record<string, string> = {
  SOLTERO: 'Soltero(a)',
  CASADO: 'Casado(a)',
  UNION_LIBRE: 'Unión libre',
  DIVORCIADO: 'Divorciado(a)',
  VIUDO: 'Viudo(a)',
  OTRO: 'Otro',
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  // yyyy-MM-dd sin hora: es una fecha local, no un instante.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return Number(amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

const yesNo = (value: boolean | null | undefined) => (value ? 'Sí' : 'No')

/** "Sí — descripción" cuando aplica, "No" cuando no. */
const yesWith = (value: boolean, detail: string | null | undefined) => (value ? (detail ? `Sí — ${detail}` : 'Sí') : 'No')

const join = (...parts: (string | null | undefined)[]) => parts.filter(p => p && p.trim()).join(', ')

// ─── Bloques de presentación ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <FormCard>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{children}</div>
    </FormCard>
  )
}

function Amount({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'green' | 'amber' }) {
  const color = tone === 'green' ? 'text-[#009574]' : tone === 'amber' ? 'text-amber-700' : 'text-[#333333]'
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[15px] font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

/**
 * @param live la ficha cotizada en vivo (`/detail`). Un cobro sin pagar no
 *             guarda montos hasta que se paga; para la ficha vigente se usa esta
 *             cotización, la misma que ve el aspirante.
 */
function ChargeCard({ charge, live }: { charge: CandidateCharge; live?: CandidateDetailPaymentBackend | null }) {
  const role = ROLE_META[charge.role]
  const muted = charge.role === 'HISTORY' || charge.status === 'CANCELLED'
  const accent = charge.role === 'PENDING_DIFFERENCE'
    ? 'border-amber-300'
    : charge.role === 'CURRENT_FICHA' ? 'border-[#009574]/40' : 'border-[#E5E7EB]'
  const useLive = live != null && charge.status !== 'PAID'
  const costo = useLive ? live.originalAmount ?? live.amount : charge.originalAmount ?? charge.amountDue
  const descuento = useLive ? live.discountAmount : charge.discountAmount
  const motivo = useLive ? live.discountReason : charge.discountReason
  const total = useLive ? live.amount : charge.amountDue
  const balance = useLive ? Math.max((live.amount ?? 0) - charge.amountPaid, 0) : charge.balance ?? 0

  return (
    <div className={`rounded-xl border ${accent} bg-white overflow-hidden ${muted ? 'opacity-90' : ''}`}>
      <div className={`flex flex-wrap items-start justify-between gap-3 px-5 py-4 ${muted ? 'bg-[#F9FAFB]' : charge.role === 'PENDING_DIFFERENCE' ? 'bg-amber-50' : 'bg-[#e6f5f1]/40'}`}>
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-[#333333]">{role.title}</p>
          <p className="text-[12px] text-[#6B7280]">
            {charge.programName ?? charge.conceptCode}
            {charge.referenceNumber && <> · <span className="font-mono">{charge.referenceNumber}</span></>}
          </p>
          {role.hint && <p className="mt-1 text-[11px] text-[#9CA3AF]">{role.hint}</p>}
        </div>
        <BadgePill value={charge.status} map={chargeBadgeMap} />
      </div>

      <div className="px-5 py-4">
        <DesgloseCobro
          concepto={useLive ? live.conceptName : null}
          costo={costo}
          descuento={descuento}
          motivo={motivo}
          total={total}
          pagado={charge.status === 'PAID'}
        />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Amount label="Abonado" value={formatCurrency(charge.amountPaid)} tone="green" />
          {/* Lo que falta para cubrir ESTE cobro; no es el saldo a favor. */}
          <Amount
            label="Falta pagar"
            value={charge.status === 'CANCELLED' ? '—' : balance > 0 ? formatCurrency(balance) : 'Nada, liquidado'}
            tone={balance > 0 && charge.status !== 'CANCELLED' ? 'amber' : 'green'}
          />
        </div>
        {charge.dueAt && balance > 0 && charge.status !== 'CANCELLED' && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-amber-700">
            <Clock size={13} /> Fecha límite: {formatDate(charge.dueAt)}
          </p>
        )}

        {charge.entries.length > 0 && (
          <div className="mt-4 border-t border-[#E5E7EB] pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2">Abonos</p>
            <ul className="divide-y divide-dashed divide-[#E5E7EB]">
              {charge.entries.map((entry, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-[13px]">
                  <span className="flex items-center gap-2 text-[#333333]">
                    {entry.method === 'CREDIT' ? <PiggyBank size={14} className="text-sky-600" /> : <Receipt size={14} className="text-[#009574]" />}
                    {METHOD_LABEL[entry.method ?? ''] ?? entry.method ?? 'Abono'}
                    <span className="text-[12px] text-[#9CA3AF]">{formatDateTime(entry.paidAt)}</span>
                  </span>
                  <span className="flex items-baseline gap-3">
                    {entry.receiptNumber && <span className="font-mono text-[11px] text-[#6B7280]">{entry.receiptNumber}</span>}
                    <span className="font-semibold tabular-nums text-[#333333]">{formatCurrency(entry.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function CandidatoDetalle() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get('id')
  const { hasPermission } = useRole()
  const canEditFicha = hasPermission('CANDIDATES_UPDATE')

  const pendingToast = usePendingToast()
  const [activeTab, setActiveTab] = useState<TabKey>('info')
  const [toast, setToast] = useState(pendingToast ?? '')
  const [candidate, setCandidate] = useState<CandidateDetailBackend | null>(null)
  const [loadStatus, setLoadStatus] = useState<'loading' | 'idle' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [account, setAccount] = useState<CandidateAccountBackend | null>(null)
  const [accountStatus, setAccountStatus] = useState<'loading' | 'idle' | 'error'>('loading')
  const [accountError, setAccountError] = useState('')

  useEffect(() => {
    if (!idParam) {
      setLoadStatus('error')
      setErrorMsg('Falta el id del candidato a consultar.')
      return
    }

    let cancelled = false
    setLoadStatus('loading')
    setErrorMsg('')
    setAccountStatus('loading')

    apiGet<CandidateDetailBackend>(`/candidates/${idParam}/detail`)
      .then(data => {
        if (cancelled) return
        setCandidate(data)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        setErrorMsg(getApiErrorMessage(err, 'No se pudo cargar el detalle del candidato.'))
      })

    apiGet<CandidateAccountBackend>(`/candidates/${idParam}/account`)
      .then(data => {
        if (cancelled) return
        setAccount(data)
        setAccountStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setAccountStatus('error')
        setAccountError(getApiErrorMessage(err, 'No se pudieron cargar los pagos del candidato.'))
      })

    return () => { cancelled = true }
  }, [idParam])

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'info', label: 'Información General', icon: <UserCheck size={14} /> },
    { key: 'pagos', label: 'Pagos', icon: <CreditCard size={14} /> },
    { key: 'examen', label: 'Examen de Admisión', icon: <ClipboardCheck size={14} /> },
    { key: 'induccion', label: 'Curso de Inducción', icon: <GraduationCap size={14} /> },
  ]

  const dg = candidate?.datosGenerales
  const dom = candidate?.domicilio
  const ic = candidate?.informacionComplementaria
  const ing = candidate?.ingresos
  const sc = candidate?.seleccionCarrera
  const ae = candidate?.antecedentesEscolares

  const fichaCharges = account?.charges.filter(c => c.role !== 'OTHER') ?? []
  const otherCharges = account?.charges.filter(c => c.role === 'OTHER') ?? []
  const pendingDifference = account?.charges.find(c => c.role === 'PENDING_DIFFERENCE')
  const availableCredit = account?.availableCredit ?? 0

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/admision' },
          { label: 'Admisión' },
          { label: 'Candidatos', to: '/admision/candidatos' },
          { label: 'Detalle' },
        ]}
      />

      <FormHeader
        title={candidate?.fullName ?? 'Detalle del candidato'}
        subtitle="Expediente completo del candidato en el proceso de admisión."
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      {loadStatus === 'loading' ? (
        <FormCard loading loadingLabel="Cargando detalle del candidato..." />
      ) : !candidate ? null : (
        <>

          {/* Summary card */}
          <FormCard>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <ReadField label="Folio" value={candidate.folio} mono />
              <ReadField label="Carrera Solicitada" value={candidate.programName ?? '—'} />
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado Actual</p>
                <BadgePill value={candidate.candidateStatus} map={statusBadgeMap} />
              </div>
              <ReadField label="Fecha de Registro" value={formatDate(candidate.registeredAt)} />
            </div>
            {(availableCredit > 0 || pendingDifference) && (
              <div className="mt-5 flex flex-wrap gap-2">
                {availableCredit > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('pagos')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[12px] font-semibold text-sky-800 hover:bg-sky-100"
                  >
                    <PiggyBank size={13} /> Saldo a favor: {formatCurrency(availableCredit)}
                  </button>
                )}
                {pendingDifference && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('pagos')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    <Wallet size={13} /> Diferencia por pagar: {formatCurrency(pendingDifference.balance)}
                  </button>
                )}
              </div>
            )}
          </FormCard>

          {/* Tabs */}
          <Tabs tabs={tabs} active={activeTab} onSelect={k => setActiveTab(k as TabKey)} />

          {/* ── Tab 1: Información General ── */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <Section title="Datos Personales">
                <ReadField label="Nombre Completo" value={candidate.fullName} />
                <ReadField label="CURP" value={candidate.curp} mono />
                <ReadField label="Fecha de nacimiento" value={formatDate(dg?.birthDate)} />
                <ReadField label="Sexo" value={dg?.gender ? GENDER_LABEL[dg.gender] ?? dg.gender : '—'} />
                <ReadField label="Nacionalidad" value={dg?.nationality ?? '—'} />
                <ReadField label="Lugar de nacimiento" value={join(dg?.birthMunicipalityName, dg?.birthStateName) || '—'} />
                <ReadField label="Estado civil" value={dg?.maritalStatus ? MARITAL_LABEL[dg.maritalStatus] ?? dg.maritalStatus : '—'} />
                <ReadField label="Lengua materna" value={dg?.nativeLanguage ?? '—'} />
                <ReadField label="¿Tiene hijos?" value={dg ? yesNo(dg.hasChildren) : '—'} />
              </Section>

              <Section title="Contacto y Domicilio">
                <ReadField label="Correo Electrónico" value={candidate.email ?? '—'} mono />
                <ReadField label="Teléfono celular" value={candidate.mobilePhone ?? '—'} />
                <ReadField label="Teléfono de casa" value={candidate.homePhone ?? '—'} />
                <ReadField
                  label="Calle y número"
                  value={dom ? join(dom.street, dom.exteriorNumber && `#${dom.exteriorNumber}`, dom.interiorNumber && `int. ${dom.interiorNumber}`) || '—' : '—'}
                />
                <ReadField label="Colonia" value={dom?.neighborhood ?? '—'} />
                <ReadField label="Código postal" value={dom?.postalCode ?? '—'} />
                <ReadField label="Localidad" value={dom?.locality ?? '—'} />
                <ReadField label="Municipio y estado" value={join(dom?.municipalityName, dom?.stateName) || '—'} />
              </Section>

              <Section title="Información Complementaria">
                <ReadField label="Padecimiento preexistente" value={ic ? yesWith(ic.hasPreexistingCondition, ic.conditionDescription) : '—'} />
                <ReadField label="Discapacidad" value={ic ? yesWith(ic.hasDisability, ic.disabilityDescription) : '—'} />
                <ReadField label="Habla lengua indígena" value={ic ? yesWith(ic.speaksIndigenousLanguage, ic.indigenousLanguage) : '—'} />
                <ReadField label="Sus padres hablan lengua indígena" value={ic ? yesWith(ic.parentsSpeakIndigenousLanguage, ic.parentsIndigenousLanguage) : '—'} />
                <ReadField label="Se identifica como indígena" value={ic ? yesNo(ic.selfIdentifiesIndigenous) : '—'} />
                <ReadField label="Afrodescendiente" value={ic ? yesNo(ic.isAfrodescendant || ic.selfIdentifiesAfrodescendant) : '—'} />
                <ReadField label="Se identifica como no binario" value={ic ? yesNo(ic.selfIdentifiesNonBinary) : '—'} />
                <ReadField label="Comunidad LGBTTTIQ+" value={ic ? yesNo(ic.belongsToLgbttiqCommunity) : '—'} />
              </Section>

              <Section title="Ingresos y Empleo">
                <ReadField label="Ingreso familiar mensual" value={formatCurrency(ing?.monthlyFamilyIncome)} />
                <ReadField label="¿Trabaja?" value={ing ? yesNo(ing.isEmployed) : '—'} />
                {ing?.isEmployed && (
                  <>
                    <ReadField label="Tipo de empleo" value={ing.employmentType ?? '—'} />
                    <ReadField label="Empresa" value={ing.companyName ?? '—'} />
                    <ReadField label="Puesto" value={ing.jobTitle ?? '—'} />
                    <ReadField label="Ingreso mensual" value={formatCurrency(ing.monthlyIncome)} />
                    <ReadField label="Horario" value={ing.workStartTime && ing.workEndTime ? `${ing.workStartTime.slice(0, 5)} a ${ing.workEndTime.slice(0, 5)}` : '—'} />
                    <ReadField label="Teléfono del trabajo" value={ing.workPhone ?? '—'} />
                  </>
                )}
              </Section>

              <Section title="Selección de Carrera">
                <ReadField label="Carrera" value={candidate.programName ?? '—'} />
                <ReadField label="División" value={candidate.divisionName ?? 'Sin división asignada'} />
                <ReadField label="Modalidad" value={sc?.modalityName ?? '—'} />
                <ReadField label="Periodo" value={sc?.periodName ?? '—'} />
                <ReadField label="¿Primera opción?" value={sc ? yesNo(sc.isFirstChoice) : '—'} />
                <ReadField label="Canal por el que se enteró" value={sc?.outreachChannelName ?? '—'} />
              </Section>

              <Section title="Antecedentes Escolares">
                <ReadField label="Bachillerato" value={ae?.schoolName ?? '—'} />
                <ReadField label="Tipo de bachillerato" value={ae?.schoolTypeName ?? '—'} />
                <ReadField label="CCT" value={ae?.cct ?? '—'} mono />
                <ReadField
                  label="Ubicación"
                  value={ae ? (ae.studiedInMexico
                    ? join(ae.schoolMunicipalityName, ae.schoolStateName)
                    : join(ae.schoolCity, ae.foreignCountry)) || '—' : '—'}
                />
                <ReadField label="Promedio" value={ae?.gpa != null ? String(ae.gpa) : '—'} />
              </Section>
            </div>
          )}

          {/* ── Tab 2: Pagos ── */}
          {activeTab === 'pagos' && (
            <div className="space-y-6">
              {accountStatus === 'loading' && <FormCard loading loadingLabel="Cargando pagos..." />}
              {accountStatus === 'error' && <ErrorBanner message={accountError} />}

              {account && (
                <>
                  {/* Saldo a favor */}
                  <div className={`rounded-xl border px-5 py-4 flex flex-wrap items-center justify-between gap-4 ${availableCredit > 0 ? 'border-sky-200 bg-sky-50' : 'border-[#E5E7EB] bg-white'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${availableCredit > 0 ? 'bg-sky-100 text-sky-700' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
                        <PiggyBank size={20} />
                      </span>
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#6B7280]">Saldo a favor</p>
                        <p className="text-[12px] text-[#6B7280]">
                          {availableCredit > 0
                            ? 'Lo que pagó de más al cambiar a una carrera más barata. Se aplica solo a su siguiente cobro.'
                            : 'No tiene saldo a favor.'}
                        </p>
                      </div>
                    </div>
                    <p className={`text-[26px] font-bold tabular-nums ${availableCredit > 0 ? 'text-sky-900' : 'text-[#9CA3AF]'}`}>
                      {formatCurrency(availableCredit)}
                    </p>
                  </div>

                  {/* Cobros de la ficha */}
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">
                      <Receipt size={13} /> Ficha de admisión
                    </p>
                    {fichaCharges.length === 0 ? (
                      <FormCard><p className="text-[13px] text-[#6B7280]">No hay cobros de ficha registrados.</p></FormCard>
                    ) : (
                      <div className="space-y-4">
                        {fichaCharges.map(charge => (
                          <ChargeCard
                            key={charge.paymentId}
                            charge={charge}
                            live={charge.role === 'CURRENT_FICHA' ? candidate.admissionPayment : null}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Cambios de carrera */}
                  {account.programChanges.length > 0 && (
                    <div>
                      <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">
                        <History size={13} /> Cambios de carrera
                      </p>
                      <ol className="relative space-y-3 border-l-2 border-[#E5E7EB] pl-5">
                        {account.programChanges.map((change, i) => (
                          <li key={i} className="relative">
                            <span className="absolute -left-[27px] top-3 h-3 w-3 rounded-full border-2 border-white bg-[#009574]" />
                            <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-3">
                              <p className="text-[11px] text-[#9CA3AF]">{formatDateTime(change.changedAt)} · {change.wasPaid ? 'Con la ficha pagada' : 'Con la ficha sin pagar'}</p>
                              <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#333333]">
                                <span className="text-[#6B7280]">{change.fromProgramName ?? '—'}</span>
                                <ArrowRight size={14} className="text-[#009574]" />
                                <span>{change.toProgramName ?? '—'}</span>
                              </p>
                              <p className="mt-1 text-[12px] text-[#6B7280]">
                                {change.wasPaid ? (
                                  <>
                                    Pagó {formatCurrency(change.paidAmount)}, la carrera nueva cuesta {formatCurrency(change.newAmount)}
                                    {change.toPay > 0 && <> · <span className="font-semibold text-amber-700">diferencia {formatCurrency(change.toPay)}</span></>}
                                    {change.creditLeft > 0 && <> · <span className="font-semibold text-sky-700">saldo a favor {formatCurrency(change.creditLeft)}</span></>}
                                  </>
                                ) : (
                                  <>Debía {formatCurrency(change.previousAmount)} y ahora debe {formatCurrency(change.toPay)}</>
                                )}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Movimientos del saldo a favor */}
                  {account.credits.length > 0 && (
                    <FormCard>
                      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Movimientos del saldo a favor</p>
                      <ul className="divide-y divide-[#E5E7EB]">
                        {account.credits.map((credit, i) => (
                          <li key={i} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-[13px]">
                            <div>
                              <p className="text-[#333333]">
                                Generado por <span className="font-mono text-[12px]">{credit.originReference ?? '—'}</span>
                                {credit.appliedToReference && <> · aplicado a <span className="font-mono text-[12px]">{credit.appliedToReference}</span></>}
                              </p>
                              <p className="text-[11px] text-[#9CA3AF]">{formatDateTime(credit.createdAt)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${credit.status === 'AVAILABLE' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                                {credit.status === 'AVAILABLE' ? 'Disponible' : credit.status === 'APPLIED' ? 'Aplicado' : 'Reembolsado'}
                              </span>
                              <span className="font-semibold tabular-nums">{formatCurrency(credit.amount)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </FormCard>
                  )}

                  {otherCharges.length > 0 && (
                    <div className="space-y-4">
                      {otherCharges.map(charge => <ChargeCard key={charge.paymentId} charge={charge} />)}
                    </div>
                  )}
                </>
              )}

              {/* Curso de inducción */}
              <FormCard>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Curso de Inducción</p>
                {!candidate.inductionPayment ? (
                  <p className="text-[13px] text-[#6B7280]">Todavía no hay un pago del curso de inducción.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
                      <BadgePill value={candidate.inductionPayment.paymentStatus} map={inductionBadgeMap} />
                    </div>
                    <ReadField label="Referencia" value={candidate.inductionPayment.referenceNumber} mono />
                    <ReadField label="Monto" value={formatCurrency(candidate.inductionPayment.amount)} />
                    <ReadField label="Fecha de Pago" value={formatDate(candidate.inductionPayment.paidAt)} />
                  </div>
                )}
              </FormCard>
            </div>
          )}

          {/* ── Tab 3: Examen de Admisión ── */}
          {activeTab === 'examen' && (
            <FormCard>
              <p className="text-[13px] text-[#6B7280]">
                El candidato aún no presenta el examen de admisión.
              </p>
            </FormCard>
          )}

          {/* ── Tab 4: Curso de Inducción ── */}
          {activeTab === 'induccion' && (
            <FormCard>
              <p className="text-[13px] text-[#6B7280]">
                El candidato aún no tiene un resultado de inducción registrado.
              </p>
            </FormCard>
          )}

          {/* Action zone — no Admitir/Rechazar: that decision belongs to the
              Director de División on Screen 11 (Selección de Candidatos). El
              cambio de carrera se hace desde la edición de la ficha, que calcula
              qué pasa con el cobro antes de guardar. */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-8">
            <Button variant="secondary" onClick={() => navigate('/admision/candidatos')}>
              Regresar
            </Button>
            {canEditFicha && candidate.candidateStatus !== 'ENROLLED' && (
              <Button variant="secondary" onClick={() => navigate(`/admision/candidatos/editar?id=${candidate.candidateId}`)}>
                <PencilLine size={14} />Editar ficha / Cambiar carrera
              </Button>
            )}
          </div>
        </>
      )}
    </PageContainer>
  )
}
