import { useState } from 'react'
import { ChevronRight, Pencil, Save, X, ArrowLeft } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, ModeSwitcher, SearchSelect } from '../shared/ui'
import type { NavigateFn, FormMode } from '../shared/types'

interface Props { navigate: NavigateFn; mode: FormMode }

const PRELOADED = {
  nombre: 'Ingeniería en Desarrollo y Gestión de Software',
  clave: 'IDGS',
  division: 'DTI',
  claveDGP: '220740067',
}

const divisiones = ['DTI', 'DCEA', 'DCS', 'DI']

export default function ProgramasForm({ navigate, mode }: Props) {
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  const [nombre, setNombre] = useState(isRegister ? '' : PRELOADED.nombre)
  const [clave, setClave] = useState(isRegister ? '' : PRELOADED.clave)
  const [division, setDivision] = useState(isRegister ? '' : PRELOADED.division)
  const [claveDGP, setClaveDGP] = useState(isRegister ? '' : PRELOADED.claveDGP)

  const disabled = isView

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate({ page: 'dashboard' })} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate({ page: 'programas-list' })} className="hover:text-[#009574] transition-colors">Programas Educativos</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar Programa' : isView ? 'Ver Programa' : 'Editar Programa'}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar Programa' : isView ? 'Ver Programa' : 'Editar Programa'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister ? 'Completa los campos para registrar un nuevo programa educativo.' :
             isView ? 'Información del programa educativo.' :
             'Modifica los datos del programa educativo.'}
          </p>
        </div>
        <ModeSwitcher
          mode={mode}
          navigate={navigate}
          registerPage={{ page: 'programa-form', mode: 'register' }}
          formPage={m => ({ page: 'programa-form', mode: m })}
        />
      </div>

      {/* Form */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8">
            <FieldLabel required={!isView}>Nombre del Programa</FieldLabel>
            <input value={nombre} onChange={e => setNombre(e.target.value)} disabled={disabled} className={inputCls(disabled, false)} placeholder="Nombre completo del programa" />
            <FieldHelp>Nombre oficial del programa educativo.</FieldHelp>
          </div>
          <div className="col-span-4">
            <FieldLabel required={!isView}>Clave</FieldLabel>
            <input value={clave} onChange={e => setClave(e.target.value)} disabled={disabled} className={inputCls(disabled, false)} placeholder="Ej. IDGS" />
            <FieldHelp>Identificador corto único.</FieldHelp>
          </div>
          <div className="col-span-6">
            <FieldLabel required={!isView}>División Académica</FieldLabel>
            <SearchSelect options={divisiones} value={division} onChange={setDivision} placeholder="Seleccionar división…" disabled={disabled} />
            <FieldHelp>División a la que pertenece el programa.</FieldHelp>
          </div>
          <div className="col-span-6">
            <FieldLabel>Clave DGP</FieldLabel>
            <input value={claveDGP} onChange={e => setClaveDGP(e.target.value)} disabled={disabled} className={inputCls(disabled, false)} placeholder="Ej. 220740067" />
            <FieldHelp>Clave asignada por la Dirección General de Profesiones.</FieldHelp>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {isView ? (
          <>
            <button onClick={() => navigate({ page: 'programas-list' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <ArrowLeft size={14} />Regresar
            </button>
            <button onClick={() => navigate({ page: 'programa-form', mode: 'edit' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Pencil size={14} />Editar
            </button>
          </>
        ) : isRegister ? (
          <>
            <button onClick={() => navigate({ page: 'programas-list' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <X size={14} />Cancelar
            </button>
            <button onClick={() => navigate({ page: 'programas-list', pendingToast: 'Programa registrado exitosamente.' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Save size={14} />Registrar Programa
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate({ page: 'programas-list' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <X size={14} />Cancelar
            </button>
            <button onClick={() => navigate({ page: 'programas-list', pendingToast: 'Programa actualizado exitosamente.' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Save size={14} />Guardar Cambios
            </button>
          </>
        )}
      </div>
    </div>
  )
}
