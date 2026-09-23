import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ShieldCheck, CheckCircle2, GraduationCap, Lock } from 'lucide-react'
import { Wizard, type WizardStep } from '@app/core/components/Wizard'
import {
  FieldLabel,
  FieldHelp,
  SearchSelect,
  SearchSelectField,
  Switch,
  RadioCard,
  inputCls,
  ReadField,
  DatePicker,
  type SelectOption,
} from '@app/core/components/ui'
import { FormPage, FormHeader, SelectField, TextField, TimeField } from '@app/core/components/form'
import { LlaveMxButton } from '@app/core/components/LlaveMxButton'
import { Breadcrumb } from '@app/core/components/list'
import { apiGet, apiPost, type ApiError } from '@app/core/infra/apiClient'
import { formatDate } from '@app/core/infra/utils'
import type {
  Candidate,
  Nacionalidad,
  EstadoCivil,
  LenguaNatal,
  TipoBachillerato,
  ModalidadPrograma,
  FichaAdmisionCompleta,
} from '../data/types'

/**
 * Screen 4 — Registro de Candidato: Wizard (4 pasos).
 *
 * Dual-mounted per `specs/admision-screens/spec.md` — "Registro de Candidato
 * Wizard (Screen 4)": identical fields/validation for both mounts, `origin`
 * drives ONLY post-completion navigation + chrome.
 * - Staff: `/admision/candidatos/registrar` (AppLayout, sidebar/breadcrumb present).
 * - Público: `/portal/registro` (AuthLayout, no sidebar/navbar — anonymous self-registration).
 *
 * REWORK (2026-07-01): the PO provided the complete, authoritative field list
 * for the "ficha de admisión" (~56 field-slots across 7 conceptual sections),
 * replacing the earlier 16-field/3-step draft. The wizard is now 4 steps:
 *   Paso 1 — Datos Generales + Domicilio Actual + Contacto
 *   Paso 2 — Información Complementaria + Ingresos
 *   Paso 3 — Selección de Carrera + Antecedentes Escolares
 *   Paso 4 — Confirmación (unchanged: folio, resumen, monto, método de pago)
 *
 * LlaveMX (RN-AUTH-005 + real CURP structure) auto-fills and locks, read-only:
 * Nombre(s), Primer Apellido, Segundo Apellido, CURP, Fecha de Nacimiento,
 * Sexo, Estado de Nacimiento (only while `nacionalidad === 'Mexicana'` — the
 * CURP encodes birth date/sex/birth state, so these are identity-verification
 * facts, not self-reported profile data). Everything else is manually
 * captured, per `00-shared-kernel.md`'s `Person`/`Address`/`HealthProfile`/
 * `DiversityProfile`/`EmploymentInfo`/`HighSchoolBackground` field names.
 */

export type ScreenOrigin = 'staff' | 'public'

interface CandidatoRegistroProps {
  origin: ScreenOrigin
}

// ─── Backend catalog DTOs & catalogs ──────────────────────────────────────────
// Screen 4 consumes REAL reference catalogs from 118-SISA-BACK (anonymous
// GETs, opened for the public /portal/registro mount):
//   GET /states                                                        → StateListItemResponse[] (id + name)
//   GET /municipalities?stateId=<id>                                   → MunicipalityListItemResponse[] (id + name)
//   GET /outreach-channels/options                                     → OptionResponse[] { id, label, code }
//   GET /high-school-types/options                                     → OptionResponse[] { id, label, code }
//   GET /program-admission-configs/options                             → OptionResponse[] { id(program), label(programName), code(modality) }
//
// The wizard keeps working with catalog NAMES in `paso{1,2,3}` state (so the
// validation/rendering/summary code is unchanged), and resolves names → UUIDs
// against these loaded lists when assembling the `POST /candidates` body.

interface StateItem {
  id: string
  name: string
}
interface StateListResponse {
  items: StateItem[]
}
interface MunicipalityItem {
  id: string
  name: string
}
interface MunicipalityListResponse {
  items: MunicipalityItem[]
}
interface OptionItem {
  id: string
  label: string
  code: string | null
}
interface CandidateRegistrationResponse {
  id: string
  personId: string
  admissionConfigId: string
  folio: string
  status: string
  llaveMxVerified: boolean
  registeredAt: string
  isFirstChoice: boolean
  outreachChannelId: string | null
  isEnabledForInduction: boolean
  payment: {
    referenceNumber: string
    amount: number
    deadline: string | null
    status: 'PENDING' | 'PAID'
  }
}

// Program-name → division fallback map (division is not part of the configs
// options projection). Used only to label the review/summary candidate.
const PROGRAMA_DIVISION: Record<string, string> = {
  'Ingeniería en Desarrollo y Gestión de Software': 'División de Tecnologías de la Información',
  'Técnico Superior Universitario en TI': 'División de Tecnologías de la Información',
  'Licenciatura en Administración de Empresas': 'División de Ciencias Económico Administrativas',
  'Ingeniería Industrial': 'División de Ingeniería',
}

// Matches `00-shared-kernel.md`'s `MaritalStatus` enum (all values but `OTRO`, not requested by the PO's field list).
const ESTADOS_CIVILES: EstadoCivil[] = ['Soltero/a', 'Casado/a', 'Unión libre', 'Divorciado/a', 'Viudo/a']

// Español + catálogo de lenguas indígenas de México más habladas (reasonable, non-exhaustive judgment call).
const LENGUAS_NATALES: LenguaNatal[] = ['Español', 'Náhuatl', 'Maya', 'Mixteco', 'Zapoteco', 'Otra']

// Modalidad acts as a FILTER in the wizard (not a DTO field): modality is
// defined on the ProgramAdmissionConfig's program, so choosing one narrows the
// program list. `code` comes from the configs options endpoint ("PRESENCIAL"/"MIXTA").
const MODALIDAD_FILTROS: Array<'' | 'Todas' | ModalidadPrograma> = ['Todas', 'Presencial', 'Mixta']
const MODALIDAD_CODE_TO_LABEL: Record<string, ModalidadPrograma> = {
  PRESENCIAL: 'Presencial',
  MIXTA: 'Mixta',
}
const modalidadLabel = (code: string | null): ModalidadPrograma => (code ? MODALIDAD_CODE_TO_LABEL[code] ?? 'Presencial' : 'Presencial')

const FICHA_MONTO = 500
const INDUCCION_MONTO = 350

// Simulated LlaveMX identity response — no real OAuth, per spec. A fixed mock
// identity keeps the prototype deterministic across verifications. The CURP
// `LOTM060512MMCPRR09` genuinely encodes birthDate=12/05/2006, sexo=Femenino
// (the "M" right after the date) and estadoNacimiento=Morelos (the "MC" state
// code) — these three locked fields are derived from the CURP itself, exactly
// like real LlaveMX would return them.
const MOCK_LLAVE_MX_IDENTITY = {
  nombres: 'María Fernanda',
  apellidoPaterno: 'López',
  apellidoMaterno: 'Torres',
  curp: 'LOTM060512MMCPRR09',
  fechaNacimiento: '12/05/2006',
  sexo: 'Femenino',
  estadoNacimiento: 'Morelos',
}

type MetodoPago = 'ONLINE' | 'VENTANILLA'

interface Paso1State {
  // Datos Generales — LlaveMX-locked once verified
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  curp: string
  fechaNacimiento: string
  sexo: string
  /** LlaveMX-provided (locked) while `nacionalidad === 'Mexicana'`; manually editable while `'Extranjera'`. */
  estadoNacimiento: string

  // Datos Generales — manual
  nacionalidad: Nacionalidad | ''
  municipioNacimiento: string
  paisNacimiento: string
  ciudadNacimiento: string
  estadoCivil: EstadoCivil | ''
  lenguaNatal: LenguaNatal | ''
  tieneHijos: boolean

  // Domicilio Actual
  calle: string
  numeroExterior: string
  numeroInterior: string
  colonia: string
  estadoDomicilio: string
  municipioDomicilio: string
  localidad: string
  codigoPostal: string

  // Contacto
  email: string
  telefonoCasa: string
  celular: string
}

interface Paso2State {
  // Información Complementaria
  tieneEnfermedadPreexistente: boolean
  descripcionEnfermedad: string
  tieneDiscapacidad: boolean
  descripcionDiscapacidad: string
  padresHablanLenguaIndigena: boolean
  lenguaIndigenaPadres: string
  hablaLenguaIndigena: boolean
  lenguaIndigenaPropia: string
  seIdentificaIndigena: boolean
  seIdentificaNoBinario: boolean
  perteneceComunidadLgbttiq: boolean
  esAfrodescendiente: boolean
  seIdentificaAfrodescendiente: boolean

