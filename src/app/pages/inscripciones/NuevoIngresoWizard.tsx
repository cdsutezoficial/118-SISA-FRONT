import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { Wizard, type WizardStep } from '../../shared/Wizard'
import { FieldLabel, SearchSelect } from '../../shared/ui'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate } from '../../shared/admision/types'
import { mockStudents } from '../../shared/inscripciones/mockData'

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

export default function NuevoIngresoWizard() {
  const navigate = useNavigate()

  const [paso1, setPaso1] = useState<Paso1State>(emptyPaso1)

  const selectedCandidate = admittedCandidates.find(c => candidateLabel(c) === paso1.candidateLabel) ?? null
  const paso1Valid = selectedCandidate !== null

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

  const steps: WizardStep[] = [
    { id: 'admitido', label: 'Datos del Admitido', render: paso1Render, isValid: paso1Valid },
    { id: 'complementarios', label: 'Datos Complementarios', render: PASO_PENDIENTE },
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
