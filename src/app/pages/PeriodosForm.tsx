import { useState } from 'react'
import { ChevronRight, Pencil, Save, X, ArrowLeft } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, ModeSwitcher, DatePicker, SimpleSelect } from '../shared/ui'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'

const PRELOADED = {
  nombre: 'Enero – Abril 2026',
  inicio: '06/01/2026',
  fin: '25/04/2026',
  tipo: 'Cuatrimestral',
}

const tipos = ['Cuatrimestral', 'Semestral', 'Anual', 'Intensivo']

export default function PeriodosForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  const [nombre, setNombre] = useState(isRegister ? '' : PRELOADED.nombre)
  const [inicio, setInicio] = useState(isRegister ? '' : PRELOADED.inicio)
  const [fin, setFin] = useState(isRegister ? '' : PRELOADED.fin)
  const [tipo, setTipo] = useState(isRegister ? '' : PRELOADED.tipo)

  const disabled = isView

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/periodos')} className="hover:text-[#009574] transition-colors">Periodos Académicos</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar Periodo' : isView ? 'Ver Periodo' : 'Editar Periodo'}
        </span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar Periodo' : isView ? 'Ver Periodo' : 'Editar Periodo'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister ? 'Completa los campos para registrar un nuevo periodo académico.' :
             isView ? 'Información del periodo académico.' :
             'Modifica los datos del periodo académico.'}
          </p>
        </div>
        <ModeSwitcher
          mode={mode}
          registerUrl="/periodos/new"
          formUrl={m => `/periodos/form?mode=${m}&id=${id}`}
        />
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <FieldLabel required={!isView}>Nombre del Periodo</FieldLabel>
            <input value={nombre} onChange={e => setNombre(e.target.value)} disabled={disabled} className={inputCls(disabled, false)} placeholder="Ej. Enero – Abril 2026" />
            <FieldHelp>Nombre descriptivo del periodo académico.</FieldHelp>
          </div>
          <div className="col-span-4">
            <FieldLabel required={!isView}>Fecha de Inicio</FieldLabel>
            <DatePicker value={inicio} onChange={setInicio} disabled={disabled} placeholder="dd/MM/yyyy" />
          </div>
          <div className="col-span-4">
            <FieldLabel required={!isView}>Fecha de Fin</FieldLabel>
            <DatePicker value={fin} onChange={setFin} disabled={disabled} placeholder="dd/MM/yyyy" />
          </div>
          <div className="col-span-4">
            <FieldLabel required={!isView}>Tipo de Periodo</FieldLabel>
            <SimpleSelect options={tipos} value={tipo} onChange={setTipo} placeholder="Seleccionar tipo…" disabled={disabled} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {isView ? (
          <>
            <button onClick={() => navigate('/periodos')} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <ArrowLeft size={14} />Regresar
            </button>
            <button onClick={() => navigate(`/periodos/form?mode=edit&id=${id}`)} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Pencil size={14} />Editar
            </button>
          </>
        ) : isRegister ? (
          <>
            <button onClick={() => navigate('/periodos')} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <X size={14} />Cancelar
            </button>
            <button onClick={() => navigate('/periodos', { state: { toast: 'Periodo registrado exitosamente.' } })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Save size={14} />Registrar Periodo
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/periodos')} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <X size={14} />Cancelar
            </button>
            <button onClick={() => navigate('/periodos', { state: { toast: 'Periodo actualizado exitosamente.' } })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Save size={14} />Guardar Cambios
            </button>
          </>
        )}
      </div>
    </div>
  )
}
