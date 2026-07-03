import { useNavigate } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { Wizard, type WizardStep } from '../../shared/Wizard'

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

export default function NuevoIngresoWizard() {
  const navigate = useNavigate()

  function handleComplete() {
    // Implemented once Paso 5 (Pago) lands.
  }

  const steps: WizardStep[] = [
    { id: 'admitido', label: 'Datos del Admitido', render: PASO_PENDIENTE },
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
