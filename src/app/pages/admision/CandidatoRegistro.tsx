import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, ShieldCheck, CheckCircle2, GraduationCap, Loader2 } from 'lucide-react'
import { Wizard, type WizardStep } from '../../shared/Wizard'
import { FieldLabel, FieldError, SearchSelect, SimpleSelect, DatePicker } from '../../shared/ui'
import { formatDate } from '../../shared/utils'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate } from '../../shared/admision/types'

/**
 * Screen 4 — Registro de Candidato: Wizard (3 pasos).
 *
 * Dual-mounted per `specs/admision-screens/spec.md` — "Registro de Candidato
 * Wizard (Screen 4)": identical fields/validation for both mounts, `origin`
 * drives ONLY post-completion navigation + chrome.
 * - Staff: `/admision/candidatos/registrar` (AppLayout, sidebar/breadcrumb present).
 * - Público: `/portal/registro` (AuthLayout, no sidebar/navbar — anonymous self-registration).
 *
 * Content per `03-admision.md` "Pantalla 4" + the authoritative correction
 * "Corrección — Pantalla 4: Wizard (LlaveMX obligatorio + isFirstChoice)":
 * Paso 1 replaces the "¿Tiene LlaveMX?" switch with a mandatory identity
 * verification gate; Paso 2 adds `isFirstChoice` after program selection and
 * relabels "Turno Preferido" → "Turno de Preferencia"; Paso 3 is unchanged.
 */

export type ScreenOrigin = 'staff' | 'public'

interface CandidatoRegistroProps {
  origin: ScreenOrigin
}

// ─── Mock catalogs ───────────────────────────────────────────────────────────
// Mirrors the canonical program catalog in `pages/ProgramasList.tsx` (names +
// division) so a freshly-registered candidate's `division` lines up with the
// same divisions used across the rest of the Admisión mock data.

const PROGRAMA_DIVISION: Record<string, string> = {
  'Ingeniería en Desarrollo y Gestión de Software': 'División de Tecnologías de la Información',
  'Técnico Superior Universitario en TI': 'División de Tecnologías de la Información',
  'Licenciatura en Administración de Empresas': 'División de Ciencias Económico Administrativas',
  'Ingeniería Industrial': 'División de Ingeniería',
}
const PROGRAMAS = Object.keys(PROGRAMA_DIVISION)

// Mirrors `pages/admision/CanalesDifusion.tsx`'s catalog.
const CANALES = ['Redes Sociales', 'Feria Universitaria', 'Recomendación de egresado', 'Página web institucional', 'Radio y televisión']

const GENEROS = ['Masculino', 'Femenino', 'Prefiero no indicar']
const TURNOS = ['Matutino', 'Vespertino', 'Sin preferencia']
const MUNICIPIOS = ['Cuernavaca', 'Emiliano Zapata', 'Jiutepec', 'Temixco', 'Xochitepec', 'Yautepec']

const FICHA_MONTO = 500
const INDUCCION_MONTO = 350

// Simulated LlaveMX identity response — no real OAuth, per spec. A fixed mock
// identity keeps the prototype deterministic across verifications.
const MOCK_LLAVE_MX_IDENTITY = {
  nombres: 'María Fernanda',
  apellidoPaterno: 'López',
  apellidoMaterno: 'Torres',
  curp: 'LOTM060512MMCPRR09',
}

type MetodoPago = 'ONLINE' | 'VENTANILLA'

interface Paso1State {
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  curp: string
  fechaNacimiento: string
  genero: string
  email: string
  telefono: string
  canal: string
}

interface Paso2State {
  programa: string
  isFirstChoice: boolean | null
  turno: string
  escuelaProcedencia: string
  promedio: string
  localidad: string
  municipio: string
}

const emptyPaso1: Paso1State = {
  nombres: '', apellidoPaterno: '', apellidoMaterno: '', curp: '', fechaNacimiento: '',
  genero: '', email: '', telefono: '', canal: '',
}
const emptyPaso2: Paso2State = {
  programa: '', isFirstChoice: null, turno: '', escuelaProcedencia: '', promedio: '', localidad: '', municipio: '',
}

