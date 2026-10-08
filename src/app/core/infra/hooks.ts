import { useLocation, useSearchParams } from 'react-router'
import { useState, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
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

/**
 * Positions a floating panel BY PORTAL to <body>, aligned to a trigger and
 * always kept inside the viewport.
 *
 * Absolute panels break in two common cases:
 *  - a container with `overflow-hidden`/`overflow-x-auto` (e.g. DataTable)
 *    clips the panel behind the table;
 *  - near the bottom edge of the screen the panel gets cut off.
 *
 * Same pattern as the ActionBtn tooltip (`createPortal` to body). On open the
 * panel is measured: if it doesn't fit below the trigger it opens upward, and
 * top/left are clamped with an 8px margin. A ResizeObserver re-clamps when the
 * panel content grows (e.g. a calendar month with 6 weeks). Closes on outside
 * click, Escape, scroll or resize (scrolls inside the panel itself, like a
 * year list, are ignored).
 */
export function useScreenPopover<T extends HTMLElement, P extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const triggerRef = useRef<T | null>(null)
  const panelRef = useRef<P | null>(null)

  useEffect(() => {
    if (!open) return
    function isInside(e: Event): boolean {
      const t = e.target as Node
      return !!(triggerRef.current?.contains(t) || panelRef.current?.contains(t))
    }
    function onMouseDown(e: MouseEvent) { if (!isInside(e)) setOpen(false) }
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    function onScroll(e: Event) { if (!isInside(e)) setOpen(false) }
    function onResize() { setOpen(false) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  function openPanel() {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({ left: rect.left, top: rect.bottom + 8 })
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return
    const panelEl = panel
    function clamp() {
      const h = panelEl.offsetHeight
      const w = panelEl.offsetWidth
      setPos(prev => {
        if (!prev) return prev
        const trigger = triggerRef.current
        let top = prev.top
        if (top + h > window.innerHeight - 8) {
          top = trigger ? trigger.getBoundingClientRect().top - h - 8 : top
        }
        top = Math.max(8, Math.min(top, window.innerHeight - h - 8))
        const left = Math.max(8, Math.min(prev.left, window.innerWidth - w - 8))
        if (top === prev.top && left === prev.left) return prev
        return { left, top }
      })
    }
    clamp()
    const ro = new ResizeObserver(clamp)
    ro.observe(panelEl)
    return () => ro.disconnect()
  }, [open])

  return { open, setOpen, triggerRef, panelRef, pos, openPanel }
}
