/**
 * @deprecated All three legacy nav types (PageId, NavState, NavigateFn) are
 * superseded by react-router 7 URL routing. They are kept here while page
 * components are being migrated (PR 2+). Remove after all pages are converted.
 */

/** @deprecated Use URL path segments instead (e.g. '/divisiones'). */
export type PageId =
  | 'login'
  | 'dashboard'
  | 'usuarios-list' | 'usuario-form' | 'usuario-detalle' | 'asignar-rol'
  | 'cambiar-password'
  | 'reset-password'
  | 'reset-confirm'
  | 'divisiones-list' | 'division-form'
  | 'programas-list' | 'programa-form'
  | 'materias-list' | 'materia-form'
  | 'periodos-list' | 'periodo-form'
  | 'grupos-list' | 'grupo-form'
  | 'conceptos-list' | 'concepto-form'
  | 'planes-list' | 'plan-form' | 'plan-detalle' | 'escalas-list' | 'escala-form' | 'asignar-materia'

/** Current form mode. Used by useFormMode() and page form components. */
export type FormMode = 'register' | 'view' | 'edit'

/** @deprecated Use `navigate(path, { state: { toast } })` + `usePendingToast()` instead. */
export interface NavState {
  page: PageId
  mode?: FormMode
  pendingToast?: string
}

/** @deprecated Use `useNavigate()` from react-router instead. */
export type NavigateFn = (state: NavState) => void

/** Router state shape for passing toast messages between routes. */
export type ToastState = { toast?: string }
