import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

interface Props {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  children: ReactNode
}

export function Sheet({ expanded, onExpandedChange, children }: Props) {
  const drag = useRef<{
    pointerId: number
    startY: number
    startHeight: number
    height: number
    viewportHeight: number
    moved: boolean
  } | null>(null)
  const suppressClick = useRef(false)
  const [height, setHeight] = useState<number | null>(null)

  function start(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || !window.matchMedia('(max-width: 820px)').matches) return
    const sheet = event.currentTarget.parentElement!
    const startHeight = sheet.getBoundingClientRect().height
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight,
      height: startHeight,
      viewportHeight: sheet.parentElement!.getBoundingClientRect().height,
      moved: false,
    }
    suppressClick.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId) return
    const delta = active.startY - event.clientY
    if (Math.abs(delta) > 5) active.moved = true
    if (!active.moved) return
    active.height = Math.max(active.viewportHeight * 0.4,
      Math.min(active.viewportHeight * 0.7, active.startHeight + delta))
    setHeight(active.height)
  }

  function finish(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId) return
    drag.current = null
    suppressClick.current = active.moved
    if (active.moved && !cancelled) {
      onExpandedChange(active.height >= active.viewportHeight * 0.55)
    }
    setHeight(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <aside
      className={`sheet${expanded ? ' is-expanded' : ''}${height !== null ? ' is-dragging' : ''}`}
      style={height === null ? undefined : { height }}
      aria-label="Salles"
    >
      <button
        type="button"
        className="sheet-handle"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={(event) => finish(event, true)}
        onClick={(event) => {
          if (suppressClick.current && event.detail !== 0) {
            suppressClick.current = false
            return
          }
          onExpandedChange(!expanded)
        }}
        aria-label={expanded ? 'Réduire le panneau' : 'Agrandir le panneau'}
        aria-expanded={expanded}
      >
        <span />
      </button>
      <div className="sheet-body">{children}</div>
    </aside>
  )
}
