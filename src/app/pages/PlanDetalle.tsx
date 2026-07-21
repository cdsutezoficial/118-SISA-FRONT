import { useCallback, useEffect, useState } from 'react'
import {
  ChevronRight, Pencil, Layers, BookMarked, Hash, Plus, Trash2,
  GraduationCap, ChevronDown, ChevronUp, ArrowLeft, ClipboardList, AlertCircle, Loader2,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { usePendingToast } from '../shared/hooks'
import { ActionBtn, Toast } from '../shared/ui'
import { apiDelete, apiGet } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TabKey = 'niveles' | 'escalas'
type PlanLevelType = 'REGULAR' | 'INTERNSHIP'
type PlanStatus = 'ACTIVE' | 'INACTIVE'

const LEVEL_TYPE_LABELS: Record<PlanLevelType, string> = {
  REGULAR: 'Clases regulares',
  INTERNSHIP: 'Estadías',
}

const LEVEL_TYPE_STYLE: Record<PlanLevelType, string> = {
  REGULAR: 'bg-blue-50 text-blue-700 border border-blue-200',
  INTERNSHIP: 'bg-amber-50 text-amber-700 border border-amber-200',
}

interface ProgramSummary {
  id: string
  name: string
  code: string
}

interface ProgramsPageResponse {
  items: ProgramSummary[]
}

// `subjects` mirrors AcademicPlanResponse.levels[].subjects[] (SubjectResponse).
interface SubjectDetail {
  id: string
  code: string
  name: string
  credits: number
  weeklyHours: number
  evaluationUnits: number
  displayOrder: number
  type: 'CORE' | 'ELECTIVE' | 'INTERNSHIP'
  isRetakeable: boolean
  classificationId: string
}

interface PlanLevelDetail {
  id: string
  levelNumber: number
  type: PlanLevelType
  description: string | null
  subjects: SubjectDetail[]
}

interface AcademicPlanDetail {
  id: string
  programId: string
  version: string
  validityPeriod: string
  titulationKey: string
  effectiveFrom: string
  totalLevels: number
  minPassingGrade: number
  maxExtraordinaryExamsPerPeriod: number
  requiresSocialService: boolean
  socialServiceMinLevelId: string | null
  status: PlanStatus
  levels: PlanLevelDetail[]
}

function formatDate(iso: string): string {
  // Date-only ISO strings parse as UTC midnight; build a local date to avoid
  // showing the previous day in timezones west of UTC.
  const [y, m, d] = iso.split('-').map(Number)
  const date = y && m && d ? new Date(y, m - 1, d) : new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Nivel row (expandable) ─────────────────────────────────────────────────────

function NivelRow({ nivel, index, defaultOpen, planId, onChanged }: {
  nivel: PlanLevelDetail
  index: number
  defaultOpen?: boolean
  planId: string
  onChanged: () => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const creditosNivel = nivel.subjects.reduce((a, s) => a + s.credits, 0)

  function goRegister() {
    navigate(`/planes/materia/form?planId=${planId}&levelId=${nivel.id}`)
  }

  function goEdit(subjectId: string) {
    navigate(`/planes/materia/form?planId=${planId}&levelId=${nivel.id}&mode=edit&subjectId=${subjectId}`)
  }

  async function handleDelete(subject: SubjectDetail) {
    if (!window.confirm(`¿Eliminar la materia "${subject.name}" de este nivel? Esta acción no se puede deshacer.`)) return
    setDeletingId(subject.id)
    try {
      await apiDelete(`/plans/${planId}/levels/${nivel.id}/subjects/${subject.id}`)
      onChanged()
    } catch {
      window.alert('No se pudo eliminar la materia. Intenta de nuevo más tarde.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${open ? 'bg-[#e6f5f1]' : 'bg-white hover:bg-[#F8F9FA]'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${nivel.type === 'INTERNSHIP' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {index + 1}
          </div>
          <div className="text-left">
            <p className={`text-[13px] font-semibold ${open ? 'text-[#009574]' : 'text-[#333333]'}`}>
              Nivel {nivel.levelNumber}{nivel.description ? ` — ${nivel.description}` : ''}
            </p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">
              {nivel.subjects.length} materia{nivel.subjects.length !== 1 ? 's' : ''}
              <span className="mx-1.5 text-[#E5E7EB]">·</span>
              {creditosNivel} créditos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${LEVEL_TYPE_STYLE[nivel.type]}`}>
            {LEVEL_TYPE_LABELS[nivel.type]}
          </span>
          {open ? <ChevronUp size={15} className="text-[#009574]" /> : <ChevronDown size={15} className="text-[#6B7280]" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-[#E5E7EB]">
          {nivel.subjects.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-[12px] text-[#6B7280]">Sin materias asignadas.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-[#F8F9FA] border-b border-[#E5E7EB]">
                      <th className="text-left px-5 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Materia</th>
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Clave</th>
                      <th className="text-right px-5 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Créditos</th>
                      <th className="px-3 py-2 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {nivel.subjects.map(s => (
                      <tr key={s.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-5 py-2.5 font-medium text-[#333333]">{s.name}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-[11px] bg-[#F8F9FA] border border-[#E5E7EB] px-1.5 py-0.5 rounded text-[#333333]">{s.code}</span>
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums font-medium text-[#333333]">
                          {s.credits}<span className="ml-1 text-[10px] text-[#6B7280] font-normal">cr.</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <ActionBtn icon={<Pencil size={14} />} tooltip="Editar" onClick={() => goEdit(s.id)} disabled={deletingId === s.id} />
                            <ActionBtn icon={<Trash2 size={14} />} tooltip="Eliminar" danger onClick={() => handleDelete(s)} disabled={deletingId === s.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#F8F9FA] border-t border-[#E5E7EB]">
                      <td colSpan={2} className="px-5 py-2 text-[11px] text-[#6B7280]">Subtotal del nivel</td>
                      <td className="px-5 py-2 text-right text-[12px] font-bold text-[#333333] tabular-nums">
                        {creditosNivel}<span className="ml-1 text-[10px] text-[#6B7280] font-normal">cr.</span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[#E5E7EB]">
                {nivel.subjects.map(s => (
                  <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-medium text-[#333333]">{s.name}</p>
                      <span className="font-mono text-[10px] bg-[#F8F9FA] border border-[#E5E7EB] px-1.5 py-0.5 rounded text-[#333333]">{s.code}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[12px] font-semibold text-[#333333] tabular-nums">{s.credits} cr.</span>
                      <div className="flex items-center gap-0.5">
                        <ActionBtn icon={<Pencil size={13} />} tooltip="Editar" onClick={() => goEdit(s.id)} disabled={deletingId === s.id} />
                        <ActionBtn icon={<Trash2 size={13} />} tooltip="Eliminar" danger onClick={() => handleDelete(s)} disabled={deletingId === s.id} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="border-t border-[#E5E7EB] px-5 py-2.5">
            <button
              type="button"
              onClick={goRegister}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-[#009574] hover:text-[#007a5e] transition-colors"
            >
              <Plus size={14} />Registrar Materia
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PlanDetalle() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id')
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [activeTab, setActiveTab] = useState<TabKey>('niveles')

  const [plan, setPlan] = useState<AcademicPlanDetail | null>(null)
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')

  // Program catalog for the header label — same pattern as PlanesList.programLabel().
  useEffect(() => {
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items))
      .catch(() => {/* non-critical — programLabel() falls back to '—' */})
  }, [])

  // GET /plans/{id} is the only endpoint returning the full levels[].subjects[] tree.
  // Extracted as a callback (not just an effect body) so NivelRow can trigger a
  // refetch after add/edit/delete — refetching the whole tree is simpler and
  // more consistent with the rest of this screen than mutating local state.
  const loadPlan = useCallback((opts?: { silent?: boolean }) => {
    if (!id) {
      setLoadStatus('error')
      setLoadErrorMsg('No se especificó un plan de estudios a consultar.')
      return () => {}
    }
    let cancelled = false
    if (!opts?.silent) setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<AcademicPlanDetail>(`/plans/${id}`)
      .then(data => {
        if (cancelled) return
        setPlan(data)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró el plan de estudios solicitado.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar este plan de estudios.')
        } else {
          setLoadErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    return loadPlan()
  }, [id, loadPlan])

  function programLabel(programId: string): string {
    const p = programs.find(p => p.id === programId)
    return p ? `${p.code} — ${p.name}` : '—'
  }

  function levelLabel(levelId: string): string {
    const l = plan?.levels.find(l => l.id === levelId)
    if (!l) return '—'
    return `Nivel ${l.levelNumber}${l.description ? ` — ${l.description}` : ''}`
  }

  const levels = plan ? plan.levels.slice().sort((a, b) => a.levelNumber - b.levelNumber) : []
  const totalMaterias = levels.reduce((acc, n) => acc + n.subjects.length, 0)
  const totalCreditos = levels.reduce((acc, n) => acc + n.subjects.reduce((a, s) => a + s.credits, 0), 0)
  const regularLevels = levels.filter(n => n.type === 'REGULAR')
  const internshipLevels = levels.filter(n => n.type === 'INTERNSHIP')

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/planes')} className="hover:text-[#009574] transition-colors">Planes de Estudio</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Detalle del Plan</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">
          {plan ? `Plan de Estudios — ${plan.version}` : 'Plan de Estudios'}
        </h1>
        <p className="text-[14px] text-[#6B7280] mt-1">Visualiza la estructura completa del plan, sus niveles y materias asignadas.</p>
      </div>

      {/* Load error banner */}
      {loadStatus === 'error' && loadErrorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {loadErrorMsg}
        </div>
      )}

      {loadStatus === 'loading' ? (
        <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
          <div className="flex flex-col items-center gap-3 text-[#6B7280]">
            <Loader2 size={24} className="animate-spin text-[#009574]" />
            <p className="text-[13px] font-medium">Cargando plan de estudios...</p>
          </div>
        </div>
      ) : plan ? (
        <>
          {/* Summary card */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Programa</p>
                <p className="text-[13px] font-medium text-[#333333]">{programLabel(plan.programId)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Versión</p>
                <span className="font-mono text-[13px] font-semibold bg-[#F8F9FA] border border-[#E5E7EB] px-2 py-0.5 rounded text-[#333333]">{plan.version}</span>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Clave de Titulación</p>
                <p className="text-[13px] font-medium text-[#333333]">{plan.titulationKey}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
                {plan.status === 'ACTIVE' ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactivo
                  </span>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Periodo de Vigencia</p>
                <p className="text-[13px] font-medium text-[#333333]">{plan.validityPeriod}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Vigente Desde</p>
                <p className="text-[13px] font-medium text-[#333333] tabular-nums">{formatDate(plan.effectiveFrom)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Calificación Mínima Aprobatoria</p>
                <p className="text-[13px] font-medium text-[#333333] tabular-nums">{plan.minPassingGrade.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Extraordinarios Máx. por Periodo</p>
                <p className="text-[13px] font-medium text-[#333333] tabular-nums">{plan.maxExtraordinaryExamsPerPeriod}</p>
              </div>
              <div className="col-span-2 md:col-span-4">
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Servicio Social</p>
                <p className="text-[13px] font-medium text-[#333333]">
                  {plan.requiresSocialService
                    ? `Requerido — nivel mínimo: ${plan.socialServiceMinLevelId ? levelLabel(plan.socialServiceMinLevelId) : 'sin definir'}`
                    : 'No requerido'}
                </p>
              </div>
            </div>

            <hr className="border-[#E5E7EB] my-4" />

            <div className="flex flex-wrap items-center gap-6 sm:gap-8">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-[#e6f5f1]"><Layers size={14} className="text-[#009574]" /></div>
                <div>
                  <p className="text-[20px] font-bold text-[#333333] leading-none">{levels.length}</p>
                  <p className="text-[11px] text-[#6B7280]">de {plan.totalLevels} niveles</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-[#e6f5f1]"><BookMarked size={14} className="text-[#009574]" /></div>
                <div>
                  <p className="text-[20px] font-bold text-[#333333] leading-none">{totalMaterias}</p>
                  <p className="text-[11px] text-[#6B7280]">materias</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-[#e6f5f1]"><Hash size={14} className="text-[#009574]" /></div>
                <div>
                  <p className="text-[20px] font-bold text-[#333333] leading-none">{totalCreditos}</p>
                  <p className="text-[11px] text-[#6B7280]">créditos totales</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-violet-50"><GraduationCap size={14} className="text-violet-600" /></div>
                <div>
                  <p className="text-[13px] font-semibold text-[#333333]">{regularLevels.length} regulares</p>
                  <p className="text-[11px] text-[#6B7280]">{internshipLevels.length} estadías</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[#E5E7EB] mb-6 overflow-x-auto">
            {([
              { key: 'niveles' as TabKey, label: 'Niveles y Materias', icon: <Layers size={14} /> },
              { key: 'escalas' as TabKey, label: 'Escalas de Calificación', icon: <ClipboardList size={14} /> },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'border-[#009574] text-[#009574]'
                    : 'border-transparent text-[#6B7280] hover:text-[#333333] hover:border-[#E5E7EB]'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'niveles' && (
            <div>
              {levels.length === 0 ? (
                <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-12 text-center">
                  <p className="text-[13px] text-[#6B7280]">Este plan todavía no tiene niveles registrados.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {levels.map((n, i) => (
                    <NivelRow
                      key={n.id}
                      nivel={n}
                      index={i}
                      defaultOpen={i === 0}
                      planId={plan.id}
                      onChanged={() => loadPlan({ silent: true })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Escalas de Calificación — blocked: GradeScale/GradeScaleEntry not implemented in
              118-SISA-BACK (see plan doc "Bloqueado / fases futuras"). No navigation to the
              unrelated mock /escalas module — it isn't wired to this plan's real data. */}
          {activeTab === 'escalas' && (
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-8 flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-[#F8F9FA]">
                <ClipboardList size={22} className="text-[#6B7280]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#333333] mb-1">Escalas de Calificación</p>
                <p className="text-[13px] text-[#6B7280] max-w-md">
                  Esta sección está pendiente de integración con backend: el modelo de escalas de calificación aún no está implementado en 118-SISA-BACK.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-8">
            <button
              onClick={() => navigate('/planes')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
            >
              <ArrowLeft size={14} />Regresar
            </button>
            <button
              onClick={() => navigate(`/planes/form?mode=edit&id=${plan.id}`)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
            >
              <Pencil size={14} />Editar Plan
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