function nextFolio(): string {
  const lastNum = mockCandidates.reduce((max, c) => {
    const n = Number(c.folio.split('-').pop())
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)
  return `ADM-2026-${String(lastNum + 1).padStart(6, '0')}`
}

// ─── Radio card — shared visual for Paso 2 (isFirstChoice) and Paso 3 (método
// de pago); both need a selectable card with a title + description. ─────────

function RadioCard({ selected, title, description, onSelect }: {
  selected: boolean; title: string; description?: string; onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 border rounded-lg transition-colors ${
        selected ? 'border-[#009574] bg-[#e6f5f1]' : 'border-[#E5E7EB] bg-white hover:border-[#009574]/50'
      }`}
    >
      <span
        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
          selected ? 'border-[#009574]' : 'border-[#E5E7EB]'
        }`}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-[#009574]" />}
      </span>
      <span>
        <span className="block text-[13px] font-semibold text-[#333333]">{title}</span>
        {description && <span className="block text-[12px] text-[#6B7280] mt-0.5">{description}</span>}
      </span>
    </button>
  )
}

// ─── ReadField (Paso 3 summary) ──────────────────────────────────────────────

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[13px] text-[#333333] font-medium">{value || '—'}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CandidatoRegistro({ origin }: CandidatoRegistroProps) {
  const navigate = useNavigate()

  const [paso1, setPaso1] = useState<Paso1State>(emptyPaso1)
  const [paso2, setPaso2] = useState<Paso2State>(emptyPaso2)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('ONLINE')
  const [identityStatus, setIdentityStatus] = useState<'idle' | 'verifying' | 'verified'>('idle')
  const [folio] = useState(nextFolio)

  const isVerified = identityStatus === 'verified'
  const verifiedFullName = `${MOCK_LLAVE_MX_IDENTITY.nombres} ${MOCK_LLAVE_MX_IDENTITY.apellidoPaterno} ${MOCK_LLAVE_MX_IDENTITY.apellidoMaterno}`

  function handleVerify() {
    if (identityStatus !== 'idle') return
    setIdentityStatus('verifying')
    // Simulated verification — no real OAuth. Auto-fills the identity fields
    // LlaveMX would normally return, same as a real government-ID lookup.
    setTimeout(() => {
      setPaso1(f => ({
        ...f,
        nombres: MOCK_LLAVE_MX_IDENTITY.nombres,
        apellidoPaterno: MOCK_LLAVE_MX_IDENTITY.apellidoPaterno,
        apellidoMaterno: MOCK_LLAVE_MX_IDENTITY.apellidoMaterno,
        curp: MOCK_LLAVE_MX_IDENTITY.curp,
      }))
      setIdentityStatus('verified')
    }, 900)
  }

  // ── Paso 1 validation ──
  const curpValid = paso1.curp.trim().length === 18
  const emailValid = /\S+@\S+\.\S+/.test(paso1.email)
  const telefonoValid = /^\d{10}$/.test(paso1.telefono.replace(/\s/g, ''))
  const paso1Valid =
    isVerified &&
    paso1.nombres.trim() !== '' &&
    paso1.apellidoPaterno.trim() !== '' &&
    curpValid &&
    paso1.fechaNacimiento !== '' &&
    emailValid &&
    telefonoValid &&
    paso1.canal !== ''

  // ── Paso 2 validation ──
  const promedioNum = Number(paso2.promedio)
  const promedioValid = paso2.promedio.trim() !== '' && !Number.isNaN(promedioNum) && promedioNum >= 0 && promedioNum <= 10
  const paso2Valid =
    paso2.programa !== '' &&
    paso2.isFirstChoice !== null &&
    paso2.escuelaProcedencia.trim() !== '' &&
    promedioValid &&
    paso2.localidad.trim() !== '' &&
    paso2.municipio !== ''

  // ── Paso 3 validation ──
  const paso3Valid = metodoPago === 'ONLINE' || metodoPago === 'VENTANILLA'

  const nombreCompleto = `${paso1.nombres} ${paso1.apellidoPaterno} ${paso1.apellidoMaterno}`.trim()

  function handleComplete() {
    const division = PROGRAMA_DIVISION[paso2.programa] ?? ''
    const candidate: Candidate = {
      id: crypto.randomUUID(),
      folio,
      nombre: nombreCompleto,
      curp: paso1.curp.toUpperCase(),
      email: paso1.email,
      telefono: paso1.telefono,
      programa: paso2.programa,
      division,
      canal: paso1.canal,
      status: 'REGISTERED',
      fechaRegistro: formatDate(new Date()),
      examen: null,
      induccionResultado: null,
      induccionHabilitada: false,
      pagoFicha: { status: 'PENDIENTE', monto: FICHA_MONTO },
      pagoInduccion: { status: 'PENDIENTE', monto: INDUCCION_MONTO },
    }

    const state = { candidate, metodoPago }

    // Forward pointer — Screen 13 (Ficha Confirmación) is task 2.6, not yet built.
    if (origin === 'staff') {
      navigate('/admision/candidatos/ficha', { state })
    } else {
      navigate('/portal/registro/ficha', { state })
    }
  }

  // ── Paso 1 content ──
  const paso1Render = (
    <div>
      {/* Verificación de Identidad requerida — replaces the removed
          "¿Tiene LlaveMX?" switch per the authoritative correction. */}
      <div className="border-2 border-[#009574] rounded-lg p-5 mb-6 bg-[#e6f5f1]/40">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#009574] flex items-center justify-center">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#333333]">Verificación de Identidad requerida</p>
            <p className="text-[13px] text-[#6B7280] mt-1">
              Para registrar tu ficha debes verificar tu identidad con LlaveMX. Este paso es obligatorio.
            </p>

            {!isVerified ? (
              <button
                type="button"
                onClick={handleVerify}
                disabled={identityStatus === 'verifying'}
                className="mt-4 flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {identityStatus === 'verifying' && <Loader2 size={14} className="animate-spin" />}
                {identityStatus === 'verifying' ? 'Verificando...' : 'Verificar con LlaveMX'}
              </button>
            ) : (
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

      {/* Formulario — Datos Personales */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <FieldLabel required>Nombre(s)</FieldLabel>
          <input
            value={paso1.nombres}
            onChange={e => setPaso1({ ...paso1, nombres: e.target.value })}
            placeholder="Nombre(s)"
            className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <FieldLabel required>Primer Apellido</FieldLabel>
          <input
            value={paso1.apellidoPaterno}
            onChange={e => setPaso1({ ...paso1, apellidoPaterno: e.target.value })}
            placeholder="Primer Apellido"
            className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <FieldLabel>Segundo Apellido</FieldLabel>
          <input
            value={paso1.apellidoMaterno}
            onChange={e => setPaso1({ ...paso1, apellidoMaterno: e.target.value })}
            placeholder="Segundo Apellido"
            className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
          />
        </div>

        <div className="col-span-12 md:col-span-6">
          <FieldLabel required>CURP</FieldLabel>
          <input
            value={paso1.curp}
            onChange={e => setPaso1({ ...paso1, curp: e.target.value.toUpperCase() })}
            maxLength={18}
            placeholder="18 caracteres"
            className="w-full px-3 py-2 text-[13px] font-mono uppercase tracking-wider border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
          />
          {paso1.curp !== '' && !curpValid && <FieldError>La CURP debe tener 18 caracteres.</FieldError>}
        </div>
        <div className="col-span-6 md:col-span-3">
          <FieldLabel required>Fecha de Nacimiento</FieldLabel>
          <DatePicker value={paso1.fechaNacimiento} onChange={v => setPaso1({ ...paso1, fechaNacimiento: v })} />
        </div>
        <div className="col-span-6 md:col-span-3">
          <FieldLabel>Género</FieldLabel>
          <SimpleSelect options={GENEROS} value={paso1.genero} onChange={v => setPaso1({ ...paso1, genero: v })} placeholder="Seleccionar" />
        </div>

        <div className="col-span-12 md:col-span-6">
          <FieldLabel required>Correo Electrónico</FieldLabel>
          <input
            type="email"
            value={paso1.email}
            onChange={e => setPaso1({ ...paso1, email: e.target.value })}
            placeholder="Para notificaciones del proceso"
            className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
          />
          {paso1.email !== '' && !emailValid && <FieldError>Ingresa un correo electrónico válido.</FieldError>}
        </div>
        <div className="col-span-12 md:col-span-6">
          <FieldLabel required>Teléfono Celular</FieldLabel>
          <input
            value={paso1.telefono}
            onChange={e => setPaso1({ ...paso1, telefono: e.target.value })}
            maxLength={10}
            placeholder="10 dígitos"
            className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
          />
          {paso1.telefono !== '' && !telefonoValid && <FieldError>Ingresa 10 dígitos numéricos.</FieldError>}
        </div>

        <div className="col-span-12 md:col-span-6">
          <FieldLabel required>Canal por el que se enteró</FieldLabel>
          <SearchSelect options={CANALES} value={paso1.canal} onChange={v => setPaso1({ ...paso1, canal: v })} placeholder="Selecciona un canal" />
        </div>
      </div>
    </div>
  )

  // ── Paso 2 content ──
  const paso2Render = (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 md:col-span-8">
        <FieldLabel required>Programa Educativo Solicitado</FieldLabel>
        <SearchSelect options={PROGRAMAS} value={paso2.programa} onChange={v => setPaso2({ ...paso2, programa: v })} placeholder="Selecciona un programa" />
      </div>
      <div className="col-span-12 md:col-span-4">
        <FieldLabel>Turno de Preferencia</FieldLabel>
        <SimpleSelect options={TURNOS} value={paso2.turno} onChange={v => setPaso2({ ...paso2, turno: v })} placeholder="Seleccionar" />
      </div>

      <div className="col-span-12">
        <FieldLabel required>¿Es tu primera opción de programa?</FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          <RadioCard
            selected={paso2.isFirstChoice === true}
            title="Sí, es mi primera opción"
            onSelect={() => setPaso2({ ...paso2, isFirstChoice: true })}
          />
          <RadioCard
            selected={paso2.isFirstChoice === false}
            title="No, es mi segunda opción"
            onSelect={() => setPaso2({ ...paso2, isFirstChoice: false })}
          />
        </div>
      </div>

      <div className="col-span-12 md:col-span-8">
        <FieldLabel required>Escuela de Procedencia</FieldLabel>
        <input
          value={paso2.escuelaProcedencia}
          onChange={e => setPaso2({ ...paso2, escuelaProcedencia: e.target.value })}
          placeholder="Nombre de la escuela"
          className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
        />
      </div>
      <div className="col-span-12 md:col-span-4">
        <FieldLabel required>Promedio de Bachillerato</FieldLabel>
        <input
          type="number" min={0} max={10} step={0.1}
          value={paso2.promedio}
          onChange={e => setPaso2({ ...paso2, promedio: e.target.value })}
          placeholder="0–10"
          className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] tabular-nums"
        />
        {paso2.promedio !== '' && !promedioValid && <FieldError>Debe estar entre 0 y 10.</FieldError>}
      </div>

      <div className="col-span-12 md:col-span-6">
        <FieldLabel required>Localidad de Residencia</FieldLabel>
        <input
          value={paso2.localidad}
          onChange={e => setPaso2({ ...paso2, localidad: e.target.value })}
          placeholder="Localidad"
          className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
        />
      </div>
      <div className="col-span-12 md:col-span-6">
        <FieldLabel required>Municipio</FieldLabel>
        <SearchSelect options={MUNICIPIOS} value={paso2.municipio} onChange={v => setPaso2({ ...paso2, municipio: v })} placeholder="Selecciona un municipio" />
      </div>
    </div>
  )

  // ── Paso 3 content ──
  const paso3Render = (
    <div>
      <div className="bg-white border-2 border-[#009574] rounded-lg p-6 mb-6">
        <p className="text-[11px] font-semibold text-[#009574] uppercase tracking-widest mb-4">Resumen de Registro</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <ReadField label="Nombre Completo" value={nombreCompleto} />
          <ReadField label="CURP" value={paso1.curp} />
          <ReadField label="Correo Electrónico" value={paso1.email} />
          <ReadField label="Teléfono Celular" value={paso1.telefono} />
          <ReadField label="Programa Solicitado" value={paso2.programa} />
          <ReadField label="Folio Generado" value={folio} />
        </div>
        <div className="pt-4 border-t border-[#E5E7EB]">
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
    { id: 'datos-personales', label: 'Datos Personales', render: paso1Render, isValid: paso1Valid },
    { id: 'informacion-academica', label: 'Información Académica', render: paso2Render, isValid: paso2Valid },
    { id: 'confirmacion', label: 'Confirmación', render: paso3Render, isValid: paso3Valid },
  ]

  const content = (
    <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
      <Wizard steps={steps} onComplete={handleComplete} finishLabel="Finalizar Registro" />
    </div>
  )

  // ── Staff mount — AppLayout shell, sidebar/breadcrumb present ──
  if (origin === 'staff') {
    return (
      <div className="max-w-[960px] mx-auto px-8 py-8">
        <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
          <button onClick={() => navigate('/admision')} className="hover:text-[#009574] transition-colors">Inicio</button>
          <ChevronRight size={13} />
          <span className="text-[#6B7280]">Admisión</span>
          <ChevronRight size={13} />
          <button onClick={() => navigate('/admision/candidatos')} className="hover:text-[#009574] transition-colors">Candidatos</button>
          <ChevronRight size={13} />
          <span className="text-[#333333] font-medium">Registrar Candidato</span>
        </nav>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#333333]">Registrar Candidato</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Completa los tres pasos para registrar al aspirante en el proceso de admisión.</p>
        </div>

        {content}
      </div>
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
          <p className="text-[14px] text-[#6B7280] mt-1">Completa los tres pasos para registrarte en el proceso de admisión.</p>
        </div>

        {content}
      </div>
    </div>
  )
}
