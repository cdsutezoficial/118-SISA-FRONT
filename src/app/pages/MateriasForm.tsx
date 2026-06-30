import { useState } from 'react'
import { ChevronRight, Pencil, Save, X, ArrowLeft } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, ModeSwitcher, SimpleSelect, Switch } from '../shared/ui'
import type { NavigateFn, FormMode } from '../shared/types'

interface Props { navigate: NavigateFn; mode: FormMode }

const PRELOADED = {
  nombre: 'Fundamentos de Programación',
  clave: 'FP-101',
  clasificacion: 'Básica',
  creditos: '6',
  hrsTeo: '3',
  hrsPrac: '2',
  lab: true,
  descripcion: 'Introducción a los conceptos fundamentales de la programación. Cubre estructuras de control, funciones, manejo de datos y pensamiento algorítmico mediante el lenguaje de programación Python.',
}

const clasificaciones = ['Básica', 'Ciencias Básicas', 'Especialidad', 'Lengua Extranjera', 'Matemáticas', 'Transversal']

export default function MateriasForm({ navigate, mode }: Props) {
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  const [nombre, setNombre] = useState(isRegister ? '' : PRELOADED.nombre)
  const [clave, setClave] = useState(isRegister ? '' : PRELOADED.clave)
  const [clasificacion, setClasificacion] = useState(isRegister ? '' : PRELOADED.clasificacion)
  const [creditos, setCreditos] = useState(isRegister ? '' : PRELOADED.creditos)
  const [hrsTeo, setHrsTeo] = useState(isRegister ? '' : PRELOADED.hrsTeo)
  const [hrsPrac, setHrsPrac] = useState(isRegister ? '' : PRELOADED.hrsPrac)
  const [lab, setLab] = useState(isRegister ? false : PRELOADED.lab)
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
        <button onClick={() => navigate({ page: 'materias-list' })} className="hover:text-[#009574] transition-colors">Materias</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar Materia' : isView ? 'Ver Materia' : 'Editar Materia'}
        </span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar Materia' : isView ? 'Ver Materia' : 'Editar Materia'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister ? 'Completa los campos para registrar una nueva materia.' :
             isView ? 'Información de la materia.' :
             'Modifica los datos de la materia.'}
          </p>
        </div>
        <ModeSwitcher
          mode={mode}
          navigate={navigate}
          registerPage={{ page: 'materia-form', mode: 'register' }}
          formPage={m => ({ page: 'materia-form', mode: m })}
        />
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8">
            <FieldLabel required={!isView}>Nombre de la Materia</FieldLabel>
            <input value={nombre} onChange={e => setNombre(e.target.value)} disabled={disabled} className={inputCls(disabled, false)} placeholder="Nombre completo de la materia" />
          </div>
          <div className="col-span-4">
            <FieldLabel required={!isView}>Clave</FieldLabel>
            <input value={clave} onChange={e => setClave(e.target.value)} disabled={disabled} className={inputCls(disabled, false)} placeholder="Ej. FP-101" />
          </div>
          <div className="col-span-4">
            <FieldLabel required={!isView}>Clasificación</FieldLabel>
            <SimpleSelect options={clasificaciones} value={clasificacion} onChange={setClasificacion} placeholder="Seleccionar…" disabled={disabled} />
          </div>
          <div className="col-span-2">
            <FieldLabel required={!isView}>Créditos</FieldLabel>
            <input type="number" value={creditos} onChange={e => setCreditos(e.target.value)} disabled={disabled} className={inputCls(disabled, false)} min={1} max={20} />
          </div>
          <div className="col-span-2">
            <FieldLabel required={!isView}>Hrs Teoría</FieldLabel>
            <input type="number" value={hrsTeo} onChange={e => setHrsTeo(e.target.value)} disabled={disabled} className={inputCls(disabled, false)} min={0} max={10} />
          </div>
          <div className="col-span-2">
            <FieldLabel required={!isView}>Hrs Práctica</FieldLabel>
            <input type="number" value={hrsPrac} onChange={e => setHrsPrac(e.target.value)} disabled={disabled} className={inputCls(disabled, false)} min={0} max={10} />
          </div>
          <div className="col-span-2">
            <FieldLabel>Requiere Lab.</FieldLabel>
            <div className="flex items-center gap-2 mt-2">
              <Switch checked={lab} onChange={setLab} disabled={disabled} />
              <span className="text-[12px] text-[#6B7280]">{lab ? 'Sí' : 'No'}</span>
            </div>
          </div>
          <div className="col-span-12">
            <FieldLabel>Descripción</FieldLabel>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} disabled={disabled} rows={4} className={inputCls(disabled, false) + ' resize-none'} placeholder="Descripción general de la materia, objetivos y contenido." />
            <FieldHelp>Descripción breve del contenido y objetivos de la materia.</FieldHelp>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {isView ? (
          <>
            <button onClick={() => navigate({ page: 'materias-list' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <ArrowLeft size={14} />Regresar
            </button>
            <button onClick={() => navigate({ page: 'materia-form', mode: 'edit' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Pencil size={14} />Editar
            </button>
          </>
        ) : isRegister ? (
          <>
            <button onClick={() => navigate({ page: 'materias-list' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <X size={14} />Cancelar
            </button>
            <button onClick={() => navigate({ page: 'materias-list', pendingToast: 'Materia registrada exitosamente.' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Save size={14} />Registrar Materia
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate({ page: 'materias-list' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <X size={14} />Cancelar
            </button>
            <button onClick={() => navigate({ page: 'materias-list', pendingToast: 'Materia actualizada exitosamente.' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Save size={14} />Guardar Cambios
            </button>
          </>
        )}
      </div>
    </div>
  )
}
