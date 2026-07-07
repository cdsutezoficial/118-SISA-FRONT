import { useState, useRef, useEffect } from 'react'
import {
  ChevronRight, Search, Eye, Pencil, ToggleLeft, KeyRound, LockKeyholeOpen,
  Plus, ChevronLeft, ChevronRight as ChevRight, X, ChevronDown,
  Clock, CheckCircle2, Info, Loader2, AlertCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { usePendingToast } from '../shared/hooks'
import { apiGet } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string }

/** Full 11-value backend `RoleType` enum (see `01-identidad.md`) — deliberately
 * broader than `RoleContext`'s `Role` union, which only covers the 5 roles
 * with an existing dashboard screen. An admin managing accounts needs to see
 * every role, including ones with no frontend concept yet (Docente,
 * Estudiante, Egresado, the estadías roles). Local to this screen only —
 * never merge into `auth.ts`'s `ROLE_MAP`/`mapRole`, which serves navigation
 * gating, a different concern. */
type BackendRoleType =
  | 'ADMIN'
  | 'SERVICIOS_ESCOLARES'
  | 'GESTOR_ACADEMICO'
  | 'DIRECTOR_DIVISION'
  | 'JEFATURA_ESTADIAS'
  | 'ASISTENTE_ESTADIAS'
  | 'COORDINACION_ESTADIAS_DIVISION'
  | 'PERSONAL_FINANZAS'
  | 'DOCENTE'
  | 'ESTUDIANTE'
  | 'EGRESADO'

type BackendUserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED'

interface UserRoleAssignment {
  roleType: BackendRoleType
  divisionId: string | null
}

interface UserListItem {
  userId: string
  personId: string
  fullName: string
  username: string
  roles: UserRoleAssignment[]
  status: BackendUserStatus
  lastLoginAt: string | null
}

interface UsersPageResponse {
  items: UserListItem[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

interface Usuario {
  id: string
  nombre: string
  usuario: string
  roles: BackendRoleType[]
  ultimoAcceso: string
  estado: 'Activo' | 'Inactivo' | 'Bloqueada'
  initials: string
  avatarColor: string
}

// ─── Role labels + badge styles (all 11 backend RoleType values) ──────────────

const ROLE_LABELS: Record<BackendRoleType, string> = {
  ADMIN: 'Administrador',
  SERVICIOS_ESCOLARES: 'Servicios Escolares',
  GESTOR_ACADEMICO: 'Gestor Académico',
  DIRECTOR_DIVISION: 'Director de División',
  JEFATURA_ESTADIAS: 'Jefatura de Estadías',
  ASISTENTE_ESTADIAS: 'Asistente de Estadías',
  COORDINACION_ESTADIAS_DIVISION: 'Coordinación de Estadías de División',
  PERSONAL_FINANZAS: 'Finanzas',
  DOCENTE: 'Docente',
  ESTUDIANTE: 'Estudiante',
  EGRESADO: 'Egresado',
}

const ROLE_BADGE_STYLE: Record<BackendRoleType, string> = {
  ADMIN: 'bg-[#e6f5f1] text-[#009574] border border-[#009574]/30',
  SERVICIOS_ESCOLARES: 'bg-blue-50 text-blue-700 border border-blue-200',
  GESTOR_ACADEMICO: 'bg-teal-50 text-teal-700 border border-teal-200',
  DIRECTOR_DIVISION: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  JEFATURA_ESTADIAS: 'bg-purple-50 text-purple-700 border border-purple-200',
  ASISTENTE_ESTADIAS: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200',
  COORDINACION_ESTADIAS_DIVISION: 'bg-pink-50 text-pink-700 border border-pink-200',
  PERSONAL_FINANZAS: 'bg-amber-50 text-amber-700 border border-amber-200',
  DOCENTE: 'bg-violet-50 text-violet-700 border border-violet-200',
  ESTUDIANTE: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  EGRESADO: 'bg-orange-50 text-orange-700 border border-orange-200',
}

const rolOptions: SelectOption[] = (Object.keys(ROLE_LABELS) as BackendRoleType[]).map(value => ({
  value,
  label: ROLE_LABELS[value],
}))

const estadoOptions: SelectOption[] = [
  { value: '',         label: 'Todos' },
  { value: 'ACTIVE',   label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'LOCKED',   label: 'Bloqueada' },
]

const ESTADO_LABEL: Record<BackendUserStatus, Usuario['estado']> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  LOCKED: 'Bloqueada',
}

// ─── Avatar helpers ─────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-[#e6f5f1] text-[#009574]',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
  'bg-cyan-100 text-cyan-700',
]

