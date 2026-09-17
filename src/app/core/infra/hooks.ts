import { useLocation, useSearchParams } from 'react-router'
import { useState, type RefObject } from 'react'
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

/**
 * Decides whether a dropdown panel should open upward instead of downward.
 *
 * Custom dropdowns render an `absolute` panel below the trigger (`top-full`).
 * When the trigger sits near the bottom of the viewport, the panel overflows
 * the screen and makes the page scroll vertically. This hook measures the
 * trigger's position on open; if there is less than `threshold` px of room
 * below, the consumer renders the panel flipped (`bottom-full`).
 */
export function useOpenDirection<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [openUp, setOpenUp] = useState(false)

  function measureAndSet() {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setOpenUp(window.innerHeight - rect.bottom < 300)
  }

  return { openUp, measureAndSet }
}
