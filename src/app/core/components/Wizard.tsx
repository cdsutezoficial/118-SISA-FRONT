import { useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { Button } from './form'

/**
 * Generic, reusable stepper/wizard primitive.
 *
 * Domain-agnostic: it knows nothing about candidates, folios, or any other
 * module concept. The consuming page owns all form data (lifted `useState`)
 * and passes it into each step's `render`; the Wizard only tracks which step
 * is current and where navigation is allowed.
 *
 * Navigation model:
 * - The stepper header is clickable: you can jump to any step at any time
 *   (forward or backward), so users can preview what every step asks without
 *   having to complete the current one first.
 * - Steps marked `gated: true` (summary/confirmation screens) stay locked
 *   until every previous step is valid — you can't enter them, and the
 *   submit action only fires when all steps are valid.
 *
 * Because the Wizard never holds form data itself, navigating back and forth
 * between steps can never clear previously entered values — that state lives
 * entirely in the parent and simply keeps re-rendering as `currentStep` moves.
 */
export interface WizardStep {
  id: string
  label: string
  render: React.ReactNode
  /** Omit (or leave `undefined`) for steps that should always allow advancing. */
  isValid?: boolean
  /**
   * true → paso bloqueado (resumen/confirmación/pago final): no se puede
   * entrar ni finalizar hasta que todos los pasos anteriores sean válidos.
   */
  gated?: boolean
}

interface WizardProps {
  steps: WizardStep[]
  onComplete: () => void
  /** Label for the Next action on the last step. Defaults to "Finalizar". */
  finishLabel?: string
}

export function Wizard({ steps, onComplete, finishLabel = 'Finalizar' }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1

  // Steps without a validation function (isValid === undefined) count as valid.
  const isStepValid = (s: WizardStep) => s.isValid !== false
  // A gated step can only be entered when all previous steps are valid.
  const canEnterStep = (i: number) => {
    if (i < 0 || i >= steps.length) return false
    if (!steps[i].gated) return true
    return steps.slice(0, i).every(isStepValid)
  }
  // Submitting only makes sense when every step is valid.
  const canSubmit = steps.every(isStepValid)

  function goBack() {
    setCurrentStep(s => Math.max(0, s - 1))
  }

  function goNext() {
    if (isLastStep) {
      if (canSubmit) onComplete()
      return
    }
    if (!canEnterStep(currentStep + 1)) return
    setCurrentStep(s => s + 1)
  }

  return (
    <div>
      {/* Stepper header (clickable — free navigation, gated steps locked) */}
      <div className="flex items-start mb-8">
        {steps.map((s, i) => {
          const done = isStepValid(s)
          const isCurrent = i === currentStep
          const locked = !!s.gated && !canEnterStep(i)
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => setCurrentStep(i)}
                disabled={locked}
                title={locked ? 'Completa los pasos anteriores para desbloquear.' : s.label}
                className="flex flex-col items-center group flex-shrink-0"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-colors flex-shrink-0
                    ${done && !isCurrent ? 'bg-[#009574] text-white' : isCurrent ? 'border-2 border-[#009574] text-[#009574] bg-white' : 'border border-[#E5E7EB] text-[#6B7280] bg-white'}`}
                >
                  {locked ? <Lock size={13} /> : done && !isCurrent ? <Check size={15} /> : i + 1}
                </div>
                <span
                  className={`mt-1.5 text-[11px] font-medium whitespace-nowrap ${isCurrent ? 'text-[#009574]' : done ? 'text-[#333333]' : 'text-[#6B7280]'}`}
                >
                  {s.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mt-4 ${done ? 'bg-[#009574]' : 'bg-[#E5E7EB]'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="mb-8">{step.render}</div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="secondary" size="md" onClick={goBack} disabled={currentStep === 0}>
          Anterior
        </Button>
        <Button variant="primary" size="md" onClick={goNext} disabled={isLastStep ? !canSubmit : !canEnterStep(currentStep + 1)}>
          {isLastStep ? finishLabel : 'Siguiente'}
        </Button>
      </div>
    </div>
  )
}
