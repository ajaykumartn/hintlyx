import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * The window is a large transparent canvas. Clicks pass through it to the app below,
 * except over elements marked with data-hit (the command bar and the card).
 */
export function useMouseThrough(): void {
  useEffect(() => {
    let through = true
    const update = (target: EventTarget | null) => {
      const overUi = target instanceof Element && target.closest('[data-hit]') !== null
      const next = !overUi
      if (next !== through) {
        through = next
        window.hintlyx.setMouseThrough(next)
      }
    }
    const onMove = (e: MouseEvent) => update(e.target)
    const onLeave = () => update(null)
    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])
}

/** Drag handle: moves the whole window with the pointer. */
export function useWindowDrag() {
  const origin = useRef<{ x: number; y: number } | null>(null)

  return {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      origin.current = { x: e.screenX, y: e.screenY }
      window.hintlyx.dragStart()
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      if (!origin.current) return
      window.hintlyx.dragMove(e.screenX - origin.current.x, e.screenY - origin.current.y)
    },
    onPointerUp(e: ReactPointerEvent<HTMLElement>) {
      origin.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }
}
