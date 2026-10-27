import { useState, useEffect } from 'react'
import {
  Eye, Plus, LockKeyholeOpen, KeyRound, Clock, X, Copy, Check, AlertTriangle,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { usePendingToast } from '@app/core/infra/hooks'
import { apiGet, apiPatch, apiPost } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'
import { Toast, ActionBtn, SearchSelectField, ConfirmModal, Modal } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { Button } from '@app/core/components/form'
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
  roleId: string
  roleKey: BackendRoleType
  roleName: string
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
  const roles = item.roles.map(r => r.roleKey)
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
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ nombre: string; usuario: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [unlockTarget, setUnlockTarget] = useState<Usuario | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(pendingToast ?? '')
  const [perPage, setPerPage] = useState(10)

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
      roleKey: rolFilter || undefined,
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
  }, [rolFilter, estadoFilter, debouncedSearch, page, perPage])

  const hasFilters = !!rolFilter || !!estadoFilter || !!search

  function handleResetConfirm() {
    if (!resetTarget) return
    const target = resetTarget
    setResetTarget(null)
    setResettingId(target.id)
    void (async () => {
      try {
        // Server-generated, no request body: the 8-char policy cannot be
        // bypassed from the browser. The plaintext comes back in the response
        // and nowhere else — it is shown once and dropped.
        const res = await apiPost<{ userId: string; username: string; temporaryPassword: string }>(
          `/users/${target.id}/reset-password`,
        )
        // The reset also re-arms mustChangePassword, clears failed attempts and
        // unlocks — reflect all of it locally instead of re-fetching the page.
        setUsuarios(prev => prev.map(u => u.id === target.id
          ? { ...u, estado: 'ACTIVE' as const }
          : u))
        setCopied(false)
        setIssued({ nombre: target.nombre, usuario: res.username, password: res.temporaryPassword })
      } catch (err) {
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 400 || apiErr.status === 422) {
          setToast(apiErr.message ?? 'No se pudo restablecer la contraseña.')
        } else {
          setToast('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      } finally {
        setResettingId(null)
      }
    })()
  }

  async function handleCopyPassword() {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.password)
      setCopied(true)
    } catch {
      // Clipboard is permission-gated (and absent on plain http origins other
      // than localhost) — the password stays selectable either way.
      setCopied(false)
    }
  }

  function handleUnlockConfirm() {
    if (!unlockTarget) return
    const target = unlockTarget
    setUnlockTarget(null)
    void apiPatch(`/users/${target.id}/unlock`)
      .then(() => {
        setUsuarios(prev => prev.map(u => u.id === target.id ? { ...u, estado: 'ACTIVE' as const } : u))
        setToast(`Cuenta desbloqueada. ${target.nombre} puede iniciar sesión nuevamente.`)
      })
      .catch((err: unknown) => {
        const apiErr = err as Partial<ApiError>
        setToast(apiErr.message ?? 'No se pudo desbloquear la cuenta.')
      })
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
          confirmLabel="Generar contraseña"
          message={`Se generará una contraseña temporal para ${resetTarget.nombre} y se le enviará por correo. Se cerrarán las sesiones abiertas de esa cuenta y el usuario deberá cambiarla al iniciar sesión.`}
          onConfirm={handleResetConfirm}
          onCancel={() => setResetTarget(null)}
        />
      )}
      {issued && (
        <Modal
          title="Contraseña temporal"
          subtitle={issued.usuario}
          onClose={() => setIssued(null)}
          maxWidth="max-w-md"
          footer={
            <Button onClick={() => setIssued(null)}>Cerrar</Button>
          }
        >
          <div className="space-y-5">
            {/* La credencial es el motivo del modal, así que encabeza el
                bloque. Sin `tracking`: en 8 caracteres, el espaciado extra
                vuelve ambiguos `O`/`0` y `l`/`1`, y el usuario la transcribe
                a mano. `select-all` porque copiar a mano es la fuente de
                errores, y el botón de copiado existe justo por eso. */}
            <div className="rounded-lg border border-[#E5E7EB] border-l-[3px] border-l-[#009574] bg-[#F8F9FA] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-2">
                Contraseña temporal
              </p>
              <div className="flex items-center gap-3">
                <code
                  className="flex-1 select-all font-mono text-[22px] leading-none font-semibold text-[#111827]"
                  onDoubleClick={() => void handleCopyPassword()}
                >
                  {issued.password}
                </code>
                <Button
                  variant={copied ? 'outline' : 'secondary'}
                  onClick={() => void handleCopyPassword()}
                  className="flex-shrink-0"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiada' : 'Copiar'}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-amber-900 leading-relaxed">
                Se muestra una sola vez y no queda guardada en el sistema. Entrégasela a{' '}
                <span className="font-medium">{issued.nombre}</span> por un canal seguro.
              </p>
            </div>

            <ul className="space-y-1.5 text-[12.5px] text-[#6B7280]">
              <li className="flex items-start gap-2">
                <span className="text-[#009574] mt-[3px]">•</span>
                También se envió por correo a {issued.usuario}.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#009574] mt-[3px]">•</span>
                Se cerraron las sesiones que esa cuenta tenía abiertas.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#009574] mt-[3px]">•</span>
                El usuario deberá cambiarla en su primer ingreso.
              </li>
            </ul>
          </div>
        </Modal>
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
        <div className="w-full sm:w-56">
          <SearchSelectField
            options={rolOptions}
            value={rolFilter}
            onChange={v => { setRolFilter(v); setPage(1) }}
            placeholder="Todos los roles"
            searchPlaceholder="Buscar rol…"
          />
        </div>
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
        footer={<Pagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} suffix="registros" />}
        actions={{
          view: row => navigate(`/usuarios/detalle?id=${row.id}`),
          extra: row => (
            <>
              <ActionBtn
                icon={<KeyRound size={15} />}
                tooltip="Restablecer contraseña"
                danger
                // Guards against a double click minting two passwords: the
                // response of the first would silently overwrite the second.
                disabled={resettingId === row.id}
                onClick={() => setResetTarget(row)}
              />
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
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => navigate(`/usuarios/detalle?id=${row.id}`)}
              >
                <Eye size={14} />Ver
              </Button>
              {row.estado === 'LOCKED' && (
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setUnlockTarget(row)}
                >
                  <LockKeyholeOpen size={14} />Desbloquear
                </Button>
              )}
            </div>
          </>
        )}
        loadingLabel="Cargando usuarios..."
        emptyTitle="No se encontraron usuarios"
        emptyHint={emptyHint}
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} suffix="registros" />}
      />
    </PageContainer>
  )
}
