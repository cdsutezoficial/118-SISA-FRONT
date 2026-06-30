import { useState } from 'react'
import { ChevronRight, Pencil, Save, X, ArrowLeft } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, ModeSwitcher } from '../shared/ui'
import type { NavigateFn, FormMode } from '../shared/types'

interface Props { navigate: NavigateFn; mode: FormMode }

const PRELOADED = {
  nombre: 'División de Tecnologías de la Información',
  clave: 'DTI',
  descripcion: 'Área responsable de los programas relacionados con sistemas computacionales, desarrollo de software y gestión de tecnologías de información.',
}

export default function DivisionesForm({ navigate, mode }: Props) {
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  const [nombre, setNombre] = useState(isRegister ? '' : PRELOADED.nombre)
  const [clave, setClave] = useState(isRegister ? '' : PRELOADED.clave)
  const [descripcion, setDescripcion] = useState(isRegister ? '' : PRELOADED.descripcion)

  const disabled = isView

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate({ page: 'dashboard' })} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate({ page: 'divisiones-list' })} className="hover:text-[#009574] transition-colors">Divisiones Académicas</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar División' : isView ? 'Ver División' : 'Editar División'}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar División' : isView ? 'Ver División' : 'Editar División'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister ? 'Completa los campos para registrar una nueva división académica.' :
             isView ? 'Información de la división académica.' :
             'Modifica los datos de la división académica.'}
          </p>
        </div>
        <ModeSwitcher
          mode={mode}
          navigate={navigate}
          registerPage={{ page: 'division-form', mode: 'register' }}
          formPage={m => ({ page: 'division-form', mode: m })}
        />
      </div>

      {/* Form card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <div className="grid grid-cols-12 gap-4">
          {/* Nombre */}
          <div className="col-span-8">
            <FieldLabel required={!isView}>Nombre de la División</FieldLabel>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              disabled={disabled}
              className={inputCls(disabled, false)}
              placeholder="Ej. División de Tecnologías de la Información"
            />
            <FieldHelp>Nombre completo y oficial de la división académica.</FieldHelp>
          </div>
          {/* Clave */}
          <div className="col-span-4">
            <FieldLabel required={!isView}>Clave</FieldLabel>
            <input
              value={clave}
              onChange={e => setClave(e.target.value)}
              disabled={disabled}
              className={inputCls(disabled, false)}
              placeholder="Ej. DTI"
            />
            <FieldHelp>Identificador corto único.</FieldHelp>
          </div>
          {/* Descripción */}
          <div className="col-span-12">
            <FieldLabel>Descripción</FieldLabel>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              disabled={disabled}
              rows={4}
              className={inputCls(disabled, false) + ' resize-none'}
              placeholder="Descripción breve de la división y su enfoque académico."
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {isView ? (
          <>
            <button
              onClick={() => navigate({ page: 'divisiones-list' })}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
            >
              <ArrowLeft size={14} />Regresar
            </button>
            <button
              onClick={() => navigate({ page: 'division-form', mode: 'edit' })}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
            >
              <Pencil size={14} />Editar
            </button>
          </>
        ) : isRegister ? (
          <>
            <button
              onClick={() => navigate({ page: 'divisiones-list' })}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
            >
              <X size={14} />Cancelar
            </button>
            <button
              onClick={() => navigate({ page: 'divisiones-list', pendingToast: 'División registrada exitosamente.' })}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
            >
              <Save size={14} />Registrar División
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => navigate({ page: 'divisiones-list' })}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
            >
              <X size={14} />Cancelar
            </button>
            <button
              onClick={() => navigate({ page: 'divisiones-list', pendingToast: 'División actualizada exitosamente.' })}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
            >
              <Save size={14} />Guardar Cambios
            </button>
          </>
        )}
      </div>
    </div>
  )
}