/** Deterministic per-name color so a row's avatar doesn't flicker between
 * refetches — backend has no color/avatar concept, this is purely cosmetic. */
function avatarColorFor(name: string): string {
  const sum = Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}

function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/** Simple relative-time formatting for `lastLoginAt`, mirroring the mock
 * copy's tone ('hace 2 horas'). Falls back to a locale date past 30 days,
 * and to 'Nunca' when the user has never logged in. */
function formatUltimoAcceso(iso: string | null): string {
  if (!iso) return 'Nunca'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Nunca'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'hace instantes'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `hace ${diffHrs} hora${diffHrs === 1 ? '' : 's'}`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 30) return `hace ${diffDays} día${diffDays === 1 ? '' : 's'}`
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

function mapUserToRow(item: UserListItem): Usuario {
  const roles = item.roles.map(r => r.roleType)
  return {
    id: item.userId,
    nombre: item.fullName,
    usuario: item.username,
    roles,
    ultimoAcceso: formatUltimoAcceso(item.lastLoginAt),
    estado: ESTADO_LABEL[item.status],
    initials: initialsFor(item.fullName),
    avatarColor: avatarColorFor(item.fullName),
  }
}

// ─── Confirm modal for unlock ─────────────────────────────────────────────────

function UnlockModal({ nombre, onConfirm, onCancel }: {
  nombre: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <LockKeyholeOpen size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#333333] mb-1">Desbloquear cuenta</h3>
            <p className="text-[13px] text-[#6B7280]">
              Estás a punto de desbloquear la cuenta de{' '}
              <strong className="text-[#333333]">{nombre}</strong>. El usuario podrá volver a iniciar sesión.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
            <LockKeyholeOpen size={13} />Desbloquear
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm modal for password reset ─────────────────────────────────────────

function ResetModal({ nombre, onConfirm, onCancel }: {
  nombre: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
            <KeyRound size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#333333] mb-1">Restablecer contraseña</h3>
            <p className="text-[13px] text-[#6B7280]">
              Se enviará un correo de restablecimiento a{' '}
              <strong className="text-[#333333]">{nombre}</strong> con instrucciones para crear una nueva contraseña.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 mb-6 text-[12px] text-amber-700">
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          La sesión activa del usuario será cerrada automáticamente.
        </div>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors">
            <KeyRound size={13} />Enviar correo
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed top-5 right-5 z-[100] flex items-center gap-3 bg-white border border-emerald-200 shadow-lg rounded-lg px-4 py-3">
      <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
      <span className="text-[13px] font-medium text-[#333333]">{message}</span>
      <button onClick={onClose} className="ml-1 text-[#6B7280] hover:text-[#333333] text-[16px] leading-none">×</button>
    </div>
  )
}

// ─── SearchSelect ──────────────────────────────────────────────────────────────

function SearchSelect({ options, value, onChange, placeholder }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void; placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])
  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
  const selected = options.find(o => o.value === value)
  return (
    <div ref={ref} className="relative w-52">
      <button type="button" onClick={() => { setOpen(!open); setQuery('') }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-left hover:border-[#009574]/50 focus:outline-none transition">
        <span className={`truncate ${selected ? 'text-[#333333]' : 'text-[#6B7280]'}`}>{selected?.label ?? placeholder}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onChange('') }} onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onChange(''))} className="text-[#6B7280] hover:text-[#333333] p-0.5 rounded"><X size={12} /></span>}
          <ChevronDown size={14} className={`text-[#6B7280] transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-[#E5E7EB]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar rol..."
                className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:border-[#009574]" />
            </div>
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-3 py-2 text-[12px] text-[#6B7280] text-center">Sin resultados</li>
              : filtered.map(o => (
                <li key={o.value}>
                  <button type="button" onClick={() => { onChange(o.value); setOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 transition-colors ${value === o.value ? 'bg-[#e6f5f1] text-[#009574] font-medium' : 'text-[#333333] hover:bg-[#F8F9FA]'}`}>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE_STYLE[o.value as BackendRoleType] ?? 'bg-gray-100 text-gray-600'}`}>{o.label}</span>
                  </button>
                </li>
              ))
            }
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── SimpleSelect ──────────────────────────────────────────────────────────────

function SimpleSelect({ options, value, onChange }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])
  const selected = options.find(o => o.value === value) ?? options[0]
  return (
    <div ref={ref} className="relative w-36">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-left hover:border-[#009574]/50 focus:outline-none transition">
        <span className="text-[#333333]">{selected.label}</span>
        <ChevronDown size={14} className={`text-[#6B7280] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 py-1">
          {options.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${value === o.value ? 'bg-[#e6f5f1] text-[#009574] font-medium' : 'text-[#333333] hover:bg-[#F8F9FA]'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Action btn with tooltip ───────────────────────────────────────────────────

function ActionBtn({ icon, tooltip, danger, accent, onClick }: {
  icon: React.ReactNode; tooltip: string; danger?: boolean; accent?: boolean; onClick?: () => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-flex">
      <button onClick={onClick} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className={`p-1.5 rounded-md transition-colors ${
          danger   ? 'text-[#6B7280] hover:bg-amber-50 hover:text-amber-600'
          : accent ? 'text-[#6B7280] hover:bg-[#e6f5f1] hover:text-[#009574]'
          :          'text-[#6B7280] hover:bg-[#e6f5f1] hover:text-[#009574]'
        }`}>
        {icon}
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#333333] text-white text-[11px] rounded whitespace-nowrap pointer-events-none z-50">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#333333]" />
        </div>
      )}
    </div>
  )
}

// ─── Roles cell ────────────────────────────────────────────────────────────────

function RolesCell({ roles }: { roles: BackendRoleType[] }) {
  const maxVisible = 2
  const visible = roles.slice(0, maxVisible)
  const extra = roles.length - maxVisible
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map(r => (
        <span key={r} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE_STYLE[r] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
          {ROLE_LABELS[r] ?? r}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
          +{extra} más
        </span>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function UsuariosList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [rolFilter, setRolFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [page, setPage] = useState(1)
  const [resetTarget, setResetTarget] = useState<Usuario | null>(null)
  const [unlockTarget, setUnlockTarget] = useState<Usuario | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(pendingToast ?? '')
  const perPage = 10

  // Debounce free-text search — the fetch effect below only reacts to
  // `debouncedSearch`, not every keystroke of `search`.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoadStatus('loading')
    setErrorMsg('')
    apiGet<UsersPageResponse>('/users', {
      role: rolFilter || undefined,
      status: estadoFilter || undefined,
      search: debouncedSearch || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        if (cancelled) return
        setUsuarios(data.items.map(mapUserToRow))
        setTotalElements(data.totalElements)
        setTotalPages(data.totalPages)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 401) {
          setErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setErrorMsg('No tienes permiso para consultar usuarios.')
        } else {
          setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
  }, [rolFilter, estadoFilter, debouncedSearch, page])

  const startRow   = totalElements === 0 ? 0 : (page - 1) * perPage + 1
  const endRow     = Math.min(page * perPage, totalElements)
  const hasFilters = !!rolFilter || !!estadoFilter || !!search

  function handleResetConfirm() {
    if (!resetTarget) return
    const nombre = resetTarget.nombre
    setResetTarget(null)
    setToast(`Correo de restablecimiento enviado a ${nombre}.`)
    setTimeout(() => setToast(''), 4000)
  }

  function handleUnlockConfirm() {
    if (!unlockTarget) return
    const nombre = unlockTarget.nombre
    setUsuarios(prev => prev.map(u => u.id === unlockTarget.id ? { ...u, estado: 'Activo' as const } : u))
    setUnlockTarget(null)
    setToast(`Cuenta desbloqueada. ${nombre} puede iniciar sesión nuevamente.`)
    setTimeout(() => setToast(''), 4000)
  }

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {resetTarget && (
        <ResetModal
          nombre={resetTarget.nombre}
          onConfirm={handleResetConfirm}
          onCancel={() => setResetTarget(null)}
        />
      )}
      {unlockTarget && (
        <UnlockModal
          nombre={unlockTarget.nombre}
          onConfirm={handleUnlockConfirm}
          onCancel={() => setUnlockTarget(null)}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Identidad</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Usuarios</span>
      </nav>

      {/* Title + action */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Usuarios</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Consulta y administra las cuentas de usuario del sistema.</p>
        </div>
        <button onClick={() => navigate('/usuarios/new')} className="flex items-center gap-2 bg-[#009574] hover:bg-[#007a5e] text-white text-[13px] font-semibold px-4 py-2 rounded-md transition-colors whitespace-nowrap mt-1">
          <Plus size={15} />Registrar Usuario
        </button>
      </div>

      <hr className="border-[#E5E7EB] my-6" />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <SearchSelect
          options={rolOptions} value={rolFilter}
          onChange={v => { setRolFilter(v); setPage(1) }}
          placeholder="Todos los roles"
        />
        <SimpleSelect
          options={estadoOptions} value={estadoFilter}
          onChange={v => { setEstadoFilter(v); setPage(1) }}
        />
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input type="text" placeholder="Buscar por nombre, usuario o matrícula..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] transition" />
        </div>
        {hasFilters && (
          <button onClick={() => { setRolFilter(''); setEstadoFilter(''); setSearch(''); setPage(1) }}
            className="flex items-center gap-1 text-[12px] text-[#6B7280] hover:text-[#333333] transition-colors">
            <X size={13} />Limpiar filtros
          </button>
        )}
      </div>

      {/* Error banner */}
      {loadStatus === 'error' && errorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {errorMsg}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-10">#</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nombre Completo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-56">Usuario</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-52">Roles</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-36">Último Acceso</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Estado</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-36">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loadStatus === 'loading' ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Loader2 size={24} className="animate-spin text-[#009574]" />
                    <p className="text-[13px] font-medium">Cargando usuarios...</p>
                  </div>
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Search size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">No se encontraron usuarios</p>
                    <p className="text-[12px]">
                      {loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              usuarios.map((row, i) => {
                const rowNum = (page - 1) * perPage + i + 1
                return (
                  <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3 text-[#6B7280] font-medium">{rowNum}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${row.avatarColor}`}>
                          {row.initials}
                        </div>
                        <span className="font-medium text-[#333333]">{row.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px] text-[#6B7280]">{row.usuario}</span>
                    </td>
                    <td className="px-4 py-3">
                      <RolesCell roles={row.roles} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280]">
                        <Clock size={12} />
                        {row.ultimoAcceso}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.estado === 'Activo' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo
                        </span>
                      ) : row.estado === 'Bloqueada' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Bloqueada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <ActionBtn icon={<Eye size={15} />} tooltip="Ver detalle" onClick={() => navigate(`/usuarios/detalle?id=${row.id}`)} />
                        <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => navigate(`/usuarios/form?mode=edit&id=${row.id}`)} />
                        <ActionBtn icon={<ToggleLeft size={15} />} tooltip="Cambiar estado" danger />
                        <ActionBtn icon={<KeyRound size={15} />} tooltip="Restablecer contraseña" danger onClick={() => setResetTarget(row)} />
                        {row.estado === 'Bloqueada' && (
                          <ActionBtn icon={<LockKeyholeOpen size={15} />} tooltip="Desbloquear cuenta" accent onClick={() => setUnlockTarget(row)} />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB] bg-[#F8F9FA]">
          <p className="text-[12px] text-[#6B7280]">
            {totalElements === 0 ? 'Sin registros' : `Mostrando ${startRow}–${endRow} de ${totalElements} registros`}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#F8F9FA] transition-colors">
              <ChevronLeft size={13} />Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 text-[12px] font-medium rounded-md border transition-colors ${p === page ? 'bg-[#009574] text-white border-[#009574]' : 'bg-white text-[#333333] border-[#E5E7EB] hover:bg-[#F8F9FA]'}`}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
              className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#F8F9FA] transition-colors">
              Siguiente<ChevRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
