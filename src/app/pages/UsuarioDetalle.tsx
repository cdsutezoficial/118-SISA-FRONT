import { useState } from 'react'
import {
  ChevronRight, Pencil, KeyRound, UserCheck, History,
  Info, CheckCircle2, AlertCircle, Monitor, Smartphone,
  ShieldCheck, X, Plus,
} from 'lucide-react'
import type { NavigateFn } from '../shared/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TabKey = 'info' | 'roles' | 'historial'

interface RolRow {
  id: number
  rol: string
  scope: string
  asignadoEl: string
  asignadoPor: string
}

interface AccesoRow {
  fecha: string
  hora: string
  ip: string
  dispositivo: string
  tipo: 'desktop' | 'mobile'
  resultado: 'Exitoso' | 'Fallido'
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const rolStyle: Record<string, string> = {
  'Estudiante':       'bg-blue-50 text-blue-700 border border-blue-200',
  'Docente':          'bg-violet-50 text-violet-700 border border-violet-200',
  'Tutor':            'bg-amber-50 text-amber-700 border border-amber-200',
  'Gestor Académico': 'bg-teal-50 text-teal-700 border border-teal-200',
  'Administrador':    'bg-[#e6f5f1] text-[#009574] border border-[#009574]/30',
}

const rolesAsignados: RolRow[] = [
  { id: 1, rol: 'Estudiante', scope: 'Global', asignadoEl: '15/01/2026', asignadoPor: 'Admin Sistema' },
]

const historialAccesos: AccesoRow[] = [
  { fecha: '28/06/2026', hora: '10:32', ip: '192.168.1.45', dispositivo: 'Chrome 126 · Windows 11', tipo: 'desktop', resultado: 'Exitoso' },
  { fecha: '27/06/2026', hora: '08:14', ip: '192.168.1.45', dispositivo: 'Chrome 126 · Windows 11', tipo: 'desktop', resultado: 'Exitoso' },
  { fecha: '25/06/2026', hora: '19:53', ip: '201.134.22.80', dispositivo: 'Safari · iOS 17', tipo: 'mobile', resultado: 'Exitoso' },
  { fecha: '24/06/2026', hora: '07:02', ip: '192.168.1.45', dispositivo: 'Chrome 126 · Windows 11', tipo: 'desktop', resultado: 'Fallido' },
  { fecha: '20/06/2026', hora: '11:48', ip: '192.168.1.45', dispositivo: 'Chrome 126 · Windows 11', tipo: 'desktop', resultado: 'Exitoso' },
]

// ─── Confirm modal for password reset ─────────────────────────────────────────

function ResetModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
            <KeyRound size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#333333] mb-1">Restablecer contraseña</h3>
            <p className="text-[13px] text-[#6B7280]">
              Se enviará un correo de restablecimiento a{' '}
              <strong className="text-[#333333]">Ana García López</strong>{' '}
              con instrucciones para crear una nueva contraseña.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 mb-6 text-[12px] text-amber-700">
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          La sesión activa del usuario será cerrada automáticamente.
        </div>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors">
            <KeyRound size={13} />Enviar correo
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Revoke modal ──────────────────────────────────────────────────────────────

function RevokeModal({ rol, onConfirm, onCancel }: { rol: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#333333] mb-1">Revocar rol</h3>
            <p className="text-[13px] text-[#6B7280]">
              Estás a punto de revocar el rol <strong className="text-[#333333]">{rol}</strong> a Ana García López. Esta acción no se puede deshacer.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 text-[13px] font-semibold bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors">Sí, revocar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Asignar Rol modal ────────────────────────────────────────────────────────

const allRoles = ['Estudiante', 'Docente', 'Tutor', 'Gestor Académico', 'Administrador']

function AsignarRolModal({ onConfirm, onCancel }: { onConfirm: (rol: string) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState('')
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-[15px] font-semibold text-[#333333] mb-4">Asignar Rol</h3>
        <div className="space-y-2 mb-6">
          {allRoles.map(r => (
            <button key={r} type="button" onClick={() => setSelected(r)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border text-[13px] transition-colors ${selected === r ? 'bg-[#e6f5f1] border-[#009574]/40 text-[#009574] font-medium' : 'border-[#E5E7EB] text-[#333333] hover:bg-[#F8F9FA]'}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">Cancelar</button>
          <button disabled={!selected} onClick={() => selected && onConfirm(selected)}
            className="px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Asignar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed top-5 right-5 z-[300] flex items-center gap-3 bg-white border border-emerald-200 shadow-lg rounded-lg px-4 py-3">
      <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
      <span className="text-[13px] font-medium text-[#333333]">{message}</span>
      <button onClick={onClose} className="ml-1 text-[#6B7280] hover:text-[#333333] text-[16px] leading-none">×</button>
    </div>
  )
}

// ─── Read-only field ───────────────────────────────────────────────────────────

function ReadField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[13px] text-[#333333] ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</p>
    </div>
  )
}

// ─── Action btn with tooltip ───────────────────────────────────────────────────

function ActionBtn({ icon, tooltip, danger, onClick }: { icon: React.ReactNode; tooltip: string; danger?: boolean; onClick?: () => void }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-flex">
      <button onClick={onClick} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className={`p-1.5 rounded-md transition-colors ${danger ? 'text-[#6B7280] hover:bg-red-50 hover:text-red-600' : 'text-[#6B7280] hover:bg-[#e6f5f1] hover:text-[#009574]'}`}>
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

// ─── Page ──────────────────────────────────────────────────────────────────────

interface Props { navigate: NavigateFn; pendingToast?: string }

export default function UsuarioDetalle({ navigate, pendingToast }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('info')
  const [llaveMxVinculada, setLlaveMxVinculada] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showAsignarRol, setShowAsignarRol] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<RolRow | null>(null)
  const [roles, setRoles] = useState<RolRow[]>(rolesAsignados)
  const [toast, setToast] = useState(pendingToast ?? '')

  function handleResetConfirm() {
    setShowResetModal(false)
    setToast('Correo de restablecimiento enviado a Ana García López.')
    setTimeout(() => setToast(''), 4000)
  }

  function handleAsignarRolConfirm(rol: string) {
    const nextId = Math.max(0, ...roles.map(r => r.id)) + 1
    setRoles(prev => [...prev, { id: nextId, rol, scope: 'Global', asignadoEl: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/'), asignadoPor: 'Admin Sistema' }])
    setShowAsignarRol(false)
    setToast(`Rol "${rol}" asignado exitosamente.`)
    setTimeout(() => setToast(''), 3500)
  }

  function handleRevokeConfirm() {
    if (!revokeTarget) return
    const nombre = revokeTarget.rol
    setRoles(prev => prev.filter(r => r.id !== revokeTarget.id))
    setRevokeTarget(null)
    setToast(`Rol "${nombre}" revocado exitosamente.`)
    setTimeout(() => setToast(''), 3500)
  }

  const tabs = [
    { key: 'info'     as TabKey, label: 'Información General', icon: <UserCheck size={14} /> },
    { key: 'roles'    as TabKey, label: 'Roles Asignados',      icon: <ShieldCheck size={14} /> },
    { key: 'historial'as TabKey, label: 'Historial de Accesos', icon: <History size={14} /> },
  ]

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {showResetModal && <ResetModal onConfirm={handleResetConfirm} onCancel={() => setShowResetModal(false)} />}
      {revokeTarget && <RevokeModal rol={revokeTarget.rol} onConfirm={handleRevokeConfirm} onCancel={() => setRevokeTarget(null)} />}
      {showAsignarRol && <AsignarRolModal onConfirm={handleAsignarRolConfirm} onCancel={() => setShowAsignarRol(false)} />}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate({ page: 'dashboard' })} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Identidad</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate({ page: 'usuarios-list' })} className="hover:text-[#009574] transition-colors">Usuarios</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Detalle</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Ana García López</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">Información completa de la cuenta de usuario.</p>
      </div>

      {/* Summary card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg px-6 py-5 mb-6">
        <div className="flex items-center gap-5 flex-wrap">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[18px] font-bold flex-shrink-0">
            AG
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <p className="text-[16px] font-bold text-[#333333]">Ana García López</p>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo
              </span>
            </div>
            <p className="font-mono text-[13px] text-[#6B7280]">202630001@utez.edu.mx</p>
            <p className="text-[12px] text-[#6B7280] mt-1 flex items-center gap-1">
              <History size={12} />
              Último acceso: <strong className="text-[#333333]">28/06/2026 10:32 hrs</strong>
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {llaveMxVinculada ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />LlaveMX vinculada
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />LlaveMX no vinculada
                  </span>
                  <button
                    onClick={() => setLlaveMxVinculada(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#009574] border border-[#009574]/30 bg-[#e6f5f1] hover:bg-[#d0ede6] px-2 py-0.5 rounded-full transition-colors"
                  >
                    Vincular con LlaveMX
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-amber-600 border border-amber-200 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors flex-shrink-0"
          >
            <KeyRound size={13} />Restablecer contraseña
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E5E7EB] mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-[#009574] text-[#009574]'
                : 'border-transparent text-[#6B7280] hover:text-[#333333] hover:border-[#E5E7EB]'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Información General ── */}
      {activeTab === 'info' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">Datos Personales</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <ReadField label="Nombre(s)"        value="Ana" />
            <ReadField label="Primer Apellido"  value="García" />
            <ReadField label="Segundo Apellido" value="López" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ReadField label="CURP" value="GALA000115MMSRRN05" mono />
            <ReadField label="Correo Institucional" value="202630001@utez.edu.mx" mono />
          </div>

          <div className="flex items-center gap-4 my-6">
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">Acceso al Sistema</p>
            <div className="flex-1 h-px bg-[#E5E7EB]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ReadField label="Nombre de Usuario" value="202630001" mono />
            <div>
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Rol Principal</p>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${rolStyle['Estudiante']}`}>Estudiante</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Roles Asignados ── */}
      {activeTab === 'roles' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Rol</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-40">Scope (División)</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-36">Asignado el</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-40">Asignado por</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-[#6B7280]">
                      <ShieldCheck size={28} className="text-[#E5E7EB]" />
                      <p className="text-[13px] font-medium">Sin roles asignados</p>
                      <p className="text-[12px]">Asigna un rol para que el usuario pueda acceder al sistema.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                roles.map(row => (
                  <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${rolStyle[row.rol] ?? 'bg-gray-100 text-gray-600'}`}>
                        {row.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#333333]">{row.scope}</td>
                    <td className="px-4 py-3 text-[#6B7280] font-mono text-[12px]">{row.asignadoEl}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#e6f5f1] text-[#009574] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {row.asignadoPor.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-[#333333] text-[13px]">{row.asignadoPor}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ActionBtn icon={<X size={15} />} tooltip="Revocar rol" danger onClick={() => setRevokeTarget(row)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Asignar Rol button */}
          <div className="border-t border-[#E5E7EB] px-4 py-3">
            <button type="button" onClick={() => navigate({ page: 'asignar-rol' })} className="flex items-center gap-1.5 text-[12px] font-medium text-[#009574] hover:text-[#007a5e] transition-colors">
              <Plus size={14} />Asignar Rol
            </button>
          </div>
        </div>
      )}

      {/* ── Tab 3: Historial de Accesos ── */}
      {activeTab === 'historial' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-44">Fecha y hora</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-36">IP</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Dispositivo</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {historialAccesos.map((h, i) => (
                <tr key={i} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-[#333333]">{h.fecha}</span>
                    <span className="ml-2 text-[#6B7280]">{h.hora}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px] text-[#6B7280]">{h.ip}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-[#333333]">
                      {h.tipo === 'mobile'
                        ? <Smartphone size={13} className="text-[#6B7280] flex-shrink-0" />
                        : <Monitor size={13} className="text-[#6B7280] flex-shrink-0" />
                      }
                      {h.dispositivo}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {h.resultado === 'Exitoso' ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Exitoso
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Fallido
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Action zone */}
      <div className="flex items-center justify-end gap-3 mt-8">
        <button
          onClick={() => navigate({ page: 'usuarios-list' })}
          className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
        >
          Regresar
        </button>
        <button
          onClick={() => navigate({ page: 'usuario-form', mode: 'edit' })}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
        >
          <Pencil size={14} />Editar
        </button>
      </div>
    </div>
  )
}
