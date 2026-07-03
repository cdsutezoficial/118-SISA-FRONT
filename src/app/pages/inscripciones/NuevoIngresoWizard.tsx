import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { Wizard, type WizardStep } from '../../shared/Wizard'
import { FieldLabel, FieldError, SearchSelect, SimpleSelect, Switch, inputCls } from '../../shared/ui'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate } from '../../shared/admision/types'
import { mockStudents, MUNICIPIOS_POR_ESTADO } from '../../shared/inscripciones/mockData'

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

const PASO_PENDIENTE = <p className="text-[13px] text-[#6B7280]">Este paso se implementa en un commit posterior.</p>

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
const TIPOS_BACHILLERATO = ['General', 'Tecnológico', 'Bachillerato Técnico', 'CONALEP', 'Otro']
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

interface Paso2State {
  nationality: Nacionalidad
  // Domicilio
  calle: string
  numeroExterior: string
  numeroInterior: string
  colonia: string
  estadoDomicilio: string
  municipioDomicilio: string
  localidad: string
  codigoPostal: string
  // Antecedentes de Bachillerato
  nombrePreparatoria: string
  tipoBachillerato: string
  studiedInMexico: boolean
  estadoBachillerato: string
  municipioBachillerato: string
  cct: string
  paisBachillerato: string
  estadoBachilleratoExt: string
  ciudadBachillerato: string
  // Salud
  tipoSangre: string
  tieneAlergias: boolean
  alergias: string
  // Laboral
  trabaja: boolean
  tipoTrabajo: string
  empresa: string
  puesto: string
  horaInicio: string
  horaFin: string
}

const emptyPaso2: Paso2State = {
  nationality: '',
  calle: '', numeroExterior: '', numeroInterior: '', colonia: '',
  estadoDomicilio: '', municipioDomicilio: '', localidad: '', codigoPostal: '',
  nombrePreparatoria: '', tipoBachillerato: '', studiedInMexico: true,
  estadoBachillerato: '', municipioBachillerato: '', cct: '',
  paisBachillerato: '', estadoBachilleratoExt: '', ciudadBachillerato: '',
  tipoSangre: '', tieneAlergias: false, alergias: '',
  trabaja: false, tipoTrabajo: '', empresa: '', puesto: '', horaInicio: '', horaFin: '',
}

