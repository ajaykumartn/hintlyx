import { useEffect, useState } from 'react'

type Kind = 'arrow' | 'pointer' | 'text' | 'grab' | 'grabbing'

interface Pointer {
  x: number
  y: number
  kind: Kind
}

function kindFor(el: Element, pressed: boolean): Kind {
  if (el.closest('.grip')) return pressed ? 'grabbing' : 'grab'
  if (el.closest('textarea, input')) return 'text'
  if (el.closest('button:not(:disabled), [role="switch"]')) return 'pointer'
  return 'arrow'
}

/**
 * While Hintlyx is invisible, the real Windows pointer is hidden over Hintlyx (CSS cursor: none),
 * so screen shares show no pointer there. This draws a pointer inside the overlay instead.
 * The overlay is excluded from capture, so only the user sees it.
 */
export function FakeCursor({ enabled }: { enabled: boolean }) {
  const [pointer, setPointer] = useState<Pointer | null>(null)

  useEffect(() => {
    if (!enabled) {
      setPointer(null)
      return
    }
    let pressed = false
    let last: { x: number; y: number; target: EventTarget | null } | null = null

    const update = () => {
      const el = last?.target instanceof Element ? last.target : null
      if (!last || !el?.closest('[data-hit]')) {
        setPointer(null)
        return
      }
      setPointer({ x: last.x, y: last.y, kind: kindFor(el, pressed) })
    }
    const onMove = (e: MouseEvent) => {
      last = { x: e.clientX, y: e.clientY, target: e.target }
      update()
    }
    const onDown = () => {
      pressed = true
      update()
    }
    const onUp = () => {
      pressed = false
      update()
    }
    const onLeave = () => {
      last = null
      update()
    }

    window.addEventListener('mousemove', onMove, true)
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('mouseup', onUp, true)
    document.addEventListener('mouseleave', onLeave)
    window.addEventListener('blur', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove, true)
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('mouseup', onUp, true)
      document.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('blur', onUp)
    }
  }, [enabled])

  if (!pointer) return null
  return (
    <div className="fake-cursor" style={{ transform: `translate(${pointer.x}px, ${pointer.y}px)` }}>
      <CursorShape kind={pointer.kind} />
    </div>
  )
}

const stroke = { stroke: '#000', strokeWidth: 1.2, strokeLinejoin: 'round' as const }

function CursorShape({ kind }: { kind: Kind }) {
  switch (kind) {
    case 'text':
      // Hotspot at the centre of the I-beam.
      return (
        <svg width="12" height="22" viewBox="0 0 12 22" style={{ marginLeft: -6, marginTop: -11 }}>
          <path d="M2 1h3l1 1 1-1h3M6 2v18M2 21h3l1-1 1 1h3" fill="none" stroke="#000" strokeWidth="3" />
          <path d="M2 1h3l1 1 1-1h3M6 2v18M2 21h3l1-1 1 1h3" fill="none" stroke="#fff" strokeWidth="1.3" />
        </svg>
      )
    case 'pointer':
      // Hotspot at the fingertip.
      return (
        <svg width="20" height="24" viewBox="0 0 20 24" style={{ marginLeft: -6, marginTop: -1 }}>
          <path
            d="M6 1.5c1 0 1.8.8 1.8 1.8v7.2l1-.1c.9 0 1.6.6 1.7 1.4.4-.3.9-.5 1.4-.4.9.1 1.5.8 1.6 1.6.4-.2.9-.3 1.3-.2 1 .2 1.7 1 1.7 2v3.5c0 3-2.4 5.4-5.4 5.4H9.7c-1.8 0-3.4-.9-4.4-2.4L1.6 15.7c-.5-.8-.3-1.9.5-2.4.8-.5 1.7-.3 2.3.4l.8 1V3.3C4.2 2.3 5 1.5 6 1.5Z"
            fill="#fff"
            {...stroke}
          />
        </svg>
      )
    case 'grab':
    case 'grabbing':
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" style={{ marginLeft: -11, marginTop: -11 }}>
          <path
            d={
              kind === 'grab'
                ? 'M5 9V5.5a1.5 1.5 0 0 1 3 0V9 3.5a1.5 1.5 0 0 1 3 0V9 4.5a1.5 1.5 0 0 1 3 0V10 7a1.5 1.5 0 0 1 3 0v6.5c0 3.6-2.9 6.5-6.5 6.5H10c-2 0-3.8-1-4.9-2.7L2.6 13.5a1.6 1.6 0 0 1 2.4-2Z'
                : 'M5 11V9a1.5 1.5 0 0 1 3 0v2-2.5a1.5 1.5 0 0 1 3 0V11 9a1.5 1.5 0 0 1 3 0v2 0a1.5 1.5 0 0 1 3 0v2.5c0 3.6-2.9 6.5-6.5 6.5H10c-2 0-3.8-1-4.9-2.7L3.5 14a1.6 1.6 0 0 1 1.5-3Z'
            }
            fill="#fff"
            {...stroke}
          />
        </svg>
      )
    default:
      // Standard arrow. Hotspot at the tip.
      return (
        <svg width="16" height="24" viewBox="0 0 16 24">
          <path d="M1 1v19.5l4.6-4.5 3 6.6 3-1.4-3-6.4H15L1 1Z" fill="#fff" {...stroke} />
        </svg>
      )
  }
}
