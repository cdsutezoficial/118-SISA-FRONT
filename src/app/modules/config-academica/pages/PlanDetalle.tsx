import { useCallback, useEffect, useState } from 'react'
import {
  Pencil, Layers, BookMarked, Hash, Plus, Trash2,
  GraduationCap, ChevronDown, ChevronUp, ClipboardList,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { usePendingToast } from '@app/core/infra/hooks'
import { ActionBtn, ModeSwitcher, Tabs, Toast } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, Button, MiniTable } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { apiDelete, apiGet } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

// `gradeScales` mirrors AcademicPlanResponse.gradeScales[] (GradeScaleResponse) —
// it travels embedded in GET /plans/{id}, no separate fetch needed.
interface GradeScaleEntry {
  id: string
  fromValue: number
  toValue: number
  letter: string
  description: string
  passed: boolean
}

interface GradeScaleDetail {
  id: string
  classificationId: string
  numericMin: number
  numericMax: number
  entries: GradeScaleEntry[]
}

interface ClassificationSummary {
  id: string
  name: string
  code: string
}

interface ClassificationsPageResponse {
  items: ClassificationSummary[]
}

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
  gradeScales: GradeScaleDetail[]
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
                <MiniTable
                  columns={[
                    { key: 'name', header: 'Materia' },
                    {
                      key: 'code', header: 'Clave', className: 'w-28',
                      render: s => (
                        <span className="inline-block font-mono text-[11px] bg-[#F8F9FA] border border-[#E5E7EB] px-1.5 py-0.5 rounded text-[#333333]">{s.code}</span>
                      ),
                    },
                    {
                      key: 'credits', header: 'Créditos', className: 'w-24 text-right',
                      render: s => (
                        <><span className="tabular-nums font-medium text-[#333333]">{s.credits}</span><span className="ml-1 text-[10px] text-[#6B7280] font-normal">cr.</span></>
                      ),
                    },
                    {
                      key: 'actions', header: '', className: 'w-20',
                      render: s => (
                        <div className="flex items-center justify-end gap-1">
                          <ActionBtn icon={<Pencil size={14} />} tooltip="Editar" onClick={() => goEdit(s.id)} disabled={deletingId === s.id} />
                          <ActionBtn icon={<Trash2 size={14} />} tooltip="Eliminar" danger onClick={() => handleDelete(s)} disabled={deletingId === s.id} />
                        </div>
                      ),
                    },
                  ]}
                  items={nivel.subjects}
                  keyFor={s => s.id}
                  footer={(
                    <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                      <span>Subtotal del nivel</span>
                      <span className="text-[12px] font-bold text-[#333333] tabular-nums">
                        {creditosNivel}<span className="ml-1 text-[10px] text-[#6B7280] font-normal">cr.</span>
                      </span>
                    </div>
                  )}
                />
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
          <div className="border-t border-[#E5E7EB] px-3 py-2">
            <Button variant="ghost" size="sm" onClick={goRegister}>
              <Plus size={14} />Registrar Materia
            </Button>
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
  // `tab` query param lets PlanEscalaForm land back on the Escalas tab after
  // register/edit — falls back to 'niveles' (the default) otherwise.
  const [activeTab, setActiveTab] = useState<TabKey>(searchParams.get('tab') === 'escalas' ? 'escalas' : 'niveles')

  const [plan, setPlan] = useState<AcademicPlanDetail | null>(null)
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [classifications, setClassifications] = useState<ClassificationSummary[]>([])
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [deletingScaleId, setDeletingScaleId] = useState<string | null>(null)

  // Program catalog for the header label — same pattern as PlanesList.programLabel().
  useEffect(() => {
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items))
      .catch(() => {/* non-critical — programLabel() falls back to '—' */})
  }, [])

  // Classification catalog to resolve gradeScales[].classificationId labels —
  // same pattern as the programs fetch above.
  useEffect(() => {
    apiGet<ClassificationsPageResponse>('/subject-classifications', { size: 100 })
      .then(data => setClassifications(data.items))
      .catch(() => {/* non-critical — classificationLabel() falls back to '—' */})
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

  function classificationLabel(classificationId: string): string {
    const c = classifications.find(c => c.id === classificationId)
    return c ? `${c.code} — ${c.name}` : '—'
  }

  async function handleDeleteScale(scale: GradeScaleDetail) {
    if (!plan) return
    if (!window.confirm(`¿Eliminar la escala de calificación "${classificationLabel(scale.classificationId)}"? Esta acción no se puede deshacer.`)) return
    setDeletingScaleId(scale.id)
    try {
      await apiDelete(`/plans/${plan.id}/grade-scales/${scale.id}`)
      loadPlan({ silent: true })
    } catch {
      window.alert('No se pudo eliminar la escala de calificación. Intenta de nuevo más tarde.')
    } finally {
      setDeletingScaleId(null)
    }
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
    <FormPage>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Planes de Estudio', to: '/planes' },
          { label: 'Detalle del Plan' },
        ]}
      />

      <FormHeader
        title={plan ? `Plan de Estudios — ${plan.version}` : 'Plan de Estudios'}
        subtitle="Visualiza la estructura completa del plan, sus niveles y materias asignadas."
        right={
          <ModeSwitcher
            mode="view"
            id={id}
            registerUrl="/planes/new"
            formUrl={m => m === 'view' ? `/planes/detalle?id=${id}` : `/planes/form?mode=edit&id=${id}`}
          />
        }
      />

      {/* Load error banner */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {loadStatus === 'loading' ? (
        <FormCard loading loadingLabel="Cargando plan de estudios..." />
      ) : plan ? (
        <>
          <FormCard>
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
          </FormCard>

          {/* Tabs */}
          <Tabs
            tabs={[
              { key: 'niveles' as TabKey, label: 'Niveles y Materias', icon: <Layers size={14} /> },
              { key: 'escalas' as TabKey, label: 'Escalas de Calificación', icon: <ClipboardList size={14} /> },
            ]}
            active={activeTab}
            onSelect={k => setActiveTab(k as TabKey)}
          />

          {activeTab === 'niveles' && (
            <div className="mb-6">
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

          {activeTab === 'escalas' && (
            <div className="mb-6">
              {plan.gradeScales.length === 0 ? (
                <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-12 text-center">
                  <p className="text-[13px] text-[#6B7280] mb-4">Este plan todavía no tiene escalas de calificación registradas.</p>
                  <Button onClick={() => navigate(`/planes/escala/form?planId=${plan.id}`)}>
                    <Plus size={14} />Agregar Escala
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex justify-end mb-3">
                    <Button onClick={() => navigate(`/planes/escala/form?planId=${plan.id}`)}>
                      <Plus size={14} />Agregar Escala
                    </Button>
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
                    <MiniTable
                      columns={[
                        { key: 'classification', header: 'Clasificación', render: scale => <span className="font-medium text-[#333333]">{classificationLabel(scale.classificationId)}</span> },
                        {
                          key: 'range', header: 'Rango Numérico', className: 'w-40 tabular-nums',
                          render: scale => <span className="text-[#333333]">{scale.numericMin.toFixed(1)}–{scale.numericMax.toFixed(1)}</span>,
                        },
                        {
                          key: 'entries', header: 'Rangos Configurados', className: 'w-40 tabular-nums',
                          render: scale => <span className="text-[#333333]">{scale.entries.length} rango{scale.entries.length !== 1 ? 's' : ''}</span>,
                        },
                        {
                          key: 'actions', header: '', className: 'w-24',
                          render: scale => (
                            <div className="flex items-center justify-end gap-1">
                              <ActionBtn
                                icon={<Pencil size={14} />} tooltip="Editar"
                                onClick={() => navigate(`/planes/escala/form?planId=${plan.id}&mode=edit&scaleId=${scale.id}`)}
                                disabled={deletingScaleId === scale.id}
                              />
                              <ActionBtn
                                icon={<Trash2 size={14} />} tooltip="Eliminar" danger
                                onClick={() => handleDeleteScale(scale)}
                                disabled={deletingScaleId === scale.id}
                              />
                            </div>
                          ),
                        },
                      ]}
                      items={plan.gradeScales}
                      keyFor={scale => scale.id}
                    />
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {plan.gradeScales.map(scale => (
                      <div key={scale.id} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
                        <p className="text-[13px] font-medium text-[#333333] mb-2 leading-snug">{classificationLabel(scale.classificationId)}</p>
                        <div className="flex items-center justify-between text-[12px] text-[#6B7280] mb-3">
                          <span className="tabular-nums">{scale.numericMin.toFixed(1)}–{scale.numericMax.toFixed(1)}</span>
                          <span className="tabular-nums">{scale.entries.length} rango{scale.entries.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
                          <Button variant="secondary" size="sm" className="flex-1"
                            onClick={() => navigate(`/planes/escala/form?planId=${plan.id}&mode=edit&scaleId=${scale.id}`)}
                            disabled={deletingScaleId === scale.id}
                          >
                            <Pencil size={13} />Editar
                          </Button>
                          <Button variant="danger" size="sm" className="flex-1"
                            onClick={() => handleDeleteScale(scale)}
                            disabled={deletingScaleId === scale.id}
                          >
                            <Trash2 size={13} />Eliminar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <FormActions
            isView
            onBack={() => navigate('/planes')}
            onPrimary={() => navigate(`/planes/form?mode=edit&id=${plan.id}`)}
            primaryLabel="Editar"
          />
        </>
      ) : null}
    </FormPage>
  )
}
