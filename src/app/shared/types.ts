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

export type FormMode = 'register' | 'view' | 'edit'

export interface NavState {
  page: PageId
  mode?: FormMode
  pendingToast?: string
}

export type NavigateFn = (state: NavState) => void
