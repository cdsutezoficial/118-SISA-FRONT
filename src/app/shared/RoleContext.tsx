import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Mock role system for the Admisión module prototype.
 *
 * Three identity tiers:
 * 1. Staff roles (`ADMINISTRADOR`, `GESTOR_ACADEMICO`, `SERVICIOS_ESCOLARES`,
 *    `FINANZAS`, `DIRECTOR_DIVISION`) — authenticated shell, `/admision/*`.
 * 2. `CANDIDATO` — post-registration portal access, set after a simulated
 *    folio+CURP "login" on `/portal/induccion`. Not part of `availableRoles`.
 * 3. `null` (anonymous visitor) — pre-registration public flow
 *    (`/portal/registro*`). No login at all.
 *
 * This is a mock provider only: role is local `useState`, not real auth. When
 * real auth arrives, only this file's internals change — `useRole()` callers
 * are unaffected.
 */
export type Role =
  | 'ADMINISTRADOR'
  | 'GESTOR_ACADEMICO'
  | 'SERVICIOS_ESCOLARES'
  | 'FINANZAS'
  | 'DIRECTOR_DIVISION'
  | 'CANDIDATO'

export interface RoleUser {
  name: string
  email: string
}

export interface RoleContextValue {
  /** `null` = anonymous visitor (pre-registration public flow). */
  role: Role | null
  setRole: (role: Role | null) => void
  /** Staff dropdown source — never contains `null` or `CANDIDATO`. */
  availableRoles: Role[]
  /** `null` when anonymous (`role === null`). */
  user: RoleUser | null
}

const MOCK_USER: RoleUser = { name: 'María González', email: 'admin@utez.edu.mx' }

// CANDIDATO is a real role (set after portal login, not chosen by staff) and
// `null` is the anonymous tier — neither belongs in the switchable staff list.
const AVAILABLE_ROLES: Role[] = [
  'ADMINISTRADOR',
  'GESTOR_ACADEMICO',
  'SERVICIOS_ESCOLARES',
  'FINANZAS',
  'DIRECTOR_DIVISION',
]

const RoleContext = createContext<RoleContextValue | undefined>(undefined)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>('SERVICIOS_ESCOLARES')

  const value: RoleContextValue = {
    role,
    setRole,
    availableRoles: AVAILABLE_ROLES,
    user: role === null ? null : MOCK_USER,
  }

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

/** Only sanctioned way to read the active mock role — never reach into the provider directly. */
export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) {
    throw new Error('useRole must be used within a RoleProvider')
  }
  return ctx
}
