import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, CheckCircle2, Circle, ExternalLink, Gift, AlertTriangle } from 'lucide-react'
import { Wizard, type WizardStep } from '../../shared/Wizard'
import { FieldLabel, FieldError, SearchSelect, SimpleSelect, Switch, inputCls } from '../../shared/ui'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate } from '../../shared/admision/types'
import { mockStudents, MUNICIPIOS_POR_ESTADO, mockGroups, mockInstitutionalDocuments } from '../../shared/inscripciones/mockData'

/**
 * Screen 4 — Inscripción Nuevo Ingreso: Wizard (5 pasos).
 *
 * Datos del Admitido / Datos Complementarios / Grupo Asignado / Documentos
 * Institucionales / Pago. Mirrors `pages/admision/CandidatoRegistro.tsx`'s
 * lifted-form-state pattern: the Wizard primitive only tracks the current
 * step, all form data lives in this page's `useState` so navigating back and
 * forth never loses previously entered values.
 *
 * Delivered as ONE PR with a sub-commit per step (see design.md's "Screen 4
 * wizard = ONE PR, sub-commits per step" decision) — the `Wizard` is
 * parent-driven with one shared form object, so a partial-wizard split across
 * PRs would ship a non-functional intermediate state.
 */

/** Read-only summary field — mirrors the page-local `ReadField` pattern already used in `CandidatoRegistro.tsx`/`EstudianteDetalle.tsx`. */
function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[13px] text-[#333333] font-medium">{value || '—'}</p>
    </div>
  )
}

// ─── Paso 1: pool of candidates this wizard can enroll ──────────────────────
// Only `ACCEPTED` candidates (Admisión's terminal "admitted" state) that
// haven't already been converted into a Student are eligible — keeps the
// mock data internally consistent (nobody gets enrolled twice).
const enrolledCandidateIds = new Set(mockStudents.map(s => s.originCandidateId))
const admittedCandidates = mockCandidates.filter(c => c.status === 'ACCEPTED' && !enrolledCandidateIds.has(c.id))
const candidateLabel = (c: Candidate) => `${c.folio} — ${c.nombre}`
const candidateOptions = admittedCandidates.map(candidateLabel)

interface Paso1State {
  candidateLabel: string
}

const emptyPaso1: Paso1State = { candidateLabel: '' }

// ─── Paso 2: inline mock catalogs ────────────────────────────────────────────
// Duplicated from `pages/admision/CandidatoRegistro.tsx`'s inline consts per
// design.md's "Paso 2 mirrors Admisión's field logic" decision — Inscripciones
// keeps each module self-contained rather than importing from an archived
// screen or extracting a shared catalog file for ~4 tiny mock lists.
const ESTADOS_CATALOGO = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
  'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero',
  'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro',
  'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala',
  'Veracruz', 'Yucatán', 'Zacatecas',
]
const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const TIPOS_TRABAJO = ['Tiempo completo', 'Medio tiempo', 'Freelance', 'Negocio propio']

/** Radio card — shared visual for Nacionalidad, matching `CandidatoRegistro.tsx`'s pattern. */
function RadioCard({ selected, title, onSelect }: { selected: boolean; title: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors ${
        selected ? 'border-[#009574] bg-[#e6f5f1]' : 'border-[#E5E7EB] bg-white hover:border-[#009574]/50'
      }`}
    >
      <span className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected ? 'border-[#009574]' : 'border-[#E5E7EB]'}`}>
        {selected && <span className="w-2 h-2 rounded-full bg-[#009574]" />}
      </span>
      <span className="text-[13px] font-semibold text-[#333333]">{title}</span>
    </button>
  )
}