export default function NuevoIngresoWizard() {
  const navigate = useNavigate()

  const [paso1, setPaso1] = useState<Paso1State>(emptyPaso1)
  const [paso2, setPaso2] = useState<Paso2State>(emptyPaso2)

  const selectedCandidate = admittedCandidates.find(c => candidateLabel(c) === paso1.candidateLabel) ?? null
  const paso1Valid = selectedCandidate !== null

  // ── Paso 2 validation ──
  const cpValid = /^\d{5}$/.test(paso2.codigoPostal)
  const domicilioValid =
    paso2.calle.trim() !== '' && paso2.numeroExterior.trim() !== '' && paso2.colonia.trim() !== '' &&
    paso2.localidad.trim() !== '' && cpValid &&
    (paso2.nationality === 'Mexicana'
      ? paso2.estadoDomicilio !== '' && paso2.municipioDomicilio !== ''
      : paso2.estadoDomicilio.trim() !== '' && paso2.municipioDomicilio.trim() !== '')

  const bachilleratoValid =
    paso2.nombrePreparatoria.trim() !== '' && paso2.tipoBachillerato !== '' &&
    (paso2.studiedInMexico
      ? paso2.estadoBachillerato !== '' && paso2.municipioBachillerato !== '' && paso2.cct.trim() !== ''
      : paso2.paisBachillerato.trim() !== '' && paso2.estadoBachilleratoExt.trim() !== '' && paso2.ciudadBachillerato.trim() !== '')

  const saludValid = paso2.tipoSangre !== '' && (!paso2.tieneAlergias || paso2.alergias.trim() !== '')

  const laboralValid = !paso2.trabaja || (
    paso2.tipoTrabajo !== '' && paso2.empresa.trim() !== '' && paso2.puesto.trim() !== '' &&
    paso2.horaInicio !== '' && paso2.horaFin !== ''
  )

  const paso2Valid = paso2.nationality !== '' && domicilioValid && bachilleratoValid && saludValid && laboralValid

  function handleComplete() {
    // Implemented once Paso 5 (Pago) lands.
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

  // ── Paso 2 content: Domicilio + Antecedentes de Bachillerato + Salud + Laboral ──
  const paso2Render = (
    <div>
      <div className="mb-8">
        <FieldLabel required>Nacionalidad</FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          <RadioCard selected={paso2.nationality === 'Mexicana'} title="Mexicana" onSelect={() => setPaso2({ ...paso2, nationality: 'Mexicana', estadoDomicilio: '', municipioDomicilio: '' })} />
          <RadioCard selected={paso2.nationality === 'Extranjera'} title="Extranjera" onSelect={() => setPaso2({ ...paso2, nationality: 'Extranjera', estadoDomicilio: '', municipioDomicilio: '' })} />
        </div>
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

        {paso2.nationality === 'Mexicana' ? (
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

      <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Antecedentes de Bachillerato</p>
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 md:col-span-8">
          <TextField label="Nombre de la Preparatoria de Procedencia" required value={paso2.nombrePreparatoria} onChange={v => setPaso2({ ...paso2, nombrePreparatoria: v })} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <FieldLabel required>Tipo de Bachillerato</FieldLabel>
          <SimpleSelect options={TIPOS_BACHILLERATO} value={paso2.tipoBachillerato} onChange={v => setPaso2({ ...paso2, tipoBachillerato: v })} placeholder="Seleccionar" />
        </div>

        <div className="col-span-12">
          <SwitchField label="¿Estudió el bachillerato en México?" checked={paso2.studiedInMexico} onChange={v => setPaso2({ ...paso2, studiedInMexico: v })} />
        </div>

        {paso2.studiedInMexico ? (
          <>
            <div className="col-span-12 md:col-span-4">
              <FieldLabel required>Estado de la Preparatoria</FieldLabel>
              <SearchSelect options={ESTADOS_CATALOGO} value={paso2.estadoBachillerato} onChange={v => setPaso2({ ...paso2, estadoBachillerato: v, municipioBachillerato: '' })} placeholder="Selecciona un estado" />
            </div>
            <div className="col-span-12 md:col-span-4">
              <FieldLabel required>Municipio de la Preparatoria</FieldLabel>
              <SearchSelect
                options={MUNICIPIOS_POR_ESTADO[paso2.estadoBachillerato] ?? []}
                value={paso2.municipioBachillerato}
                onChange={v => setPaso2({ ...paso2, municipioBachillerato: v })}
                disabled={!paso2.estadoBachillerato}
                placeholder={paso2.estadoBachillerato ? 'Selecciona un municipio' : 'Primero selecciona un estado'}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <TextField label="Clave de Centro de Trabajo (CCT)" required value={paso2.cct} onChange={v => setPaso2({ ...paso2, cct: v.toUpperCase() })} placeholder="Ej. 17DCT0001A" />
            </div>
          </>
        ) : (
          <>
            <div className="col-span-12 md:col-span-4">
              <TextField label="País de la Preparatoria" required value={paso2.paisBachillerato} onChange={v => setPaso2({ ...paso2, paisBachillerato: v })} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <TextField label="Estado de la Preparatoria" required value={paso2.estadoBachilleratoExt} onChange={v => setPaso2({ ...paso2, estadoBachilleratoExt: v })} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <TextField label="Ciudad de la Preparatoria" required value={paso2.ciudadBachillerato} onChange={v => setPaso2({ ...paso2, ciudadBachillerato: v })} />
            </div>
          </>
        )}
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
      <div className="grid grid-cols-12 gap-6">
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
    </div>
  )

  const steps: WizardStep[] = [
    { id: 'admitido', label: 'Datos del Admitido', render: paso1Render, isValid: paso1Valid },
    { id: 'complementarios', label: 'Datos Complementarios', render: paso2Render, isValid: paso2Valid },
    { id: 'grupo', label: 'Grupo Asignado', render: PASO_PENDIENTE },
    { id: 'documentos', label: 'Documentos Institucionales', render: PASO_PENDIENTE },
    { id: 'pago', label: 'Pago', render: PASO_PENDIENTE },
  ]

  return (
    <div className="max-w-[960px] mx-auto px-8 py-8">
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
