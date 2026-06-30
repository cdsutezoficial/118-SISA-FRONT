import { useState } from 'react'
import { ChevronRight, Pencil, Save, X, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, ModeSwitcher, SimpleSelect, SearchSelect, MiniDatePicker, ActionBtn } from '../shared/ui'
import type { NavigateFn, FormMode } from '../shared/types'

interface Props { navigate: NavigateFn; mode: FormMode }

interface TarifaRow {
  id: number
  programa: string
  nivel: string
  monto: string
  vigencia: string
}

const PRELOADED_TARIFAS: TarifaRow[] = [
  { id: 1, programa: 'IDGS', nivel: '1er – 3er Cuatrimestre', monto: '3200', vigencia: '01/01/2026' },
  { id: 2, programa: 'IDGS', nivel: '4to – 6to Cuatrimestre', monto: '3500', vigencia: '01/01/2026' },
  { id: 3, programa: 'TSU-TI', nivel: '1er – 3er Cuatrimestre', monto: '2800', vigencia: '01/01/2026' },
]

const PRELOADED = {
  nombre: 'Cuota Cuatrimestral',
  tipo: 'Recurrente',
}

const tipos = ['Recurrente', 'Una vez']
const programas = ['IDGS', 'TSU-TI', 'LAE', 'II']

const nivelesByPrograma: Record<string, string[]> = {
  IDGS: ['1er – 3er Cuatrimestre', '4to – 6to Cuatrimestre', '7mo – 11vo Cuatrimestre'],
  'TSU-TI': ['1er – 3er Cuatrimestre'],
  LAE: ['1er – 4to Semestre', '5to – 8vo Semestre'],
  II: ['1er – 4to Cuatrimestre'],
}

let nextId = 10

export default function ConceptosForm({ navigate, mode }: Props) {
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  const [nombre, setNombre] = useState(isRegister ? '' : PRELOADED.nombre)
  const [tipo, setTipo] = useState(isRegister ? '' : PRELOADED.tipo)
  const [tarifas, setTarifas] = useState<TarifaRow[]>(isRegister ? [] : PRELOADED_TARIFAS)

  const disabled = isView

  function addTarifa() {
    setTarifas(prev => [...prev, { id: nextId++, programa: '', nivel: '', monto: '', vigencia: '' }])
  }
  function removeTarifa(id: number) {
    setTarifas(prev => prev.filter(t => t.id !== id))
  }
  function updateTarifa(id: number, field: keyof TarifaRow, value: string) {
    setTarifas(prev => prev.map(t => {
      if (t.id !== id) return t
      if (field === 'programa') return { ...t, programa: value, nivel: '' }
      return { ...t, [field]: value }
    }))
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate({ page: 'dashboard' })} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate({ page: 'conceptos-list' })} className="hover:text-[#009574] transition-colors">Conceptos de Pago</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar Concepto' : isView ? 'Ver Concepto' : 'Editar Concepto'}
        </span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar Concepto de Pago' : isView ? 'Ver Concepto de Pago' : 'Editar Concepto de Pago'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister ? 'Define el concepto y agrega las tarifas por programa y nivel.' :
             isView ? 'Información del concepto de pago.' :
             'Modifica los datos del concepto y sus tarifas.'}
          </p>
        </div>
        <ModeSwitcher
          mode={mode}
          navigate={navigate}
          registerPage={{ page: 'concepto-form', mode: 'register' }}
          formPage={m => ({ page: 'concepto-form', mode: m })}
        />
      </div>

      {/* Section 1: Basic info */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-4">
        <h2 className="text-[13px] font-semibold text-[#333333] mb-4">Información del Concepto</h2>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8">
            <FieldLabel required={!isView}>Nombre del Concepto</FieldLabel>
            <input value={nombre} onChange={e => setNombre(e.target.value)} disabled={disabled} className={inputCls(disabled, false)} placeholder="Ej. Cuota Cuatrimestral" />
            <FieldHelp>Nombre descriptivo del concepto de pago.</FieldHelp>
          </div>
          <div className="col-span-4">
            <FieldLabel required={!isView}>Tipo</FieldLabel>
            <SimpleSelect options={tipos} value={tipo} onChange={setTipo} placeholder="Seleccionar tipo…" disabled={disabled} />
            <FieldHelp>Recurrente: aplica cada periodo. Una vez: pago único.</FieldHelp>
          </div>
        </div>
      </div>

      {/* Section 2: Tarifas */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[13px] font-semibold text-[#333333]">Tarifas</h2>
            <p className="text-[12px] text-[#6B7280]">Define los montos por programa y nivel académico.</p>
          </div>
          {!isView && (
            <button onClick={addTarifa} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border border-[#009574] text-[#009574] rounded-md hover:bg-[#e6f5f1] transition-colors">
              <Plus size={13} />Agregar tarifa
            </button>
          )}
        </div>

        {tarifas.length === 0 ? (
          <div className="text-center py-8 text-[13px] text-[#6B7280]">
            {isView ? 'Sin tarifas registradas.' : 'Agrega al menos una tarifa para continuar.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase">Programa</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase">Nivel</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase w-32">Monto (MXN)</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase w-32">Vigencia desde</th>
                  {!isView && <th className="px-3 py-2 w-10" />}
                </tr>
              </thead>
              <tbody>
                {tarifas.map(t => {
                  const nivelesOpts = t.programa ? (nivelesByPrograma[t.programa] ?? []) : []
                  return (
                    <tr key={t.id} className="border-b border-[#E5E7EB] last:border-0">
                      <td className="px-3 py-2">
                        <SearchSelect options={programas} value={t.programa} onChange={v => updateTarifa(t.id, 'programa', v)} placeholder="Programa…" disabled={isView} />
                      </td>
                      <td className="px-3 py-2">
                        <SimpleSelect options={nivelesOpts} value={t.nivel} onChange={v => updateTarifa(t.id, 'nivel', v)} placeholder="Nivel…" disabled={isView || !t.programa} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] text-[12px]">$</span>
                          <input
                            type="number"
                            value={t.monto}
                            onChange={e => updateTarifa(t.id, 'monto', e.target.value)}
                            disabled={isView}
                            className={`${inputCls(isView, false)} pl-6`}
                            placeholder="0.00"
                            min={0}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <MiniDatePicker value={t.vigencia} onChange={v => updateTarifa(t.id, 'vigencia', v)} disabled={isView} />
                      </td>
                      {!isView && (
                        <td className="px-3 py-2">
                          <ActionBtn icon={<Trash2 size={14} />} tooltip="Eliminar tarifa" danger onClick={() => removeTarifa(t.id)} />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        {isView ? (
          <>
            <button onClick={() => navigate({ page: 'conceptos-list' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <ArrowLeft size={14} />Regresar
            </button>
            <button onClick={() => navigate({ page: 'concepto-form', mode: 'edit' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Pencil size={14} />Editar
            </button>
          </>
        ) : isRegister ? (
          <>
            <button onClick={() => navigate({ page: 'conceptos-list' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <X size={14} />Cancelar
            </button>
            <button onClick={() => navigate({ page: 'conceptos-list', pendingToast: 'Concepto de pago registrado exitosamente.' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Save size={14} />Registrar Concepto
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate({ page: 'conceptos-list' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
              <X size={14} />Cancelar
            </button>
            <button onClick={() => navigate({ page: 'conceptos-list', pendingToast: 'Concepto actualizado exitosamente.' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
              <Save size={14} />Guardar Cambios
            </button>
          </>
        )}
      </div>
    </div>
  )
}