  // Ingresos
  ingresoMensualFamiliar: string
  trabaja: boolean
  tipoTrabajo: string
  telefonoTrabajo: string
  ingresoMensual: string
  nombreEmpresa: string
  puesto: string
  horaInicio: string
  horaFin: string
}

interface Paso3State {
  // Selección de Carrera
  /** Filtro de modalidad (Narrowing), NO se envía al DTO. '' / 'Todas' = sin filtro. */
  modalidad: '' | 'Todas' | ModalidadPrograma
  /** Nombre del programa (display); `admissionConfigId` es el UUID para el POST. */
  programa: string
  admissionConfigId: string
  /** Nombre del canal (display); `outreachChannelId` es el UUID para el POST. */
  canal: string
  outreachChannelId: string
  isFirstChoice: boolean | null

  // Antecedentes Escolares
  nombrePreparatoria: string
  /** Nombre del tipo de bachillerato (display); `schoolTypeId` es el UUID para el POST. */
  tipoBachillerato: TipoBachillerato | ''
  schoolTypeId: string
  estudioEnMexico: boolean
  estadoPreparatoria: string
  municipioPreparatoria: string
  paisPreparatoria: string
  ciudadPreparatoria: string
  promedio: string
  cct: string
  cctConfirmacion: string
}

const emptyPaso1: Paso1State = {
  nombres: '', apellidoPaterno: '', apellidoMaterno: '', curp: '', fechaNacimiento: '', sexo: '', estadoNacimiento: '',
  nacionalidad: '', municipioNacimiento: '', paisNacimiento: '', ciudadNacimiento: '',
  estadoCivil: '', lenguaNatal: '', tieneHijos: false,
  calle: '', numeroExterior: '', numeroInterior: '', colonia: '', estadoDomicilio: '', municipioDomicilio: '', localidad: '', codigoPostal: '',
  email: '', telefonoCasa: '', celular: '',
}

const emptyPaso2: Paso2State = {
  tieneEnfermedadPreexistente: false, descripcionEnfermedad: '',
  tieneDiscapacidad: false, descripcionDiscapacidad: '',
  padresHablanLenguaIndigena: false, lenguaIndigenaPadres: '',
  hablaLenguaIndigena: false, lenguaIndigenaPropia: '',
  seIdentificaIndigena: false, seIdentificaNoBinario: false, perteneceComunidadLgbttiq: false,
  esAfrodescendiente: false, seIdentificaAfrodescendiente: false,
  ingresoMensualFamiliar: '', trabaja: false, tipoTrabajo: '', telefonoTrabajo: '', ingresoMensual: '',
  nombreEmpresa: '', puesto: '', horaInicio: '', horaFin: '',
}

const emptyPaso3: Paso3State = {
  modalidad: '', programa: '', admissionConfigId: '', canal: '', outreachChannelId: '', isFirstChoice: null,
  nombrePreparatoria: '', tipoBachillerato: '', schoolTypeId: '', estudioEnMexico: true,
  estadoPreparatoria: '', municipioPreparatoria: '', paisPreparatoria: '', ciudadPreparatoria: '',
  promedio: '', cct: '', cctConfirmacion: '',
}

// ─── Shared field helpers ─────────────────────────────────────────────────────

/** LlaveMX-locked, read-only field — Nombre(s)/Apellidos/CURP/Fecha de Nacimiento/Sexo/Estado de Nacimiento. */
function LockedField({ label, value, required = true }: { label: string; value: string; required?: boolean }) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className={`${inputCls(true, false)} flex items-center gap-1.5`}>
        <Lock size={11} className="text-[#9CA3AF] flex-shrink-0" />
        <span>{value || '—'}</span>
      </div>
    </div>
  )
}

