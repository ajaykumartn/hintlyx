import { useEffect, useState } from 'react'

interface Tip {
  text: string
  x: number
  y: number
}

/**
 * Tooltips drawn inside the overlay. Native `title` tooltips open as separate OS windows,
 * which screen-share protection does not cover, so the app never uses them.
 * Any button with an aria-label gets a tooltip.
 */
export function Tooltip() {
  const [tip, setTip] = useState<Tip | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let current: Element | null = null

    const onOver = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest('button[aria-label]') : null
      if (el === current) return
      current = el
      clearTimeout(timer)
      setTip(null)
      if (!el) return
      timer = setTimeout(() => {
        const r = el.getBoundingClientRect()
        setTip({ text: el.getAttribute('aria-label') ?? '', x: r.left + r.width / 2, y: r.bottom + 8 })
      }, 450)
    }
    const hide = () => {
      current = null
      clearTimeout(timer)
      setTip(null)
    }

    window.addEventListener('mouseover', onOver)
    window.addEventListener('mousedown', hide)
    document.addEventListener('mouseleave', hide)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mouseover', onOver)
      window.removeEventListener('mousedown', hide)
      document.removeEventListener('mouseleave', hide)
    }
  }, [])

  if (!tip?.text) return null
  return (
    <div className="tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>
  )
}
