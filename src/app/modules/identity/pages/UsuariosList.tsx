import { useState, useEffect } from 'react'
import {
  Eye, Plus, LockKeyholeOpen, KeyRound, Clock, X,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { usePendingToast } from '@app/core/infra/hooks'
import { apiGet } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'
import { Toast, ActionBtn, SearchSelectField, ConfirmModal } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  SearchInput,
  FilterBar,
  FilterSelect,
  ResultCount,
  ErrorBanner,
  Pagination,
  MobilePagination,
  DataTable,
  MobileCards,
  BadgePill,
  type ColumnDef,
  type BadgeStyle,
} from '@app/core/components/list'

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  estado: BackendUserStatus
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

const estadoOptions: { value: string; label: string }[] = [
  { value: 'ACTIVE',   label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'LOCKED',   label: 'Bloqueada' },
]

const ESTADO_BADGE_MAP: Record<BackendUserStatus, BadgeStyle> = {
  ACTIVE: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  INACTIVE: { label: 'Inactivo', className: 'bg-gray-100 text-gray-500 border border-gray-200' },
  LOCKED: { label: 'Bloqueada', className: 'bg-red-50 text-red-700 border border-red-200' },
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
    estado: item.status,
    initials: initialsFor(item.fullName),
    avatarColor: avatarColorFor(item.fullName),
  }
}

// ─── Roles cell ────────────────────────────────────────────────────────────────
// Multi-badge render (a user can hold several roles) — `DataTable`'s built-in
// `type: 'badge'` only paints ONE pill, so this uses the `render` escape hatch,
// same as GruposList's unusual cells. Shows the first 2 roles and a "+N más"
// pill when there are more.

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

  const hasFilters = !!rolFilter || !!estadoFilter || !!search

  function handleResetConfirm() {
    if (!resetTarget) return
    const nombre = resetTarget.nombre
    setResetTarget(null)
    setToast(`Correo de restablecimiento enviado a ${nombre}.`)
  }

  function handleUnlockConfirm() {
    if (!unlockTarget) return
    const nombre = unlockTarget.nombre
    setUsuarios(prev => prev.map(u => u.id === unlockTarget.id ? { ...u, estado: 'ACTIVE' as const } : u))
    setUnlockTarget(null)
    setToast(`Cuenta desbloqueada. ${nombre} puede iniciar sesión nuevamente.`)
  }

  const emptyHint = loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'

  const columns: ColumnDef<Usuario>[] = [
    {
      key: 'nombre',
      header: 'Nombre Completo',
      render: row => (
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${row.avatarColor}`}>
            {row.initials}
          </div>
          <span className="font-medium text-[#333333] min-w-0">{row.nombre}</span>
        </div>
      ),
    },
    { key: 'usuario', header: 'Usuario', render: row => (
      <span title={row.usuario} className="block font-mono text-[12px] text-[#6B7280] truncate max-w-[220px]">{row.usuario}</span>
    ) },
    { key: 'roles', header: 'Roles', render: row => <RolesCell roles={row.roles} /> },
    { key: 'ultimoAcceso', header: 'Último Acceso', type: 'muted', icon: <Clock size={12} className="text-[#6B7280]" />, className: 'w-32' },
    { key: 'estado', header: 'Estado', type: 'badge', badge: ESTADO_BADGE_MAP, className: 'w-24' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {resetTarget && (
        <ConfirmModal
          title="Restablecer contraseña"
          confirmLabel="Enviar correo"
          message={`Se enviará un correo de restablecimiento a ${resetTarget.nombre} con instrucciones para crear una nueva contraseña.`}
          onConfirm={handleResetConfirm}
          onCancel={() => setResetTarget(null)}
        />
      )}
      {unlockTarget && (
        <ConfirmModal
          title="Desbloquear cuenta"
          confirmLabel="Desbloquear"
          message={`Estás a punto de desbloquear la cuenta de ${unlockTarget.nombre}. El usuario podrá volver a iniciar sesión.`}
          onConfirm={handleUnlockConfirm}
          onCancel={() => setUnlockTarget(null)}
        />
      )}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Identidad' },
          { label: 'Usuarios' },
        ]}
      />

      <PageHeader
        title="Usuarios"
        subtitle="Consulta y administra las cuentas de usuario del sistema."
        actions={[{ label: 'Registrar Usuario', icon: <Plus size={15} />, onClick: () => navigate('/usuarios/new') }]}
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      <FilterBar>
        <SearchSelectField
          options={rolOptions}
          value={rolFilter}
          onChange={v => { setRolFilter(v); setPage(1) }}
          placeholder="Todos los roles"
          searchPlaceholder="Buscar rol…"
        />
        <div className="w-full sm:w-40">
          <FilterSelect
            value={estadoFilter}
            onChange={v => { setEstadoFilter(v); setPage(1) }}
            allLabel="Todos"
            options={estadoOptions}
          />
        </div>
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Buscar por nombre, usuario o matrícula..."
        />
        {hasFilters && (
          <button onClick={() => { setRolFilter(''); setEstadoFilter(''); setSearch(''); setPage(1) }}
            className="flex items-center gap-1 text-[12px] text-[#6B7280] hover:text-[#333333] transition-colors">
            <X size={13} />Limpiar filtros
          </button>
        )}
        <ResultCount count={totalElements} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        numbered
        rowNumberOffset={(page - 1) * perPage}
        columns={columns}
        status={loadStatus}
        items={usuarios}
        keyFor={row => row.id}
        loadingLabel="Cargando usuarios..."
        emptyTitle="No se encontraron usuarios"
        emptyHint={emptyHint}
        footer={<Pagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} suffix="registros" />}
        actions={{
          view: row => navigate(`/usuarios/detalle?id=${row.id}`),
          extra: row => (
            <>
              <ActionBtn icon={<KeyRound size={15} />} tooltip="Restablecer contraseña" danger onClick={() => setResetTarget(row)} />
              {row.estado === 'LOCKED' && (
                <ActionBtn icon={<LockKeyholeOpen size={15} />} tooltip="Desbloquear cuenta" onClick={() => setUnlockTarget(row)} />
              )}
            </>
          ),
        }}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={usuarios}
        keyFor={row => row.id}
        renderItem={row => (
          <>
            {/* Nombre + avatar + estado */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${row.avatarColor}`}>
                  {row.initials}
                </div>
                <span className="font-medium text-[13px] text-[#333333]">{row.nombre}</span>
              </div>
              <BadgePill value={row.estado} map={ESTADO_BADGE_MAP} />
            </div>
            {/* Usuario */}
            <p className="font-mono text-[12px] text-[#6B7280] mb-1">{row.usuario}</p>
            {/* Roles */}
            <RolesCell roles={row.roles} />
            {/* Último acceso */}
            <p className="flex items-center gap-1.5 text-[12px] text-[#6B7280] mt-2 mb-3">
              <Clock size={12} />
              {row.ultimoAcceso}
            </p>
            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <button
                onClick={() => navigate(`/usuarios/detalle?id=${row.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#6B7280] border border-[#E5E7EB] rounded-md hover:bg-[#F8F9FA] transition-colors"
              >
                <Eye size={14} />Ver
              </button>
              {row.estado === 'LOCKED' && (
                <button
                  onClick={() => setUnlockTarget(row)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
                >
                  <LockKeyholeOpen size={14} />Desbloquear
                </button>
              )}
            </div>
          </>
        )}
        loadingLabel="Cargando usuarios..."
        emptyTitle="No se encontraron usuarios"
        emptyHint={emptyHint}
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} suffix="registros" />}
      />
    </PageContainer>
  )
}
