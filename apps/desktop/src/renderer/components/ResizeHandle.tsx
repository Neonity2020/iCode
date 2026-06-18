import { useCallback, useEffect, useRef, useState } from 'react'

interface ResizeHandleProps {
  /** Current width of the panel this handle controls, in pixels. */
  width: number
  /** Minimum clamped width in pixels. */
  min: number
  /** Maximum clamped width in pixels. */
  max: number
  /** Called with the next clamped width on every drag movement. */
  onResize: (width: number) => void
  /** Which edge the handle sits on; only flips the resize direction. */
  side: 'left' | 'right'
  /** Accessible label describing the panel being resized. */
  label: string
}

/**
 * A thin draggable gutter between two panels. Holding the pointer down on it
 * starts a capture session; horizontal movement is translated into a new clamped
 * width for the panel on the given side and reported via `onResize`.
 */
export function ResizeHandle({ width, min, max, onResize, side, label }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false)
  // The pointer X and panel width recorded at the start of the active drag.
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      ;(event.target as HTMLDivElement).setPointerCapture(event.pointerId)
      dragState.current = { startX: event.clientX, startWidth: width }
      setIsDragging(true)
    },
    [width],
  )

  useEffect(() => {
    if (!isDragging) return
    document.body.classList.add('resizing')
    return () => document.body.classList.remove('resizing')
  }, [isDragging])

  useEffect(() => {
    if (!isDragging || !dragState.current) return
    const { startX, startWidth } = dragState.current

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragState.current) return
      const delta = event.clientX - startX
      // Dragging right grows a left-anchored panel and shrinks a right-anchored one.
      const next = side === 'left' ? startWidth + delta : startWidth - delta
      onResize(Math.min(max, Math.max(min, next)))
    }
    const handlePointerUp = () => {
      dragState.current = null
      setIsDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging, max, min, onResize, side])

  return (
    <div
      className={`resize-handle ${isDragging ? 'dragging' : ''} resize-${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={handlePointerDown}
    />
  )
}
