import { useCallback, useRef, type MouseEvent, type TouchEvent, type ReactNode } from 'react'

interface RippleProps {
  children: ReactNode
  className?: string
  color?: string
  disabled?: boolean
}

export function Ripple({ children, className = '', color, disabled }: RippleProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const createRipple = useCallback((x: number, y: number) => {
    if (disabled) return
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2
    const ripple = document.createElement('span')
    ripple.className = 'ripple'
    if (color) ripple.style.background = color
    ripple.style.width = `${size}px`
    ripple.style.height = `${size}px`
    ripple.style.left = `${x - rect.left - size / 2}px`
    ripple.style.top = `${y - rect.top - size / 2}px`
    container.appendChild(ripple)
    setTimeout(() => ripple.remove(), 500)
  }, [color, disabled])

  const handleMouseDown = useCallback((e: MouseEvent) => {
    createRipple(e.clientX, e.clientY)
  }, [createRipple])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0]
    if (touch) createRipple(touch.clientX, touch.clientY)
  }, [createRipple])

  return (
    <div
      ref={containerRef}
      className={`ripple-container ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {children}
    </div>
  )
}
