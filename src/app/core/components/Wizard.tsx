import { useState } from 'react'
import { Check } from 'lucide-react'

/**
 * Generic, reusable stepper/wizard primitive.
 *
 * Domain-agnostic: it knows nothing about candidates, folios, or any other
 * Admisión-specific concept. The consuming page owns all form data (lifted
 * `useState`) and passes it into each step's `render`; the Wizard only tracks
 * which step is current and whether "Siguiente" is allowed to advance.
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
  // Steps without a validation function (isValid === undefined) allow advancing freely.
  const canAdvance = step.isValid !== false

  function goBack() {
    setCurrentStep(s => Math.max(0, s - 1))
  }

  function goNext() {
    if (!canAdvance) return
    if (isLastStep) {
      onComplete()
      return
    }
    setCurrentStep(s => Math.min(steps.length - 1, s + 1))
  }

  return (
    <div>
      {/* Stepper header */}
      <div className="flex items-start mb-8">
        {steps.map((s, i) => {
          const isCompleted = i < currentStep
          const isCurrent = i === currentStep
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-colors flex-shrink-0
                    ${isCompleted ? 'bg-[#009574] text-white' : isCurrent ? 'border-2 border-[#009574] text-[#009574] bg-white' : 'border border-[#E5E7EB] text-[#6B7280] bg-white'}`}
                >
                  {isCompleted ? <Check size={15} /> : i + 1}
                </div>
                <span
                  className={`mt-1.5 text-[11px] font-medium whitespace-nowrap ${isCurrent ? 'text-[#009574]' : isCompleted ? 'text-[#333333]' : 'text-[#6B7280]'}`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mt-4 ${isCompleted ? 'bg-[#009574]' : 'bg-[#E5E7EB]'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="mb-8">{step.render}</div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={currentStep === 0}
          className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canAdvance}
          className="px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLastStep ? finishLabel : 'Siguiente'}
        </button>
      </div>
    </div>
  )
}
