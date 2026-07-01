import { useState } from 'react'
import { ChevronRight, Pencil, Save, X, ArrowLeft } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, ModeSwitcher, SearchSelect, SimpleSelect } from '../shared/ui'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'

const PRELOADED = {
  periodo: 'ENE-ABR-2026',
  programa: 'IDGS',
  nivel: '1er Cuatrimestre TSU',
  sufijo: 'A',
  capacidad: '30',
}

const periodos = ['ENE-ABR-2026', 'AGO-DIC-2025', 'MAY-AGO-2025']
const programas = ['IDGS', 'TSU-TI', 'LAE', 'II']

const nivelesByPrograma: Record<string, string[]> = {
  IDGS: ['1er Cuatrimestre TSU', '2do Cuatrimestre TSU', '3er Cuatrimestre TSU', '4to Cuatrimestre TSU', '5to Cuatrimestre TSU', '6to Cuatrimestre TSU', '7mo Cuatrimestre Ing.'],
  'TSU-TI': ['1er Cuatrimestre', '2do Cuatrimestre', '3er Cuatrimestre'],
  LAE: ['1er Semestre', '2do Semestre', '3er Semestre'],
  II: ['1er Cuatrimestre', '2do Cuatrimestre'],
}

export default function GruposForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  const [periodo, setPeriodo] = useState(isRegister ? '' : PRELOADED.periodo)
  const [programa, setPrograma] = useState(isRegister ? '' : PRELOADED.programa)
  const [nivel, setNivel] = useState(isRegister ? '' : PRELOADED.nivel)
  const [sufijo, setSufijo] = useState(isRegister ? '' : PRELOADED.sufijo)
  const [capacidad, setCapacidad] = useState(isRegister ? '' : PRELOADED.capacidad)

  const disabled = isView
  const nivelesOpts = programa ? (nivelesByPrograma[programa] ?? []) : []

  const clavePreview = periodo && programa && nivel && sufijo
    ? `${programa}-${nivel.match(/\d+/)?.[0] ?? '?'}01-${sufijo}`
    : '—'

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/grupos')} className="hover:text-[#009574] transition-colors">Grupos</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar Grupo' : isView ? 'Ver Grupo' : 'Editar Grupo'}
        </span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar Grupo' : isView ? 'Ver Grupo' : 'Editar Grupo'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister ? 'Completa los campos para registrar un nuevo grupo académico.' :
             isView ? 'Información del grupo académico.' :
             'Modifica los datos del grupo académico.'}
          </p>
        </div>
        <ModeSwitcher
          mode={mode}
          registerUrl="/grupos/new"
          formUrl={m => `/grupos/form?mode=${m}&id=${id}`}
        />
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-6">
            <FieldLabel required={!isView}>Periodo</FieldLabel>
            <SearchSelect options={periodos} value={periodo} onChange={setPeriodo} placeholder="Seleccionar periodo…" disabled={disabled} />
            <FieldHelp>Periodo académico al que pertenece el grupo.</FieldHelp>
          </div>
          <div className="col-span-6">
            <FieldLabel required={!isView}>Programa</FieldLabel>
            <SearchSelect options={programas} value={programa} onChange={v => { setPrograma(v); setNivel('') }} placeholder="Seleccionar programa…" disabled={disabled} />
            <FieldHelp>Programa educativo del grupo.</FieldHelp>
          </div>
          <div className="col-span-6">
            <FieldLabel required={!isView}>Nivel / Cuatrimestre</FieldLabel>
            <SimpleSelect options={nivelesOpts} value={nivel} onChange={setNivel} placeholder="Seleccionar nivel…" disabled={disabled || !programa} />
            <FieldHelp>Nivel académico del grupo (dependiente del programa).</FieldHelp>
          </div>
          <div className="col-span-3">
            <FieldLabel required={!isView}>Sufijo de Grupo</FieldLabel>
            <input value={sufijo} onChange={e => setSufijo(e.target.value.toUpperCase())} disabled={disabled} className={inputCls(disabled, false)} placeholder="Ej. A" maxLength={3} />
            <FieldHelp>Letra diferenciadora del grupo.</FieldHelp>
          </div>
          <div className="col-span-3">
            <FieldLabel required={!isView}>Capacidad</FieldLabel>
            <input type="number" value={capacidad} onChange={e => setCapacidad(e.target.value)} disabled={disabled} className={inputCls(disabled, false)} placeholder="30" min={1} max={60} />
            <FieldHelp>Máximo de estudiantes.</FieldHelp>
          </div>

          {/* Preview */}
          {!isView && (
            <div className="col-span-12">
              <div className="p-3 bg-[#e6f5f1] rounded-lg flex items-center gap-3">
                <span className="text-[12px] text-[#6B7280]">Clave generada:</span>
                <span className="font-mono font-semibold text-[14px] text-[#009574]">{clavePreview}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {isView ? (
          <>
            <button onClick={() => navigate('/grupos')} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <ArrowLeft size={14} />Regresar
            </button>
            <button onClick={() => navigate(`/grupos/form?mode=edit&id=${id}`)} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Pencil size={14} />Editar
            </button>
          </>
        ) : isRegister ? (
          <>
            <button onClick={() => navigate('/grupos')} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <X size={14} />Cancelar
            </button>
            <button onClick={() => navigate('/grupos', { state: { toast: 'Grupo registrado exitosamente.' } })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Save size={14} />Registrar Grupo
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/grupos')} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <X size={14} />Cancelar
            </button>
            <button onClick={() => navigate('/grupos', { state: { toast: 'Grupo actualizado exitosamente.' } })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Save size={14} />Guardar Cambios
            </button>
          </>
        )}
      </div>
    </div>
  )
}
