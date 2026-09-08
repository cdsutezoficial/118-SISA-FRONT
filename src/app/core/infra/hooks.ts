import { useLocation, useSearchParams } from 'react-router'
import type { FormMode } from './types'

/**
 * Derives the current form mode and record id from the URL.
 *
 * - On `/{mod}/new`: returns `{ mode: 'register', id: null }` (no params expected).
 * - On `/{mod}/form?mode=view&id=X`: returns `{ mode: 'view', id: 'X' }`.
 * - On `/{mod}/form?mode=edit&id=X`: returns `{ mode: 'edit', id: 'X' }`.
 * - Default when `mode` param is absent: `'register'`.
 */
export function useFormMode(): { mode: FormMode; id: string | null } {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  if (pathname.endsWith('/new')) return { mode: 'register', id: null }
  return { mode: (params.get('mode') as FormMode) ?? 'register', id: params.get('id') }
}

/**
 * Reads the toast message passed via router state after a navigation.
 *
 * Producers call: `navigate('/path', { state: { toast: 'Record saved' } })`
 * Consumers call: `const toast = usePendingToast()`
 *
 * Returns `undefined` when no toast is present in location state.
 */
export function usePendingToast(): string | undefined {
  const { state } = useLocation()
  return (state as { toast?: string } | null)?.toast
}