/** Required Sí/No question row — used by "Información Complementaria" and the conditional-branch switches. */
function SwitchField({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-[#E5E7EB] last:border-0">
      <div>
        <FieldLabel required>{label}</FieldLabel>
        {help && <FieldHelp>{help}</FieldHelp>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[12px] text-[#6B7280] w-6 text-right">{checked ? 'Sí' : 'No'}</span>
        <Switch checked={checked} onChange={onChange} />
      </div>
    </div>
  )
}

const boolLabel = (v: boolean) => (v ? 'Sí' : 'No')

/** Mantiene solo dígitos y un único punto decimal (para montos con prefix "$"). */
const sanitizeAmount = (v: string) => {
  const clean = v.replace(/[^0-9.]/g, '')
  const firstDot = clean.indexOf('.')
  return firstDot === -1 ? clean : clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, '')
}

/** Section wrapper for the full ficha review in Paso 4. */
function SummarySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6 pb-6 border-b border-[#E5E7EB] last:border-0 last:mb-0 last:pb-0">
      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">{children}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CandidatoRegistro({ origin }: CandidatoRegistroProps) {
  const navigate = useNavigate()

  const [paso1, setPaso1] = useState<Paso1State>(emptyPaso1)
  const [paso2, setPaso2] = useState<Paso2State>(emptyPaso2)
  const [paso3, setPaso3] = useState<Paso3State>(emptyPaso3)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('ONLINE')
  const [identityStatus, setIdentityStatus] = useState<'idle' | 'verifying' | 'verified' | 'manual'>('idle')
  const [folio, setFolio] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ── Reference catalogs (anonymous GETs) ──
  const [estados, setEstados] = useState<StateItem[]>([])
  const [municipios, setMunicipios] = useState<Record<string, MunicipalityItem[]>>({})
  const [canales, setCanales] = useState<OptionItem[]>([])
  const [tiposBachillerato, setTiposBachillerato] = useState<OptionItem[]>([])
  const [configsAdmision, setConfigsAdmision] = useState<OptionItem[]>([])
  const [catalogsStatus, setCatalogsStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setCatalogsStatus('loading')
    Promise.all([
      apiGet<StateListResponse>('/states'),
      apiGet<OptionItem[]>('/outreach-channels/options'),
      apiGet<OptionItem[]>('/high-school-types/options'),
      apiGet<OptionItem[]>('/program-admission-configs/options'),
    ])
      .then(([statesRes, canalesRes, tiposRes, configsRes]) => {
        if (cancelled) return
        setEstados(statesRes.items)
        setCanales(canalesRes)
        setTiposBachillerato(tiposRes)
        setConfigsAdmision(configsRes)
        setCatalogsStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setCatalogsStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  // Load a state's municipalities on demand (cascade) and cache by stateId.
  const stateIdOf = (name: string): string => estados.find(e => e.name === name)?.id ?? ''
  function loadMunicipios(stateId: string) {
    if (!stateId || municipios[stateId]) return
    apiGet<MunicipalityListResponse>('/municipalities', { stateId })
      .then(res => setMunicipios(prev => (prev[stateId] ? prev : { ...prev, [stateId]: res.items })))
      .catch(() => {/* non-critical — select just won't populate */})
  }

  // Estados/Municipios keep working with NAMES in state (validation + review
  // display); the POST resolves names → UUIDs at submit time.
  const estadoNames = estados.map(e => e.name)
  const municipioNames = (stateName: string): string[] =>
    (municipios[stateIdOf(stateName)] ?? []).map(m => m.name)

  // Prefill cascade whenever a state-name lands in the form (user pick, or the
  // LlaveMX-locked "Morelos" from `handleVerify`).
  useEffect(() => {
    const targets = [
      paso1.estadoNacimiento,
      paso1.estadoDomicilio,
      paso3.estadoPreparatoria,
    ]
    targets.forEach(name => { if (name) loadMunicipios(stateIdOf(name)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso1.estadoNacimiento, paso1.estadoDomicilio, paso3.estadoPreparatoria, estados])

  // Selección de carrera: modalidad as filter over OPEN configs. A config's
  // `code` is the program's modality (PRESENCIAL/MIXTA). ''/Todas → no filter.
  const canalOptions: SelectOption[] = canales.map(c => ({ value: c.id, label: c.label }))
  const bachilleratoOptions: SelectOption[] = tiposBachillerato.map(t => ({ value: t.id, label: t.label }))
  const selectedConfig = configsAdmision.find(c => c.id === paso3.admissionConfigId)
  const selectedProgramaModalidad: ModalidadPrograma | '' = selectedConfig
    ? modalidadLabel(selectedConfig.code)
    : ''
  const programaOptions: SelectOption[] = configsAdmision
    .filter(c => {
      if (paso3.modalidad === '' || paso3.modalidad === 'Todas') return true
      return modalidadLabel(c.code) === paso3.modalidad
    })
    .map(c => ({ value: c.id, label: c.label }))

  const isVerified = identityStatus === 'verified'
  /** Captura manual activa: los campos de identidad son editables sin pasar por LlaveMX. */
  const isManual = identityStatus === 'manual'
  const verifiedFullName = `${MOCK_LLAVE_MX_IDENTITY.nombres} ${MOCK_LLAVE_MX_IDENTITY.apellidoPaterno} ${MOCK_LLAVE_MX_IDENTITY.apellidoMaterno}`

  function handleGoManual() {
    if (identityStatus !== 'idle') return
    setIdentityStatus('manual')
  }

  function handleRetryLlaveMx() {
    if (!isManual) return
    setIdentityStatus('idle')
  }

  function handleVerify() {
    if (identityStatus !== 'idle') return
    setIdentityStatus('verifying')
    // Simulated verification — no real OAuth. Auto-fills the identity fields
    // LlaveMX would normally return (the CURP itself encodes birth date, sex,
    // and birth state), same as a real government-ID lookup.
    setTimeout(() => {
      setPaso1(f => ({
        ...f,
        nombres: MOCK_LLAVE_MX_IDENTITY.nombres,
        apellidoPaterno: MOCK_LLAVE_MX_IDENTITY.apellidoPaterno,
        apellidoMaterno: MOCK_LLAVE_MX_IDENTITY.apellidoMaterno,
        curp: MOCK_LLAVE_MX_IDENTITY.curp,
        fechaNacimiento: MOCK_LLAVE_MX_IDENTITY.fechaNacimiento,
        sexo: MOCK_LLAVE_MX_IDENTITY.sexo,
        estadoNacimiento: MOCK_LLAVE_MX_IDENTITY.estadoNacimiento,
      }))
      setIdentityStatus('verified')
    }, 900)
  }

  // ── Paso 1 validation (Datos Generales + Domicilio + Contacto) ──
  const curpValid = paso1.curp.trim().length === 18
  const emailValid = /\S+@\S+\.\S+/.test(paso1.email)
  const telefonoValid = /^\d{10}$/.test(paso1.celular.replace(/\s/g, ''))
  const telefonoCasaValid = /^\d{10}$/.test(paso1.telefonoCasa.replace(/\s/g, ''))
  const cpValid = /^\d{5}$/.test(paso1.codigoPostal)

  const nacimientoValid =
    paso1.nacionalidad === 'Mexicana'
      ? paso1.estadoNacimiento.trim() !== '' && paso1.municipioNacimiento !== ''
      : paso1.nacionalidad === 'Extranjera'
        ? paso1.paisNacimiento.trim() !== '' && paso1.estadoNacimiento.trim() !== '' && paso1.ciudadNacimiento.trim() !== ''
        : false

  const datosGeneralesValid =
    (isVerified || isManual) &&
    paso1.nombres.trim() !== '' &&
    paso1.apellidoPaterno.trim() !== '' &&
    curpValid &&
    paso1.fechaNacimiento !== '' &&
    paso1.sexo !== '' &&
    paso1.nacionalidad !== '' &&
    nacimientoValid &&
    paso1.estadoCivil !== '' &&
    paso1.lenguaNatal !== ''

  const domicilioValid =
    paso1.calle.trim() !== '' &&
    paso1.numeroExterior.trim() !== '' &&
    paso1.colonia.trim() !== '' &&
    paso1.estadoDomicilio !== '' &&
    paso1.municipioDomicilio !== '' &&
    paso1.localidad.trim() !== '' &&
    cpValid

  const contactoValid = emailValid && telefonoCasaValid && telefonoValid

  const paso1Valid = datosGeneralesValid && domicilioValid && contactoValid

  // ── Paso 2 validation (Información Complementaria + Ingresos) ──
  const ingresoFamiliarValid =
    paso2.ingresoMensualFamiliar.trim() !== '' &&
    !Number.isNaN(Number(paso2.ingresoMensualFamiliar)) &&
    Number(paso2.ingresoMensualFamiliar) >= 0
  const telefonoTrabajoValid = /^\d{10}$/.test(paso2.telefonoTrabajo.replace(/\s/g, ''))
  const trabajoValid =
    !paso2.trabaja ||
    (
      paso2.tipoTrabajo.trim() !== '' &&
      telefonoTrabajoValid &&
      paso2.ingresoMensual.trim() !== '' && !Number.isNaN(Number(paso2.ingresoMensual)) &&
      paso2.nombreEmpresa.trim() !== '' &&
      paso2.puesto.trim() !== '' &&
      paso2.horaInicio !== '' &&
      paso2.horaFin !== ''
    )
  const enfermedadValid = !paso2.tieneEnfermedadPreexistente || paso2.descripcionEnfermedad.trim() !== ''
  const discapacidadValid = !paso2.tieneDiscapacidad || paso2.descripcionDiscapacidad.trim() !== ''
  const lenguaPadresValid = !paso2.padresHablanLenguaIndigena || paso2.lenguaIndigenaPadres.trim() !== ''
  const lenguaPropiaValid = !paso2.hablaLenguaIndigena || paso2.lenguaIndigenaPropia.trim() !== ''
  const paso2Valid = ingresoFamiliarValid && trabajoValid && enfermedadValid && discapacidadValid && lenguaPadresValid && lenguaPropiaValid

  // ── Paso 3 validation (Selección de Carrera + Antecedentes Escolares) ──
  const promedioNum = Number(paso3.promedio)
  const promedioValid = paso3.promedio.trim() !== '' && !Number.isNaN(promedioNum) && promedioNum >= 0 && promedioNum <= 10
  const cctMismatch = paso3.cctConfirmacion !== '' && paso3.cct !== paso3.cctConfirmacion
  const antecedentesUbicacionValid = paso3.estudioEnMexico
    ? paso3.estadoPreparatoria !== '' && paso3.municipioPreparatoria !== ''
    : paso3.paisPreparatoria.trim() !== '' && paso3.estadoPreparatoria.trim() !== '' && paso3.ciudadPreparatoria.trim() !== ''

  const paso3Valid =
    paso3.admissionConfigId !== '' &&
    paso3.outreachChannelId !== '' &&
    paso3.isFirstChoice !== null &&
    paso3.nombrePreparatoria.trim() !== '' &&
    paso3.schoolTypeId !== '' &&
    antecedentesUbicacionValid &&
    promedioValid &&
    paso3.cct.trim() !== '' &&
    paso3.cctConfirmacion.trim() !== '' &&
    !cctMismatch

  // ── Paso 4 validation (Confirmación) ──
  const paso4Valid = !submitting && (metodoPago === 'ONLINE' || metodoPago === 'VENTANILLA')

  const nombreCompleto = `${paso1.nombres} ${paso1.apellidoPaterno} ${paso1.apellidoMaterno}`.trim()

  // Resolve a selected entity's UUID from the loaded catalog (by NAME — the
  // form keeps working with names, the DTO needs ids). Returns null when the
  // selection is empty/unknown so the payload stays `null` for those refs.
  const idOf = (list: StateItem[] | MunicipalityItem[], name: string): string | null =>
    name.trim() === '' ? null : (list.find(item => item.name === name)?.id ?? null)

  async function handleComplete() {
    if (submitting) return
    setSubmitting(true)
    setSubmitError('')

    const division = PROGRAMA_DIVISION[paso3.programa] ?? ''

    const mex = paso1.nacionalidad === 'Mexicana'
    const casaStateId = stateIdOf(paso1.estadoDomicilio)
    const escuelaStateId = stateIdOf(paso3.estadoPreparatoria)

    const payload = {
      datosGenerales: {
        curp: paso1.curp.toUpperCase(),
        nombres: paso1.nombres,
        apellidoPaterno: paso1.apellidoPaterno,
        apellidoMaterno: paso1.apellidoMaterno,
        fechaNacimiento: paso1.fechaNacimiento,
        sexo: paso1.sexo,
        nacionalidad: paso1.nacionalidad as Nacionalidad,
        birthStateId: mex ? idOf(estados, paso1.estadoNacimiento) : null,
        birthMunicipalityId: mex ? idOf(municipios[stateIdOf(paso1.estadoNacimiento)] ?? [], paso1.municipioNacimiento) : null,
        paisNacimiento: mex ? '' : paso1.paisNacimiento,
        ciudadNacimiento: mex ? '' : paso1.ciudadNacimiento,
        estadoCivil: paso1.estadoCivil as EstadoCivil,
        lenguaNatal: paso1.lenguaNatal as LenguaNatal,
        tieneHijos: paso1.tieneHijos,
      },
      domicilio: {
        calle: paso1.calle,
        numeroExterior: paso1.numeroExterior,
        numeroInterior: paso1.numeroInterior,
        colonia: paso1.colonia,
        localidad: paso1.localidad,
        codigoPostal: paso1.codigoPostal,
        stateId: casaStateId,
        municipalityId: idOf(municipios[casaStateId] ?? [], paso1.municipioDomicilio),
      },
      contacto: {
        personalEmail: paso1.email,
        telefonoCasa: paso1.telefonoCasa,
        celular: paso1.celular,
      },
      informacionComplementaria: {
        tieneEnfermedadPreexistente: paso2.tieneEnfermedadPreexistente,
        descripcionEnfermedad: paso2.tieneEnfermedadPreexistente ? paso2.descripcionEnfermedad : '',
        tieneDiscapacidad: paso2.tieneDiscapacidad,
        descripcionDiscapacidad: paso2.tieneDiscapacidad ? paso2.descripcionDiscapacidad : '',
        padresHablanLenguaIndigena: paso2.padresHablanLenguaIndigena,
        lenguaIndigenaPadres: paso2.padresHablanLenguaIndigena ? paso2.lenguaIndigenaPadres : '',
        hablaLenguaIndigena: paso2.hablaLenguaIndigena,
        lenguaIndigenaPropia: paso2.hablaLenguaIndigena ? paso2.lenguaIndigenaPropia : '',
        seIdentificaIndigena: paso2.seIdentificaIndigena,
        seIdentificaNoBinario: paso2.seIdentificaNoBinario,
        perteneceComunidadLgbttiq: paso2.perteneceComunidadLgbttiq,
        esAfrodescendiente: paso2.esAfrodescendiente,
        seIdentificaAfrodescendiente: paso2.seIdentificaAfrodescendiente,
      },
      ingresos: {
        ingresoMensualFamiliar: Number(paso2.ingresoMensualFamiliar) || 0,
        trabaja: paso2.trabaja,
        tipoTrabajo: paso2.trabaja ? paso2.tipoTrabajo : '',
        telefonoTrabajo: paso2.trabaja ? paso2.telefonoTrabajo : '',
        ingresoMensual: paso2.trabaja ? (Number(paso2.ingresoMensual) || 0) : null,
        nombreEmpresa: paso2.trabaja ? paso2.nombreEmpresa : '',
        puesto: paso2.trabaja ? paso2.puesto : '',
        horaInicio: paso2.trabaja ? paso2.horaInicio : '',
        horaFin: paso2.trabaja ? paso2.horaFin : '',
      },
      seleccionCarrera: {
        admissionConfigId: paso3.admissionConfigId,
        outreachChannelId: paso3.outreachChannelId,
        isFirstChoice: paso3.isFirstChoice === true,
      },
      antecedentesEscolares: {
        nombrePreparatoria: paso3.nombrePreparatoria,
        schoolTypeId: paso3.schoolTypeId,
        estudioBachilleratoEnMexico: paso3.estudioEnMexico,
        schoolStateId: paso3.estudioEnMexico ? escuelaStateId : null,
        schoolMunicipalityId: paso3.estudioEnMexico ? idOf(municipios[escuelaStateId] ?? [], paso3.municipioPreparatoria) : null,
        paisPreparatoria: paso3.estudioEnMexico ? '' : paso3.paisPreparatoria,
        ciudadPreparatoria: paso3.estudioEnMexico ? '' : paso3.ciudadPreparatoria,
        promedio: promedioNum,
        cct: paso3.cct,
        cctConfirmacion: paso3.cctConfirmacion,
      },
      llaveMxVerified: identityStatus === 'verified',
    }

    try {
      const res = await apiPost<CandidateRegistrationResponse>('/candidates', payload)
      setSubmitting(false)
      setFolio(res.folio)

      const ficha: FichaAdmisionCompleta = {
        datosGenerales: {
          nombres: paso1.nombres,
          apellidoPaterno: paso1.apellidoPaterno,
          apellidoMaterno: paso1.apellidoMaterno,
          curp: paso1.curp.toUpperCase(),
          fechaNacimiento: paso1.fechaNacimiento,
          sexo: paso1.sexo,
          estadoNacimiento: paso1.estadoNacimiento,
          nacionalidad: paso1.nacionalidad as Nacionalidad,
          municipioNacimiento: mex ? paso1.municipioNacimiento : '',
          paisNacimiento: mex ? '' : paso1.paisNacimiento,
          ciudadNacimiento: mex ? '' : paso1.ciudadNacimiento,
          estadoCivil: paso1.estadoCivil as EstadoCivil,
          lenguaNatal: paso1.lenguaNatal as LenguaNatal,
          tieneHijos: paso1.tieneHijos,
        },
        domicilio: {
          calle: paso1.calle,
          numeroExterior: paso1.numeroExterior,
          numeroInterior: paso1.numeroInterior,
          colonia: paso1.colonia,
          estado: paso1.estadoDomicilio,
          municipio: paso1.municipioDomicilio,
          localidad: paso1.localidad,
          codigoPostal: paso1.codigoPostal,
        },
        contacto: {
          telefonoCasa: paso1.telefonoCasa,
          celular: paso1.celular,
        },
        informacionComplementaria: {
          tieneEnfermedadPreexistente: paso2.tieneEnfermedadPreexistente,
          descripcionEnfermedad: paso2.tieneEnfermedadPreexistente ? paso2.descripcionEnfermedad : undefined,
          tieneDiscapacidad: paso2.tieneDiscapacidad,
          descripcionDiscapacidad: paso2.tieneDiscapacidad ? paso2.descripcionDiscapacidad : undefined,
          padresHablanLenguaIndigena: paso2.padresHablanLenguaIndigena,
          lenguaIndigenaPadres: paso2.padresHablanLenguaIndigena ? paso2.lenguaIndigenaPadres : undefined,
          hablaLenguaIndigena: paso2.hablaLenguaIndigena,
          lenguaIndigenaPropia: paso2.hablaLenguaIndigena ? paso2.lenguaIndigenaPropia : undefined,
          seIdentificaIndigena: paso2.seIdentificaIndigena,
          seIdentificaNoBinario: paso2.seIdentificaNoBinario,
          perteneceComunidadLgbttiq: paso2.perteneceComunidadLgbttiq,
          esAfrodescendiente: paso2.esAfrodescendiente,
          seIdentificaAfrodescendiente: paso2.esAfrodescendiente ? paso2.seIdentificaAfrodescendiente : undefined,
        },
        ingresos: {
          ingresoMensualFamiliar: Number(paso2.ingresoMensualFamiliar) || 0,
          trabaja: paso2.trabaja,
          tipoTrabajo: paso2.trabaja ? paso2.tipoTrabajo : '',
          telefonoTrabajo: paso2.trabaja ? paso2.telefonoTrabajo : '',
          ingresoMensual: paso2.trabaja ? (Number(paso2.ingresoMensual) || 0) : null,
          nombreEmpresa: paso2.trabaja ? paso2.nombreEmpresa : '',
          puesto: paso2.trabaja ? paso2.puesto : '',
          horaInicio: paso2.trabaja ? paso2.horaInicio : '',
          horaFin: paso2.trabaja ? paso2.horaFin : '',
        },
        seleccionCarrera: {
          modalidad: selectedProgramaModalidad as ModalidadPrograma,
        },
        antecedentesEscolares: {
          nombrePreparatoria: paso3.nombrePreparatoria,
          tipoBachillerato: paso3.tipoBachillerato as TipoBachillerato,
          estudioBachilleratoEnMexico: paso3.estudioEnMexico,
          estadoPreparatoria: paso3.estadoPreparatoria,
          municipioPreparatoria: paso3.estudioEnMexico ? paso3.municipioPreparatoria : '',
          paisPreparatoria: paso3.estudioEnMexico ? '' : paso3.paisPreparatoria,
          ciudadPreparatoria: paso3.estudioEnMexico ? '' : paso3.ciudadPreparatoria,
          promedio: promedioNum,
          cct: paso3.cct,
          cctConfirmacion: paso3.cctConfirmacion,
        },
      }

      const candidate: Candidate = {
        id: res.id,
        folio: res.folio,
        nombre: nombreCompleto,
        curp: paso1.curp.toUpperCase(),
        email: paso1.email,
        telefono: paso1.celular,
        programa: paso3.programa,
        division,
        canal: paso3.canal,
        status: 'REGISTERED',
        fechaRegistro: formatDate(new Date(res.registeredAt)),
        examen: null,
        induccionResultado: null,
        induccionHabilitada: res.isEnabledForInduction,
        pagoFicha: { status: 'PENDIENTE', monto: res.payment.amount, referencia: res.payment.referenceNumber, metodo: metodoPago },
        pagoInduccion: { status: 'PENDIENTE', monto: INDUCCION_MONTO },
        fichaCompleta: ficha,
      }

      // Real backend ticket data handed to Screen 13 (ficha), per Screen 5/6/13
      // ("Pago de ficha") — reference, amount and deadline now come from the
      // `POST /candidates` response instead of mock `buildReferencia`/`addDays`.
      const pagoFicha = {
        referencia: res.payment.referenceNumber,
        monto: res.payment.amount,
        fechaLimite: res.payment.deadline ?? '',
        estado: res.payment.status,
        folio: res.folio,
      }

      const state = { candidate, metodoPago, pagoFicha }

      // Navigate to Screen 13 (Ficha Confirmación), dual-mounted per origin.
      // `?id=` survives a refresh — FichaConfirmacion re-fetches `GET
      // /candidates/{id}` when route state is lost.
      if (origin === 'staff') {
        navigate(`/admision/candidatos/ficha?id=${res.id}`, { state })
      } else {
        navigate(`/portal/registro/ficha?id=${res.id}`, { state })
      }
    } catch (err) {
      setSubmitting(false)
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 400) setSubmitError(apiErr.message ?? 'Revisa los datos capturados.')
      else if (apiErr.status === 401) setSubmitError('Tu sesión expiró. Vuelve a iniciar sesión.')
      else if (apiErr.status === 403) setSubmitError('No tienes permiso para realizar el registro.')
      else if (apiErr.status === 409) setSubmitError(apiErr.message ?? 'Ya existe un candidato con ese CURP.')
      else setSubmitError('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
    }
  }

  // ── Paso 1 content: Datos Generales + Domicilio Actual + Contacto ──
  const paso1Render = (
    <div>
      {/* Verificación de Identidad — LlaveMX u captura manual. */}
      <div className="border-2 border-[#009574] rounded-lg p-5 mb-6 bg-[#e6f5f1]/40">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#009574] flex items-center justify-center">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#333333]">Verificación de Identidad</p>
            {identityStatus === 'idle' && (
              <div>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  Recomendamos verificar tu identidad con LlaveMX para prellenar tus datos. Si no tienes LlaveMX, puedes capturarlos manualmente.
                </p>
                <div className="mt-4 flex flex-row items-start justify-between gap-2">
                  <LlaveMxButton onClick={handleVerify} className="w-full" />
                  <button
                    type="button"
                    onClick={handleGoManual}
                    className="self-end text-[13px] text-[#d4d4d4] hover:text-[#c5c5c5] font-medium transition-colors"
                  >
                    Ingresa tus datos manualmente
                  </button>
                </div>
              </div>
            )}

            {identityStatus === 'verifying' && (
              <div className="mt-4">
                <LlaveMxButton onClick={handleVerify} loading disabled className="w-full" />
                <p className="text-[13px] text-[#6B7280] mt-2">Verificando tu identidad con LlaveMX…</p>
              </div>
            )}

            {identityStatus === 'manual' && (
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#fff8e1] text-[#B45309] border border-amber-200">
                    <Lock size={13} />Captura manual
                  </span>
                </div>
                <p className="text-[13px] text-[#6B7280] mt-2">
                  Estás capturando tus datos a mano. También puedes intentar de nuevo con LlaveMX.
                </p>
                <button
                  type="button"
                  onClick={handleRetryLlaveMx}
                  className="mt-2 text-[13px] text-[#009574] hover:text-[#007a5e] font-medium transition-colors"
                >
                  Intentar de nuevo con LlaveMX
                </button>
              </div>
            )}

            {isVerified && (
              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={13} />Identidad verificada ✓
                </span>
                <span className="text-[13px] text-[#333333] font-medium">{verifiedFullName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Datos Generales */}
      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Datos Generales</p>
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 md:col-span-4">
          {isManual ? (
            <TextField label="Nombre(s)" required value={paso1.nombres} onChange={v => setPaso1({ ...paso1, nombres: v })} />
          ) : (
            <LockedField label="Nombre(s)" value={paso1.nombres} />
          )}
        </div>
        <div className="col-span-12 md:col-span-4">
          {isManual ? (
            <TextField label="Primer Apellido" required value={paso1.apellidoPaterno} onChange={v => setPaso1({ ...paso1, apellidoPaterno: v })} />
          ) : (
            <LockedField label="Primer Apellido" value={paso1.apellidoPaterno} />
          )}
        </div>
        <div className="col-span-12 md:col-span-4">
          {isManual ? (
            <TextField label="Segundo Apellido" value={paso1.apellidoMaterno} onChange={v => setPaso1({ ...paso1, apellidoMaterno: v })} />
          ) : (
            <LockedField label="Segundo Apellido" value={paso1.apellidoMaterno} required={false} />
          )}
        </div>

        <div className="col-span-12 md:col-span-6">
          {isManual ? (
            <TextField
              label="CURP"
              required
              value={paso1.curp}
              onChange={v => setPaso1({ ...paso1, curp: v.toUpperCase() })}
              maxLength={18}
              placeholder="18 caracteres"
              mono
              error={paso1.curp !== '' && !curpValid ? 'La CURP debe tener 18 caracteres.' : undefined}
            />
          ) : (
            <LockedField label="CURP" value={paso1.curp} />
          )}
        </div>
        <div className="col-span-6 md:col-span-3">
          {isManual ? (
            <div>
              <FieldLabel required>Fecha de Nacimiento</FieldLabel>
              <DatePicker value={paso1.fechaNacimiento} onChange={v => setPaso1({ ...paso1, fechaNacimiento: v })} />
            </div>
          ) : (
            <LockedField label="Fecha de Nacimiento" value={paso1.fechaNacimiento} />
          )}
        </div>
        <div className="col-span-6 md:col-span-3">
          {isManual ? (
            <SelectField
              label="Sexo"
              required
              options={['Femenino', 'Masculino'].map(v => ({ value: v, label: v }))}
              value={paso1.sexo}
              onChange={v => setPaso1({ ...paso1, sexo: v })}
              placeholder="Seleccionar…"
            />
          ) : (
            <LockedField label="Sexo" value={paso1.sexo} />
          )}
        </div>

        <div className="col-span-12">
          <FieldLabel required>Nacionalidad</FieldLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <RadioCard
              selected={paso1.nacionalidad === 'Mexicana'}
              title="Mexicana"
              onSelect={() => setPaso1({ ...paso1, nacionalidad: 'Mexicana' })}
            />
            <RadioCard
              selected={paso1.nacionalidad === 'Extranjera'}
              title="Extranjera"
              onSelect={() => setPaso1({ ...paso1, nacionalidad: 'Extranjera' })}
            />
          </div>
        </div>

        {paso1.nacionalidad === 'Mexicana' && (
          <>
            <div className="col-span-12 md:col-span-6">
              {isManual ? (
                <>
                  <FieldLabel required>Estado de Nacimiento</FieldLabel>
                  <SearchSelect options={estadoNames} value={paso1.estadoNacimiento} onChange={v => setPaso1({ ...paso1, estadoNacimiento: v, municipioNacimiento: '' })} placeholder="Selecciona un estado" />
                </>
              ) : (
                <LockedField label="Estado de Nacimiento" value={paso1.estadoNacimiento} />
              )}
            </div>
            <div className="col-span-12 md:col-span-6">
              <FieldLabel required>Municipio de Nacimiento</FieldLabel>
              <SearchSelect options={municipioNames(paso1.estadoNacimiento)} value={paso1.municipioNacimiento} onChange={v => setPaso1({ ...paso1, municipioNacimiento: v })} placeholder="Selecciona un municipio" disabled={paso1.estadoNacimiento === ''} />
            </div>
          </>
        )}
        {paso1.nacionalidad === 'Extranjera' && (
          <>
            <div className="col-span-12 md:col-span-4">
              <TextField label="País de Nacimiento" required value={paso1.paisNacimiento} onChange={v => setPaso1({ ...paso1, paisNacimiento: v })} placeholder="País" />
            </div>
            <div className="col-span-12 md:col-span-4">
              <TextField label="Estado de Nacimiento" required value={paso1.estadoNacimiento} onChange={v => setPaso1({ ...paso1, estadoNacimiento: v })} placeholder="Estado o provincia" />
            </div>
            <div className="col-span-12 md:col-span-4">
              <TextField label="Ciudad de Nacimiento" required value={paso1.ciudadNacimiento} onChange={v => setPaso1({ ...paso1, ciudadNacimiento: v })} placeholder="Ciudad" />
            </div>
          </>
        )}

        <div className="col-span-12 md:col-span-4">
          <SelectField
            label="Estado Civil"
            required
            options={ESTADOS_CIVILES.map(v => ({ value: v, label: v }))}
            value={paso1.estadoCivil}
            onChange={v => setPaso1({ ...paso1, estadoCivil: v as EstadoCivil })}
            placeholder="Seleccionar…"
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <SelectField
            label="Lengua Natal"
            required
            options={LENGUAS_NATALES.map(v => ({ value: v, label: v }))}
            value={paso1.lenguaNatal}
            onChange={v => setPaso1({ ...paso1, lenguaNatal: v as LenguaNatal })}
            placeholder="Seleccionar…"
          />
        </div>
        <div className="col-span-12 md:col-span-4 flex items-end">
          <div className="w-full">
            <SwitchField label="¿Tienes hijos?" checked={paso1.tieneHijos} onChange={v => setPaso1({ ...paso1, tieneHijos: v })} />
          </div>
        </div>
      </div>

      {/* Domicilio Actual */}
      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Domicilio Actual</p>
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 md:col-span-6">
          <TextField label="Calle" required value={paso1.calle} onChange={v => setPaso1({ ...paso1, calle: v })} />
        </div>
        <div className="col-span-6 md:col-span-3">
          <TextField label="Número Exterior" required value={paso1.numeroExterior} onChange={v => setPaso1({ ...paso1, numeroExterior: v })} />
        </div>
        <div className="col-span-6 md:col-span-3">
          <TextField label="Número Interior" value={paso1.numeroInterior} onChange={v => setPaso1({ ...paso1, numeroInterior: v })} placeholder="Opcional" />
        </div>

        <div className="col-span-12 md:col-span-6">
          <TextField label="Colonia" required value={paso1.colonia} onChange={v => setPaso1({ ...paso1, colonia: v })} />
        </div>
        <div className="col-span-12 md:col-span-3">
          <FieldLabel required>Estado</FieldLabel>
          <SearchSelect options={estadoNames} value={paso1.estadoDomicilio} onChange={v => setPaso1({ ...paso1, estadoDomicilio: v, municipioDomicilio: '' })} placeholder="Selecciona un estado" />
        </div>
        <div className="col-span-12 md:col-span-3">
          <FieldLabel required>Municipio</FieldLabel>
          <SearchSelect options={municipioNames(paso1.estadoDomicilio)} value={paso1.municipioDomicilio} onChange={v => setPaso1({ ...paso1, municipioDomicilio: v })} placeholder="Selecciona un municipio" disabled={paso1.estadoDomicilio === ''} />
        </div>

        <div className="col-span-12 md:col-span-6">
          <TextField label="Localidad" required value={paso1.localidad} onChange={v => setPaso1({ ...paso1, localidad: v })} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <TextField
            label="Código Postal"
            required
            value={paso1.codigoPostal}
            onChange={v => setPaso1({ ...paso1, codigoPostal: v.replace(/\D/g, '').slice(0, 5) })}
            maxLength={5}
            placeholder="5 dígitos"
            error={paso1.codigoPostal !== '' && !cpValid ? 'Debe tener 5 dígitos.' : undefined}
          />
        </div>
      </div>

      {/* Contacto */}
      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Contacto</p>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <TextField
            label="Correo Electrónico"
            required
            type="email"
            value={paso1.email}
            onChange={v => setPaso1({ ...paso1, email: v })}
            placeholder="Para notificaciones del proceso"
            error={paso1.email !== '' && !emailValid ? 'Ingresa un correo electrónico válido.' : undefined}
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <TextField
            label="Teléfono Casa"
            required
            value={paso1.telefonoCasa}
            onChange={v => setPaso1({ ...paso1, telefonoCasa: v })}
            maxLength={10}
            placeholder="10 dígitos"
            error={paso1.telefonoCasa !== '' && !telefonoCasaValid ? 'Ingresa 10 dígitos numéricos.' : undefined}
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <TextField
            label="Celular"
            required
            value={paso1.celular}
            onChange={v => setPaso1({ ...paso1, celular: v })}
            maxLength={10}
            placeholder="10 dígitos"
            error={paso1.celular !== '' && !telefonoValid ? 'Ingresa 10 dígitos numéricos.' : undefined}
          />
        </div>
      </div>
    </div>
  )

  // ── Paso 2 content: Información Complementaria + Ingresos ──
  const paso2Render = (
    <div>
      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-2">Información Complementaria</p>
      <div className="mb-8">
        <SwitchField label="¿Tienes alguna enfermedad o diagnóstico preexistente?" checked={paso2.tieneEnfermedadPreexistente} onChange={v => setPaso2({ ...paso2, tieneEnfermedadPreexistente: v })} />
        {paso2.tieneEnfermedadPreexistente && (
          <TextField className="-mt-1 pb-2.5 border-b border-[#E5E7EB]" label="Nombre de la enfermedad o diagnóstico" required value={paso2.descripcionEnfermedad} onChange={v => setPaso2({ ...paso2, descripcionEnfermedad: v })} />
        )}
        <SwitchField label="¿Tienes alguna discapacidad?" checked={paso2.tieneDiscapacidad} onChange={v => setPaso2({ ...paso2, tieneDiscapacidad: v })} />
        {paso2.tieneDiscapacidad && (
          <TextField className="-mt-1 pb-2.5 border-b border-[#E5E7EB]" label="¿Cuál discapacidad?" required value={paso2.descripcionDiscapacidad} onChange={v => setPaso2({ ...paso2, descripcionDiscapacidad: v })} />
        )}
        <SwitchField label="¿Tu mamá o papá hablan alguna lengua indígena?" checked={paso2.padresHablanLenguaIndigena} onChange={v => setPaso2({ ...paso2, padresHablanLenguaIndigena: v })} />
        {paso2.padresHablanLenguaIndigena && (
          <TextField className="-mt-1 pb-2.5 border-b border-[#E5E7EB]" label="¿Cuál lengua?" required value={paso2.lenguaIndigenaPadres} onChange={v => setPaso2({ ...paso2, lenguaIndigenaPadres: v })} />
        )}
        <SwitchField label="¿Hablas alguna lengua indígena?" checked={paso2.hablaLenguaIndigena} onChange={v => setPaso2({ ...paso2, hablaLenguaIndigena: v })} />
        {paso2.hablaLenguaIndigena && (
          <TextField className="-mt-1 pb-2.5 border-b border-[#E5E7EB]" label="¿Cuál lengua?" required value={paso2.lenguaIndigenaPropia} onChange={v => setPaso2({ ...paso2, lenguaIndigenaPropia: v })} />
        )}
        <SwitchField label="¿Te identificas como indígena?" checked={paso2.seIdentificaIndigena} onChange={v => setPaso2({ ...paso2, seIdentificaIndigena: v })} />
        <SwitchField label="¿Te identificas como No binario?" checked={paso2.seIdentificaNoBinario} onChange={v => setPaso2({ ...paso2, seIdentificaNoBinario: v })} />
        <SwitchField label="¿Perteneces a la comunidad LGBTTTIQ+?" checked={paso2.perteneceComunidadLgbttiq} onChange={v => setPaso2({ ...paso2, perteneceComunidadLgbttiq: v })} />
        <SwitchField label="¿Eres afrodescendiente?" checked={paso2.esAfrodescendiente} onChange={v => setPaso2({ ...paso2, esAfrodescendiente: v })} />
        {paso2.esAfrodescendiente && (
          <SwitchField
            label="¿Te identificas como afrodescendiente?"
            checked={paso2.seIdentificaAfrodescendiente}
            onChange={v => setPaso2({ ...paso2, seIdentificaAfrodescendiente: v })}
            help="La ascendencia y la autoidentificación son datos distintos"
          />
        )}
      </div>

      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Ingresos</p>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6">
          <TextField
            label="Ingreso Mensual Familiar"
            required
            value={paso2.ingresoMensualFamiliar}
            onChange={v => setPaso2({ ...paso2, ingresoMensualFamiliar: sanitizeAmount(v) })}
            prefix="$"
            inputMode="numeric"
            placeholder="0.00"
            error={paso2.ingresoMensualFamiliar !== '' && !ingresoFamiliarValid ? 'Ingresa un monto válido.' : undefined}
          />
        </div>
        <div className="col-span-12 md:col-span-6 flex items-end">
          <div className="w-full">
            <SwitchField label="¿Trabajas?" checked={paso2.trabaja} onChange={v => setPaso2({ ...paso2, trabaja: v })} />
          </div>
        </div>

        {paso2.trabaja && (
          <>
            <div className="col-span-12 md:col-span-4">
              <TextField label="Tipo de Trabajo" required value={paso2.tipoTrabajo} onChange={v => setPaso2({ ...paso2, tipoTrabajo: v })} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <TextField
                label="Teléfono de Trabajo"
                required
                value={paso2.telefonoTrabajo}
                onChange={v => setPaso2({ ...paso2, telefonoTrabajo: v })}
                maxLength={10}
                placeholder="10 dígitos"
                error={paso2.telefonoTrabajo !== '' && !telefonoTrabajoValid ? 'Ingresa 10 dígitos numéricos.' : undefined}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <TextField label="Ingreso Mensual" required value={paso2.ingresoMensual} onChange={v => setPaso2({ ...paso2, ingresoMensual: sanitizeAmount(v) })} prefix="$" inputMode="numeric" placeholder="0.00" />
            </div>

            <div className="col-span-12 md:col-span-6">
              <TextField label="Nombre de la Empresa" required value={paso2.nombreEmpresa} onChange={v => setPaso2({ ...paso2, nombreEmpresa: v })} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <TextField label="Puesto" required value={paso2.puesto} onChange={v => setPaso2({ ...paso2, puesto: v })} />
            </div>

            <div className="col-span-6 md:col-span-3">
              <TimeField label="Hora de Inicio" required value={paso2.horaInicio} onChange={v => setPaso2({ ...paso2, horaInicio: v })} />
            </div>
            <div className="col-span-6 md:col-span-3">
              <TimeField label="Hora de Fin" required value={paso2.horaFin} onChange={v => setPaso2({ ...paso2, horaFin: v })} />
            </div>
          </>
        )}
      </div>
    </div>
  )

  // ── Paso 3 content: Selección de Carrera + Antecedentes Escolares ──
  const paso3Render = (
    <div>
      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Selección de Carrera</p>
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 md:col-span-4">
          <SelectField
            label="Modalidad (filtro)"
            options={MODALIDAD_FILTROS.map(v => ({ value: v, label: v === '' ? 'Todas' : v }))}
            value={paso3.modalidad}
            onChange={v => setPaso3({ ...paso3, modalidad: v as '' | 'Todas' | ModalidadPrograma, admissionConfigId: '', programa: '' })}
            placeholder="Seleccionar…"
          />
        </div>
        <div className="col-span-12 md:col-span-8 space-y-2">
          <div>
            <FieldLabel required>Carrera</FieldLabel>
            <SearchSelectField options={programaOptions} value={paso3.admissionConfigId} onChange={v => {
              const config = configsAdmision.find(c => c.id === v)
              setPaso3(prev => ({ ...prev, admissionConfigId: v, programa: config?.label ?? '' }))
            }} placeholder={programaOptions.length === 0 ? 'No hay carreras para esa modalidad' : 'Selecciona una carrera'} searchPlaceholder="Buscar carrera…" />
          </div>
        </div>

        <div className="col-span-12 md:col-span-6">
          <FieldLabel required>Medio de Difusión por el que se enteró</FieldLabel>
          <SearchSelectField options={canalOptions} value={paso3.outreachChannelId} onChange={v => {
            const canal = canales.find(c => c.id === v)
            setPaso3(prev => ({ ...prev, outreachChannelId: v, canal: canal?.label ?? '' }))
          }} placeholder="Selecciona un canal" />
        </div>

        <div className="col-span-12">
          <FieldLabel required>¿La UTEZ es tu primera o segunda opción?</FieldLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <RadioCard
              selected={paso3.isFirstChoice === true}
              title="Es mi primera opción"
              onSelect={() => setPaso3({ ...paso3, isFirstChoice: true })}
            />
            <RadioCard
              selected={paso3.isFirstChoice === false}
              title="Es mi segunda opción"
              onSelect={() => setPaso3({ ...paso3, isFirstChoice: false })}
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Antecedentes Escolares</p>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-8">
          <TextField label="Nombre de la Preparatoria de Procedencia" required value={paso3.nombrePreparatoria} onChange={v => setPaso3({ ...paso3, nombrePreparatoria: v })} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <FieldLabel required>Tipo de Bachillerato</FieldLabel>
          <SearchSelectField options={bachilleratoOptions} value={paso3.schoolTypeId} onChange={v => {
            const tipo = tiposBachillerato.find(t => t.id === v)
            setPaso3(prev => ({ ...prev, schoolTypeId: v, tipoBachillerato: (tipo?.label ?? '') as TipoBachillerato }))
          }} placeholder="Selecciona un tipo" />
        </div>

        <div className="col-span-12">
          <SwitchField label="¿Estudiaste el bachillerato en México?" checked={paso3.estudioEnMexico} onChange={v => setPaso3({ ...paso3, estudioEnMexico: v })} />
        </div>

        {paso3.estudioEnMexico ? (
          <>
            <div className="col-span-12 md:col-span-6">
              <FieldLabel required>Estado de la Preparatoria</FieldLabel>
              <SearchSelect options={estadoNames} value={paso3.estadoPreparatoria} onChange={v => setPaso3({ ...paso3, estadoPreparatoria: v, municipioPreparatoria: '' })} placeholder="Selecciona un estado" />
            </div>
            <div className="col-span-12 md:col-span-6">
              <FieldLabel required>Municipio de la Preparatoria</FieldLabel>
              <SearchSelect options={municipioNames(paso3.estadoPreparatoria)} value={paso3.municipioPreparatoria} onChange={v => setPaso3({ ...paso3, municipioPreparatoria: v })} placeholder="Selecciona un municipio" disabled={paso3.estadoPreparatoria === ''} />
            </div>
          </>
        ) : (
          <>
            <div className="col-span-12 md:col-span-4">
              <TextField label="País de la Preparatoria" required value={paso3.paisPreparatoria} onChange={v => setPaso3({ ...paso3, paisPreparatoria: v })} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <TextField label="Estado de la Preparatoria" required value={paso3.estadoPreparatoria} onChange={v => setPaso3({ ...paso3, estadoPreparatoria: v })} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <TextField label="Ciudad de la Preparatoria" required value={paso3.ciudadPreparatoria} onChange={v => setPaso3({ ...paso3, ciudadPreparatoria: v })} />
            </div>
          </>
        )}

        <div className="col-span-12 md:col-span-4">
          <TextField
            label="Promedio"
            required
            type="number"
            value={paso3.promedio}
            onChange={v => setPaso3({ ...paso3, promedio: v })}
            placeholder="0–10"
            error={paso3.promedio !== '' && !promedioValid ? 'Debe estar entre 0 y 10.' : undefined}
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <TextField label="Clave de Centro de Trabajo (CCT)" required value={paso3.cct} onChange={v => setPaso3({ ...paso3, cct: v.toUpperCase() })} placeholder="Ej. 17DCT0001A" />
        </div>
        <div className="col-span-12 md:col-span-4">
          <TextField
            label="Confirmación de CCT"
            required
            value={paso3.cctConfirmacion}
            onChange={v => setPaso3({ ...paso3, cctConfirmacion: v.toUpperCase() })}
            placeholder="Repite la clave"
            error={cctMismatch ? 'Las claves no coinciden.' : undefined}
          />
        </div>
      </div>
    </div>
  )

  // ── Paso 4 content: Confirmación — revisión completa de la ficha antes de pagar ──
  const paso4Render = (
    <div>
      {submitError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-[13px] text-red-700 flex items-start gap-2">
          <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" />
          {submitError}
        </div>
      )}
      {submitting && (
        <div className="mb-6 bg-[#e6f5f1] border border-[#009574]/30 rounded-md px-4 py-3 text-[13px] text-[#007a5e]">
          Registrando al candidato… generando folio.
        </div>
      )}

      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <p className="text-[13px] text-[#6B7280] mb-6">
          Revisa con cuidado la información capturada. Una vez que confirmes, no podrás modificarla desde aquí.
        </p>

        <SummarySection title="Datos Generales">
          <ReadField label="Nombre Completo" value={nombreCompleto} />
          <ReadField label="CURP" value={paso1.curp} />
          <ReadField label="Fecha de Nacimiento" value={paso1.fechaNacimiento} />
          <ReadField label="Sexo" value={paso1.sexo} />
          <ReadField label="Nacionalidad" value={paso1.nacionalidad === 'Extranjera' ? 'Extranjera' : 'Mexicana'} />
          {paso1.nacionalidad === 'Extranjera' ? (
            <>
              <ReadField label="País de Nacimiento" value={paso1.paisNacimiento} />
              <ReadField label="Estado de Nacimiento" value={paso1.estadoNacimiento} />
              <ReadField label="Ciudad de Nacimiento" value={paso1.ciudadNacimiento} />
            </>
          ) : (
            <>
              <ReadField label="Estado de Nacimiento" value={paso1.estadoNacimiento} />
              <ReadField label="Municipio de Nacimiento" value={paso1.municipioNacimiento} />
            </>
          )}
          <ReadField label="Estado Civil" value={paso1.estadoCivil} />
          <ReadField label="Lengua Natal" value={paso1.lenguaNatal} />
          <ReadField label="¿Tiene Hijos?" value={boolLabel(paso1.tieneHijos)} />
        </SummarySection>

        <SummarySection title="Domicilio Actual">
          <ReadField label="Calle" value={paso1.calle} />
          <ReadField label="Número Exterior" value={paso1.numeroExterior} />
          <ReadField label="Número Interior" value={paso1.numeroInterior} />
          <ReadField label="Colonia" value={paso1.colonia} />
          <ReadField label="Estado" value={paso1.estadoDomicilio} />
          <ReadField label="Municipio" value={paso1.municipioDomicilio} />
          <ReadField label="Localidad" value={paso1.localidad} />
          <ReadField label="Código Postal" value={paso1.codigoPostal} />
        </SummarySection>

        <SummarySection title="Contacto">
          <ReadField label="Correo Electrónico" value={paso1.email} />
          <ReadField label="Teléfono Casa" value={paso1.telefonoCasa} />
          <ReadField label="Celular" value={paso1.celular} />
        </SummarySection>

        <SummarySection title="Información Complementaria">
          <ReadField label="¿Enfermedad o Diagnóstico Preexistente?" value={boolLabel(paso2.tieneEnfermedadPreexistente)} />
          {paso2.tieneEnfermedadPreexistente && <ReadField label="Enfermedad o Diagnóstico" value={paso2.descripcionEnfermedad} />}
          <ReadField label="¿Discapacidad?" value={boolLabel(paso2.tieneDiscapacidad)} />
          {paso2.tieneDiscapacidad && <ReadField label="Discapacidad" value={paso2.descripcionDiscapacidad} />}
          <ReadField label="¿Padres Hablan Lengua Indígena?" value={boolLabel(paso2.padresHablanLenguaIndigena)} />
          {paso2.padresHablanLenguaIndigena && <ReadField label="Lengua de los Padres" value={paso2.lenguaIndigenaPadres} />}
          <ReadField label="¿Habla Lengua Indígena?" value={boolLabel(paso2.hablaLenguaIndigena)} />
          {paso2.hablaLenguaIndigena && <ReadField label="Lengua que Habla" value={paso2.lenguaIndigenaPropia} />}
          <ReadField label="¿Se Identifica Indígena?" value={boolLabel(paso2.seIdentificaIndigena)} />
          <ReadField label="¿Se Identifica No Binario?" value={boolLabel(paso2.seIdentificaNoBinario)} />
          <ReadField label="¿Pertenece a la Comunidad LGBTTTIQ+?" value={boolLabel(paso2.perteneceComunidadLgbttiq)} />
          <ReadField label="¿Es Afrodescendiente?" value={boolLabel(paso2.esAfrodescendiente)} />
          {paso2.esAfrodescendiente && (
            <ReadField label="¿Se Identifica Afrodescendiente?" value={boolLabel(paso2.seIdentificaAfrodescendiente)} />
          )}
        </SummarySection>

        <SummarySection title="Ingresos">
          <ReadField label="Ingreso Mensual Familiar" value={paso2.ingresoMensualFamiliar ? `$${paso2.ingresoMensualFamiliar}` : ''} />
          <ReadField label="¿Trabaja?" value={boolLabel(paso2.trabaja)} />
          {paso2.trabaja && (
            <>
              <ReadField label="Tipo de Trabajo" value={paso2.tipoTrabajo} />
              <ReadField label="Teléfono de Trabajo" value={paso2.telefonoTrabajo} />
              <ReadField label="Ingreso Mensual Propio" value={paso2.ingresoMensual ? `$${paso2.ingresoMensual}` : ''} />
              <ReadField label="Nombre de la Empresa" value={paso2.nombreEmpresa} />
              <ReadField label="Puesto" value={paso2.puesto} />
              <ReadField label="Hora de Inicio" value={paso2.horaInicio} />
              <ReadField label="Hora de Fin" value={paso2.horaFin} />
            </>
          )}
        </SummarySection>

        <SummarySection title="Selección de Carrera">
          <ReadField label="Modalidad" value={selectedProgramaModalidad || paso3.modalidad || '—'} />
          <ReadField label="Carrera" value={paso3.programa} />
          <ReadField label="Medio de Difusión" value={paso3.canal} />
          <ReadField label="¿Primera Opción?" value={paso3.isFirstChoice === null ? '' : paso3.isFirstChoice ? 'Sí, es mi primera opción' : 'No, es mi segunda opción'} />
        </SummarySection>

        <SummarySection title="Antecedentes Escolares">
          <ReadField label="Preparatoria de Procedencia" value={paso3.nombrePreparatoria} />
          <ReadField label="Tipo de Bachillerato" value={paso3.tipoBachillerato} />
          <ReadField label="¿Bachillerato en México?" value={boolLabel(paso3.estudioEnMexico)} />
          {paso3.estudioEnMexico ? (
            <>
              <ReadField label="Estado de la Preparatoria" value={paso3.estadoPreparatoria} />
              <ReadField label="Municipio de la Preparatoria" value={paso3.municipioPreparatoria} />
            </>
          ) : (
            <>
              <ReadField label="País de la Preparatoria" value={paso3.paisPreparatoria} />
              <ReadField label="Estado de la Preparatoria" value={paso3.estadoPreparatoria} />
              <ReadField label="Ciudad de la Preparatoria" value={paso3.ciudadPreparatoria} />
            </>
          )}
          <ReadField label="Promedio" value={paso3.promedio} />
          <ReadField label="Clave de Centro de Trabajo (CCT)" value={paso3.cct} />
        </SummarySection>

        <div className="pt-2">
          {folio ? (
            <>
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Folio Generado</p>
              <p className="text-[15px] font-bold text-[#333333] mb-4">{folio}</p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Folio Generado</p>
              <p className="text-[15px] font-bold text-[#333333] mb-4">—</p>
            </>
          )}
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Monto de la Ficha</p>
          <p className="text-[24px] font-bold text-[#009574]">${FICHA_MONTO.toFixed(2)}</p>
        </div>
      </div>

      <FieldLabel required>¿Cómo quieres pagar tu ficha?</FieldLabel>
      <div className="space-y-3 mt-1">
        <RadioCard
          selected={metodoPago === 'ONLINE'}
          title="Pagar en línea (Evo Payments)"
          description="Pagas ahora con tarjeta o transferencia. Serás redirigido a la plataforma de pago."
          onSelect={() => setMetodoPago('ONLINE')}
        />
        <RadioCard
          selected={metodoPago === 'VENTANILLA'}
          title="Pagar en ventanilla de Finanzas"
          description="Recibirás una referencia bancaria para pagar presencialmente en Finanzas."
          onSelect={() => setMetodoPago('VENTANILLA')}
        />
      </div>
    </div>
  )

  const steps: WizardStep[] = [
    { id: 'datos-generales', label: 'Datos Generales', render: paso1Render, isValid: paso1Valid },
    { id: 'informacion-complementaria', label: 'Información Complementaria', render: paso2Render, isValid: paso2Valid },
    { id: 'seleccion-carrera', label: 'Selección de Carrera', render: paso3Render, isValid: paso3Valid },
    { id: 'confirmacion', label: 'Confirmación', render: paso4Render, isValid: paso4Valid, gated: true },
  ]

  const content = (
    <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
      {catalogsStatus === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-[13px] text-red-700 flex items-start gap-2">
          <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" />
          No se pudieron cargar los catálogos (carreras, estados, canales). Verifica que el servidor esté disponible e intenta de nuevo.
        </div>
      )}
      <Wizard steps={steps} onComplete={handleComplete} finishLabel="Finalizar Registro" />
    </div>
  )

  // ── Staff mount — AppLayout shell, sidebar present; chrome aligned to core ──
  if (origin === 'staff') {
    return (
      <FormPage>
        <Breadcrumb
          items={[
            { label: 'Inicio', to: '/admision' },
            { label: 'Admisión', to: '/admision' },
            { label: 'Candidatos', to: '/admision/candidatos' },
            { label: 'Registrar Candidato' },
          ]}
        />

        <FormHeader
          title="Registrar Candidato"
          subtitle="Completa los cuatro pasos para registrar al aspirante en el proceso de admisión."
        />

        {content}
      </FormPage>
    )
  }

  // ── Público mount — bare AuthLayout, no sidebar/navbar (anonymous self-registration) ──
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-[#009574] px-6 py-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <GraduationCap size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-[14px] leading-tight">UTEZ — SISA v2</p>
          <p className="text-white/70 text-[11px] leading-tight">Registro de Candidato</p>
        </div>
      </header>

      <div className="max-w-[960px] mx-auto px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#333333]">Registro de Candidato</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Completa los cuatro pasos para registrarte en el proceso de admisión.</p>
        </div>

        {content}
      </div>
    </div>
  )
}