/** Plain text input paired with `FieldLabel`/`FieldError`, styled via `inputCls`. */
function TextField({ label, required, value, onChange, placeholder, error, maxLength, type = 'text' }: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void
  placeholder?: string; error?: string; maxLength?: number; type?: 'text' | 'time'
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={inputCls(false, !!error)}
      />
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

/** Required Sí/No question row — mirrors `CandidatoRegistro.tsx`'s `SwitchField`. */
function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-[#E5E7EB] last:border-0">
      <FieldLabel required>{label}</FieldLabel>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[12px] text-[#6B7280] w-6 text-right">{checked ? 'Sí' : 'No'}</span>
        <Switch checked={checked} onChange={onChange} />
      </div>
    </div>
  )
}

type Nacionalidad = 'Mexicana' | 'Extranjera' | ''

/**
 * Paso 2 field-editability, per the PO's 2026-07-03 correction: this screen
 * lets the recién-inscrito estudiante update ONLY a specific subset of what
 * was already captured during Admisión (`Candidate.fichaCompleta`) — most of
 * Paso 2 now displays that data read-only (`ReadField`) instead of re-asking
 * for it. Nacionalidad, and most of Antecedentes de Bachillerato, are
 * READ-ONLY here (already fixed at Admisión time); only Domicilio, Contacto,
 * Área/Especialidad+Promedio+Periodo de Estudios, Laboral, and Contacto de
 * Emergencia remain editable. Salud is left fully editable — untouched by
 * this correction (the PO didn't mention it; flagged as an assumption in
 * apply-progress for confirmation).
 */
interface Paso2State {
  // Domicilio — editable, prefilled from `fichaCompleta.domicilio` when available
  calle: string
  numeroExterior: string
  numeroInterior: string
  colonia: string
  estadoDomicilio: string
  municipioDomicilio: string
  localidad: string
  codigoPostal: string
  // Contacto — editable (NEW section), prefilled from `Candidate.telefono`/`.email`
  telefono: string
  correo: string
  // Antecedentes de Bachillerato — only these three are editable here; the
  // rest (nombrePreparatoria, tipoBachillerato, studiedInMexico, estado/
  // municipio or país/ciudad, cct) render read-only from `fichaCompleta`.
  areaEspecialidad: string
  promedio: string
  periodoEstudios: string
  // Salud — untouched, fully editable (deliberate no-op per PO correction scope)
  tipoSangre: string
  tieneAlergias: boolean
  alergias: string
  // Laboral — untouched, fully editable
  trabaja: boolean
  tipoTrabajo: string
  empresa: string
  puesto: string
  horaInicio: string
  horaFin: string
  // Contacto de Emergencia — editable (NEW section)
  guardianName: string
  guardianEmail: string
  emergencyContactPhone: string
}

const emptyPaso2: Paso2State = {
  calle: '', numeroExterior: '', numeroInterior: '', colonia: '',
  estadoDomicilio: '', municipioDomicilio: '', localidad: '', codigoPostal: '',
  telefono: '', correo: '',
  areaEspecialidad: '', promedio: '', periodoEstudios: '',
  tipoSangre: '', tieneAlergias: false, alergias: '',
  trabaja: false, tipoTrabajo: '', empresa: '', puesto: '', horaInicio: '', horaFin: '',
  guardianName: '', guardianEmail: '', emergencyContactPhone: '',
}

/** Grupo asignado (Paso 3): `manualOverrideOpen` reveals the exception picker; `manualGrupo` holds the reassigned choice once made. */
interface Paso3State {
  manualOverrideOpen: boolean
  manualGrupo: string
}

const emptyPaso3: Paso3State = { manualOverrideOpen: false, manualGrupo: '' }

/**
 * Mock: en producción esto vendría de GenerateMatriculasUseCase (Admisión),
 * aquí se deriva determinísticamente para el prototipo — el grupo ya fue
 * asignado aleatoriamente al generar la matrícula del candidato, antes de
 * llegar a Inscripciones (ver `03-admision.md` GenerateMatriculasUseCase).
 */
function preAssignedGroup(candidate: Candidate | null): (typeof mockGroups)[number] | null {
  if (!candidate || mockGroups.length === 0) return null
  const seed = Number(candidate.id) || candidate.folio.length
  return mockGroups[seed % mockGroups.length]
}

// Only ACTIVE institutional documents must be reviewed/accepted — mirrors
// Screen 6's own status toggle (an INACTIVE document is retired, not
// presented to new students).
const activeInstitutionalDocs = mockInstitutionalDocuments.filter(d => d.status === 'ACTIVE')

interface Paso4State {
  acceptedIds: string[]
}

const emptyPaso4: Paso4State = { acceptedIds: [] }

// ─── Paso 5: cargos + pago ────────────────────────────────────────────────
type MetodoPago = 'ONLINE' | 'VENTANILLA' | ''

/** Cuota de inscripción de nuevo ingreso — flat mock amount (no fee catalog exists in this frontend slice). */
const INSCRIPCION_MONTO = 2500

interface Paso5State {
  metodoPago: MetodoPago
}

const emptyPaso5: Paso5State = { metodoPago: '' }

/** Next matrícula, following `mockStudents`' `{año4}{periodo1}{consecutivo4}` shape — mirrors `CandidatoRegistro.tsx`'s `nextFolio()`. */
function nextMatricula(): string {
  const prefix = '20263'
  const lastNum = mockStudents.reduce((max, s) => {
    if (!s.matricula.startsWith(prefix)) return max
    const n = Number(s.matricula.slice(prefix.length))
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`
}

/** Success modal shown after "Finalizar Inscripción" — mirrors `ConfirmModal`'s visual language with a success accent. */
function SuccessModal({ nombre, matricula, onClose }: { nombre: string; matricula: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-sm mx-4 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-emerald-500" />
        </div>
        <h3 className="text-[16px] font-semibold text-[#333333] mb-1">Inscripción registrada</h3>
        <p className="text-[13px] text-[#6B7280] mb-4">{nombre} fue inscrito(a) exitosamente. Matrícula asignada:</p>
        <p className="text-[20px] font-bold text-[#009574] mb-6">{matricula}</p>
        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
        >
          Ir a Estudiantes
        </button>
      </div>
    </div>
  )
}

export default function NuevoIngresoWizard() {
  const navigate = useNavigate()

  const [paso1, setPaso1] = useState<Paso1State>(emptyPaso1)
  const [paso2, setPaso2] = useState<Paso2State>(emptyPaso2)
  const [paso3, setPaso3] = useState<Paso3State>(emptyPaso3)
  const [paso4, setPaso4] = useState<Paso4State>(emptyPaso4)
  const [paso5, setPaso5] = useState<Paso5State>(emptyPaso5)
  const [showSuccess, setShowSuccess] = useState(false)
  const [matricula] = useState(nextMatricula)

  const selectedCandidate = admittedCandidates.find(c => candidateLabel(c) === paso1.candidateLabel) ?? null
  const paso1Valid = selectedCandidate !== null

  // Prefills Paso 2's editable fields from data already captured during
  // Admisión when the selected candidate changes — Domicilio/Promedio from
  // `fichaCompleta` (only present for two demo candidates, per apply-progress
  // note), Contacto from the always-present top-level `Candidate` fields.
  useEffect(() => {
    if (!selectedCandidate) return
    const ficha = selectedCandidate.fichaCompleta
    setPaso2(p => ({
      ...p,
      telefono: selectedCandidate.telefono,
      correo: selectedCandidate.email,
      ...(ficha ? {
        calle: ficha.domicilio.calle,
        numeroExterior: ficha.domicilio.numeroExterior,
        numeroInterior: ficha.domicilio.numeroInterior,
        colonia: ficha.domicilio.colonia,
        estadoDomicilio: ficha.domicilio.estado,
        municipioDomicilio: ficha.domicilio.municipio,
        localidad: ficha.domicilio.localidad,
        codigoPostal: ficha.domicilio.codigoPostal,
        promedio: String(ficha.antecedentesEscolares.promedio),
      } : {}),
    }))
    // Only re-prefill when the selected candidate itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCandidate])

  // ── Paso 2 validation ──
  // Nacionalidad is read-only (consulta), sourced from Admisión's ficha — no
  // longer a Paso 2 input. Falls back to '' (unknown → free-text domicilio
  // branch) when the candidate has no `fichaCompleta`.
  const nationality: Nacionalidad = selectedCandidate?.fichaCompleta?.datosGenerales.nacionalidad ?? ''
  const fichaAntecedentes = selectedCandidate?.fichaCompleta?.antecedentesEscolares ?? null

  const cpValid = /^\d{5}$/.test(paso2.codigoPostal)
  const domicilioValid =
    paso2.calle.trim() !== '' && paso2.numeroExterior.trim() !== '' && paso2.colonia.trim() !== '' &&
    paso2.localidad.trim() !== '' && cpValid &&
    (nationality === 'Mexicana'
      ? paso2.estadoDomicilio !== '' && paso2.municipioDomicilio !== ''
      : paso2.estadoDomicilio.trim() !== '' && paso2.municipioDomicilio.trim() !== '')

  const correoValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paso2.correo)
  const contactoValid = paso2.telefono.trim() !== '' && correoValid

  const promedioNum = Number(paso2.promedio)
  const promedioValid = paso2.promedio.trim() !== '' && Number.isFinite(promedioNum) && promedioNum >= 0 && promedioNum <= 10
  const periodoMatch = /^(\d{4})-(\d{4})$/.exec(paso2.periodoEstudios)
  const periodoValid = periodoMatch !== null && Number(periodoMatch[2]) > Number(periodoMatch[1])
  const bachilleratoValid = paso2.areaEspecialidad.trim() !== '' && promedioValid && periodoValid

  const saludValid = paso2.tipoSangre !== '' && (!paso2.tieneAlergias || paso2.alergias.trim() !== '')

  const laboralValid = !paso2.trabaja || (
    paso2.tipoTrabajo !== '' && paso2.empresa.trim() !== '' && paso2.puesto.trim() !== '' &&
    paso2.horaInicio !== '' && paso2.horaFin !== ''
  )

  const guardianEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paso2.guardianEmail)
  const contactoEmergenciaValid = paso2.guardianName.trim() !== '' && guardianEmailValid && paso2.emergencyContactPhone.trim() !== ''

  const paso2Valid = domicilioValid && contactoValid && bachilleratoValid && saludValid && laboralValid && contactoEmergenciaValid

  // ── Paso 3 validation: pre-assigned group is valid by default; only the
  // manual-override exception path requires an explicit pick. ──
  const assignedGroup = preAssignedGroup(selectedCandidate)
  const effectiveGroup = paso3.manualGrupo !== '' ? (mockGroups.find(g => g.grupo === paso3.manualGrupo) ?? null) : assignedGroup
  const paso3Valid = paso3.manualOverrideOpen ? paso3.manualGrupo !== '' : assignedGroup !== null

  // ── Paso 4 validation: every active institutional document must be accepted ──
  const paso4Valid = activeInstitutionalDocs.length > 0 && activeInstitutionalDocs.every(d => paso4.acceptedIds.includes(d.id))

  function toggleDocAccepted(docId: string) {
    setPaso4(p => ({
      acceptedIds: p.acceptedIds.includes(docId) ? p.acceptedIds.filter(id => id !== docId) : [...p.acceptedIds, docId],
    }))
  }

  // ── Paso 5 validation: 100%-scholarship candidates (pagoFicha EXENTO) owe
  // nothing for inscripción either — total drops to $0.00 and the payment
  // method is not required. Anyone else must pick a método before finishing. ──
  const isCoveredByBenefit = selectedCandidate?.pagoFicha.status === 'EXENTO'
  const total = isCoveredByBenefit ? 0 : INSCRIPCION_MONTO
  const paso5Valid = total === 0 || paso5.metodoPago !== ''

  function handleComplete() {
    setShowSuccess(true)
  }

  // ── Paso 1 content: selección del candidato admitido + resumen de su ficha ──
  const paso1Render = (
    <div>
      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Candidato Admitido</p>
      <div className="mb-8">
        <FieldLabel required>Selecciona el candidato admitido a inscribir</FieldLabel>
        <SearchSelect
          options={candidateOptions}
          value={paso1.candidateLabel}
          onChange={v => setPaso1({ candidateLabel: v })}
          placeholder="Buscar por folio o nombre"
        />
      </div>

      {selectedCandidate ? (
        <>
          <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Datos del Admitido</p>
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-6">
              <ReadField label="Nombre Completo" value={selectedCandidate.nombre} />
            </div>
            <div className="col-span-12 md:col-span-3">
              <ReadField label="Folio" value={selectedCandidate.folio} />
            </div>
            <div className="col-span-12 md:col-span-3">
              <ReadField label="CURP" value={selectedCandidate.curp} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <ReadField label="Correo Electrónico" value={selectedCandidate.email} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <ReadField label="Teléfono" value={selectedCandidate.telefono} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <ReadField label="Programa" value={selectedCandidate.programa} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <ReadField label="División" value={selectedCandidate.division} />
            </div>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-[#6B7280]">Selecciona un candidato para ver la información capturada durante Admisión.</p>
      )}
    </div>
  )

  // ── Paso 2 content: Domicilio + Contacto + Antecedentes de Bachillerato +
  // Salud + Laboral + Contacto de Emergencia. Per the PO's correction, most
  // fields here mirror what "ya se solicitó en la ficha de admisión" — shown
  // read-only (`ReadField`) — and only a specific subset stays editable. ──
  const paso2Render = (
    <div>
      <div className="mb-8">
        <ReadField label="Nacionalidad" value={nationality || 'No disponible'} />
      </div>

      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Domicilio</p>
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 md:col-span-6">
          <TextField label="Calle" required value={paso2.calle} onChange={v => setPaso2({ ...paso2, calle: v })} />
        </div>
        <div className="col-span-6 md:col-span-3">
          <TextField label="Número Exterior" required value={paso2.numeroExterior} onChange={v => setPaso2({ ...paso2, numeroExterior: v })} />
        </div>
        <div className="col-span-6 md:col-span-3">
          <TextField label="Número Interior" value={paso2.numeroInterior} onChange={v => setPaso2({ ...paso2, numeroInterior: v })} placeholder="Opcional" />
        </div>
        <div className="col-span-12 md:col-span-6">
          <TextField label="Colonia" required value={paso2.colonia} onChange={v => setPaso2({ ...paso2, colonia: v })} />
        </div>

        {nationality === 'Mexicana' ? (
          <>
            <div className="col-span-12 md:col-span-3">
              <FieldLabel required>Estado</FieldLabel>
              <SearchSelect options={ESTADOS_CATALOGO} value={paso2.estadoDomicilio} onChange={v => setPaso2({ ...paso2, estadoDomicilio: v, municipioDomicilio: '' })} placeholder="Selecciona un estado" />
            </div>
            <div className="col-span-12 md:col-span-3">
              <FieldLabel required>Municipio</FieldLabel>
              <SearchSelect
                options={MUNICIPIOS_POR_ESTADO[paso2.estadoDomicilio] ?? []}
                value={paso2.municipioDomicilio}
                onChange={v => setPaso2({ ...paso2, municipioDomicilio: v })}
                disabled={!paso2.estadoDomicilio}
                placeholder={paso2.estadoDomicilio ? 'Selecciona un municipio' : 'Primero selecciona un estado'}
              />
            </div>
          </>
        ) : (
          <>
            <div className="col-span-12 md:col-span-3">
              <TextField label="Estado" required value={paso2.estadoDomicilio} onChange={v => setPaso2({ ...paso2, estadoDomicilio: v })} placeholder="Estado o provincia" />
            </div>
            <div className="col-span-12 md:col-span-3">
              <TextField label="Municipio" required value={paso2.municipioDomicilio} onChange={v => setPaso2({ ...paso2, municipioDomicilio: v })} />
            </div>
          </>
        )}

        <div className="col-span-12 md:col-span-6">
          <TextField label="Localidad" required value={paso2.localidad} onChange={v => setPaso2({ ...paso2, localidad: v })} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <TextField
            label="Código Postal" required value={paso2.codigoPostal}
            onChange={v => setPaso2({ ...paso2, codigoPostal: v.replace(/\D/g, '').slice(0, 5) })}
            maxLength={5} placeholder="5 dígitos"
            error={paso2.codigoPostal !== '' && !cpValid ? 'Debe tener 5 dígitos.' : undefined}
          />
        </div>
      </div>

      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Contacto</p>
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 md:col-span-6">
          <TextField label="Teléfono" required value={paso2.telefono} onChange={v => setPaso2({ ...paso2, telefono: v })} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <TextField
            label="Correo Electrónico" required value={paso2.correo}
            onChange={v => setPaso2({ ...paso2, correo: v })}
            error={paso2.correo !== '' && !correoValid ? 'Correo inválido.' : undefined}
          />
        </div>
      </div>

      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-1">Antecedentes de Bachillerato</p>
      <p className="text-[12px] text-[#6B7280] mb-4">
        Estos datos ya fueron capturados durante Admisión. Solo puedes actualizar Área/Especialidad, Promedio y Periodo de Estudios.
      </p>
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 md:col-span-8">
          <ReadField label="Nombre de la Preparatoria de Procedencia" value={fichaAntecedentes?.nombrePreparatoria || 'No disponible'} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <ReadField label="Tipo de Bachillerato" value={fichaAntecedentes?.tipoBachillerato || 'No disponible'} />
        </div>

        {fichaAntecedentes === null || fichaAntecedentes.estudioBachilleratoEnMexico ? (
          <>
            <div className="col-span-12 md:col-span-4">
              <ReadField label="Estado de la Preparatoria" value={fichaAntecedentes?.estadoPreparatoria || 'No disponible'} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <ReadField label="Municipio de la Preparatoria" value={fichaAntecedentes?.municipioPreparatoria || 'No disponible'} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <ReadField label="Clave de Centro de Trabajo (CCT)" value={fichaAntecedentes?.cct || 'No disponible'} />
            </div>
          </>
        ) : (
          <>
            <div className="col-span-12 md:col-span-6">
              <ReadField label="País de la Preparatoria" value={fichaAntecedentes.paisPreparatoria || 'No disponible'} />
            </div>
            <div className="col-span-12 md:col-span-6">
              <ReadField label="Ciudad de la Preparatoria" value={fichaAntecedentes.ciudadPreparatoria || 'No disponible'} />
            </div>
          </>
        )}

        <div className="col-span-12 md:col-span-4">
          <TextField label="Área/Especialidad de Bachillerato" required value={paso2.areaEspecialidad} onChange={v => setPaso2({ ...paso2, areaEspecialidad: v })} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <TextField
            label="Promedio" required value={paso2.promedio}
            onChange={v => setPaso2({ ...paso2, promedio: v })}
            placeholder="Ej. 8.7"
            error={paso2.promedio !== '' && !promedioValid ? 'Debe ser un número entre 0 y 10.' : undefined}
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <TextField
            label="Periodo de Estudios" required value={paso2.periodoEstudios}
            onChange={v => setPaso2({ ...paso2, periodoEstudios: v })}
            placeholder="YYYY-YYYY"
            error={paso2.periodoEstudios !== '' && !periodoValid ? 'Formato YYYY-YYYY, con año final mayor al inicial.' : undefined}
          />
        </div>
      </div>

      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Salud</p>
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 md:col-span-4">
          <FieldLabel required>Tipo de Sangre</FieldLabel>
          <SimpleSelect options={TIPOS_SANGRE} value={paso2.tipoSangre} onChange={v => setPaso2({ ...paso2, tipoSangre: v })} placeholder="Seleccionar" />
        </div>
        <div className="col-span-12 md:col-span-8 flex items-end">
          <div className="w-full">
            <SwitchField label="¿Tiene alguna alergia?" checked={paso2.tieneAlergias} onChange={v => setPaso2({ ...paso2, tieneAlergias: v })} />
          </div>
        </div>
        {paso2.tieneAlergias && (
          <div className="col-span-12">
            <TextField label="¿A qué es alérgico(a)?" required value={paso2.alergias} onChange={v => setPaso2({ ...paso2, alergias: v })} />
          </div>
        )}
      </div>

      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Laboral</p>
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12">
          <SwitchField label="¿Trabaja actualmente?" checked={paso2.trabaja} onChange={v => setPaso2({ ...paso2, trabaja: v })} />
        </div>
        {paso2.trabaja && (
          <>
            <div className="col-span-12 md:col-span-4">
              <FieldLabel required>Tipo de Trabajo</FieldLabel>
              <SimpleSelect options={TIPOS_TRABAJO} value={paso2.tipoTrabajo} onChange={v => setPaso2({ ...paso2, tipoTrabajo: v })} placeholder="Seleccionar" />
            </div>
            <div className="col-span-12 md:col-span-4">
              <TextField label="Nombre de la Empresa" required value={paso2.empresa} onChange={v => setPaso2({ ...paso2, empresa: v })} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <TextField label="Puesto" required value={paso2.puesto} onChange={v => setPaso2({ ...paso2, puesto: v })} />
            </div>
            <div className="col-span-6 md:col-span-3">
              <TextField label="Hora de Inicio" required type="time" value={paso2.horaInicio} onChange={v => setPaso2({ ...paso2, horaInicio: v })} />
            </div>
            <div className="col-span-6 md:col-span-3">
              <TextField label="Hora de Fin" required type="time" value={paso2.horaFin} onChange={v => setPaso2({ ...paso2, horaFin: v })} />
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Contacto de Emergencia</p>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <TextField label="Nombre de Padre/Madre o Tutor" required value={paso2.guardianName} onChange={v => setPaso2({ ...paso2, guardianName: v })} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <TextField
            label="Correo de Tutor" required value={paso2.guardianEmail}
            onChange={v => setPaso2({ ...paso2, guardianEmail: v })}
            error={paso2.guardianEmail !== '' && !guardianEmailValid ? 'Correo inválido.' : undefined}
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <TextField label="Teléfono de Contacto" required value={paso2.emergencyContactPhone} onChange={v => setPaso2({ ...paso2, emergencyContactPhone: v })} />
        </div>
      </div>
    </div>
  )

  // ── Paso 3 content: Grupo Asignado — read-only pre-assigned group by
  // default (already assigned randomly during Admisión's matrícula
  // generation), with an explicit low-weight manual-override affordance for
  // edge cases only, per the PO's 2026-07-03 correction. ──
  const paso3Render = (
    <div>
      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Grupo Asignado</p>

      {assignedGroup ? (
        <div className="border border-[#E5E7EB] bg-[#F8F9FA] rounded-lg px-4 py-3 mb-3">
          <p className="text-[14px] font-semibold text-[#333333]">{assignedGroup.grupo}</p>
          <p className="text-[12px] text-[#6B7280] mt-0.5">{assignedGroup.nivel} · Turno {assignedGroup.turno} · Capacidad {assignedGroup.capacidad}</p>
        </div>
      ) : (
        <p className="text-[13px] text-[#6B7280] mb-3">No hay un grupo pre-asignado para este candidato.</p>
      )}

      {paso3.manualGrupo !== '' && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[12px] font-medium">
          <AlertTriangle size={14} />
          Grupo reasignado manualmente
        </div>
      )}

      {!paso3.manualOverrideOpen ? (
        <button
          type="button"
          onClick={() => setPaso3(p => ({ ...p, manualOverrideOpen: true }))}
          className="text-[12px] text-[#6B7280] hover:text-[#009574] underline underline-offset-2 mb-8"
        >
          ¿Necesitas reasignar el grupo manualmente?
        </button>
      ) : (
        <div className="mb-8">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Reasignación manual (excepción)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mockGroups.map(g => (
              <button
                key={g.grupo}
                type="button"
                onClick={() => setPaso3(p => ({ ...p, manualGrupo: g.grupo }))}
                className={`text-left px-4 py-3 border rounded-lg transition-colors ${
                  paso3.manualGrupo === g.grupo ? 'border-[#009574] bg-[#e6f5f1]' : 'border-[#E5E7EB] bg-white hover:border-[#009574]/50'
                }`}
              >
                <p className="text-[14px] font-semibold text-[#333333]">{g.grupo}</p>
                <p className="text-[12px] text-[#6B7280] mt-0.5">{g.nivel} · Turno {g.turno} · Capacidad {g.capacidad}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {effectiveGroup && (
        <>
          <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Materias del Grupo</p>
          <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-[#F8F9FA]">
                <tr className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  <th className="px-4 py-2.5">Materia</th>
                  <th className="px-4 py-2.5">Clave</th>
                  <th className="px-4 py-2.5">Créditos</th>
                  <th className="px-4 py-2.5">Horario</th>
                </tr>
              </thead>
              <tbody>
                {effectiveGroup.materias.map(m => (
                  <tr key={m.clave} className="border-t border-[#E5E7EB]">
                    <td className="px-4 py-2.5 text-[#333333]">{m.materia}</td>
                    <td className="px-4 py-2.5 text-[#6B7280] font-mono text-[12px]">{m.clave}</td>
                    <td className="px-4 py-2.5 text-[#6B7280]">{m.creditos}</td>
                    <td className="px-4 py-2.5 text-[#6B7280]">{m.horario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )

  // ── Paso 4 content: aceptación de Documentos Institucionales (accept-all gate) ──
  const paso4Render = (
    <div>
      <p className="text-[13px] text-[#6B7280] mb-6">
        Lee y acepta cada documento institucional antes de continuar. Debes aceptar los {activeInstitutionalDocs.length} documentos para avanzar.
      </p>
      <div className="space-y-3">
        {activeInstitutionalDocs.map(doc => {
          const accepted = paso4.acceptedIds.includes(doc.id)
          return (
            <div key={doc.id} className={`flex items-start gap-3 px-4 py-3 border rounded-lg transition-colors ${accepted ? 'border-[#009574] bg-[#e6f5f1]' : 'border-[#E5E7EB] bg-white'}`}>
              <button type="button" onClick={() => toggleDocAccepted(doc.id)} className="flex-shrink-0 mt-0.5">
                {accepted ? <CheckCircle2 size={19} className="text-[#009574]" /> : <Circle size={19} className="text-[#6B7280]" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-[#333333]">{doc.name}</p>
                  <span className="text-[11px] text-[#6B7280] flex-shrink-0">{doc.version}</span>
                </div>
                <a href={doc.driveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-[12px] text-[#009574] hover:underline">
                  Ver documento <ExternalLink size={11} />
                </a>
              </div>
              <button
                type="button"
                onClick={() => toggleDocAccepted(doc.id)}
                className={`flex-shrink-0 px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
                  accepted ? 'bg-white border border-[#009574] text-[#009574]' : 'bg-[#009574] hover:bg-[#007a5e] text-white'
                }`}
              >
                {accepted ? 'Aceptado' : 'He leído y acepto'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── Paso 5 content: resumen de cargos + método de pago ──
  const paso5Render = (
    <div>
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Resumen</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <ReadField label="Estudiante" value={selectedCandidate?.nombre ?? ''} />
          <ReadField label="Programa" value={selectedCandidate?.programa ?? ''} />
          <ReadField label="Grupo Asignado" value={effectiveGroup?.grupo ?? ''} />
        </div>

        <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Cargo de Inscripción</p>
        <p className="text-[24px] font-bold text-[#009574]">${total.toFixed(2)}</p>
      </div>

      {isCoveredByBenefit ? (
        <div className="flex items-start gap-3 px-4 py-3 border border-emerald-200 bg-emerald-50 rounded-lg">
          <Gift size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-emerald-800">
            Este cargo está <strong>cubierto por beneficio</strong> (beca del 100% aplicada durante Admisión). No se requiere método de pago.
          </p>
        </div>
      ) : (
        <>
          <FieldLabel required>¿Cómo desea pagar la inscripción?</FieldLabel>
          <div className="space-y-3 mt-1">
            <RadioCard selected={paso5.metodoPago === 'ONLINE'} title="Pagar en línea (Evo Payments)" onSelect={() => setPaso5({ metodoPago: 'ONLINE' })} />
            <RadioCard selected={paso5.metodoPago === 'VENTANILLA'} title="Pagar en ventanilla de Finanzas" onSelect={() => setPaso5({ metodoPago: 'VENTANILLA' })} />
          </div>
        </>
      )}
    </div>
  )

  const steps: WizardStep[] = [
    { id: 'admitido', label: 'Datos del Admitido', render: paso1Render, isValid: paso1Valid },
    { id: 'complementarios', label: 'Datos Complementarios', render: paso2Render, isValid: paso2Valid },
    { id: 'grupo', label: 'Grupo Asignado', render: paso3Render, isValid: paso3Valid },
    { id: 'documentos', label: 'Documentos Institucionales', render: paso4Render, isValid: paso4Valid },
    { id: 'pago', label: 'Pago', render: paso5Render, isValid: paso5Valid },
  ]

  return (
    <div className="max-w-[960px] mx-auto px-8 py-8">
      {showSuccess && (
        <SuccessModal
          nombre={selectedCandidate?.nombre ?? ''}
          matricula={matricula}
          onClose={() => navigate('/inscripciones/estudiantes')}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/inscripciones')} className="hover:text-[#009574] transition-colors">
          Inicio
        </button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Inscripción — Nuevo Ingreso</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Inscripción — Nuevo Ingreso</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">Registra la inscripción de un candidato admitido en 5 pasos.</p>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
        <Wizard steps={steps} onComplete={handleComplete} finishLabel="Finalizar Inscripción" />
      </div>
    </div>
  )
}
