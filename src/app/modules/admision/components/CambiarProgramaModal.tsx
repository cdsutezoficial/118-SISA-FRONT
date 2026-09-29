import { useState } from 'react'
import { SearchSelect } from '@app/core/components/ui'
import type { Candidate } from '../data/types'

/**
 * Cambiar Programa — modal inline compartido por `CandidatosList.tsx` (row
 * action) y `CandidatoDetalle.tsx` (action zone). Per el nav-supplement prompt:
 * "FLUJO: Cambio de Programa ... Modal inline con Select del nuevo programa +
 * advertencia de cupo (no navega a otra pantalla)."
 */
export function CambiarProgramaModal({ candidate, programas, onSave, onCancel }: {
  candidate: Candidate
  programas: string[]
  onSave: (nuevoPrograma: string) => void
  onCancel: () => void
}) {
  const opciones = programas.filter(p => p !== candidate.programa)
  const [nuevoPrograma, setNuevoPrograma] = useState(opciones[0] ?? '')

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-md mx-4 p-6">
        <h3 className="text-[15px] font-semibold text-[#333333] mb-1">Cambiar Carrera</h3>
        <p className="text-[13px] text-[#6B7280] mb-4">
          Candidato: <strong className="text-[#333333]">{candidate.nombre}</strong> · Carrera actual:{' '}
          <strong className="text-[#333333]">{candidate.programa}</strong>
        </p>

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-[#333333] mb-1">Nueva Carrera</label>
          <SearchSelect
            options={opciones}
            value={nuevoPrograma}
            onChange={setNuevoPrograma}
            placeholder="Selecciona una carrera"
          />
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 mb-6 text-[12px] text-amber-700">
          Verifica que la nueva carrera cuente con cupo disponible en el periodo activo antes de confirmar el cambio.
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => nuevoPrograma && onSave(nuevoPrograma)}
            disabled={!nuevoPrograma}
            className="px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
Cambiar Carrera
          </button>
        </div>
      </div>
    </div>
  )
}