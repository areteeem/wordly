import { useMemo } from 'react'
import { useEffect, useState } from 'react'

const CONFETTI_COLORS = ['#ff4d4d', '#2d5da1', '#ffb347', '#87ceeb', '#98fb98', '#dda0dd', '#f0e68c', '#ff69b4']

interface ConfettiProps {
  active?: boolean
  onDone?: () => void
}

export function Confetti({ active = true, onDone }: ConfettiProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (active) {
      setShow(true)
      const timer = setTimeout(() => {
        setShow(false)
        onDone?.()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [active, onDone])

  const pieces = useMemo(() => {
    if (!active) return []
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.5 + Math.random() * 1,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotation: Math.random() * 360,
      size: 6 + Math.random() * 8,
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
    }))
  }, [active])

  if (!show) return null

  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.shape === 'rect' ? p.size * 0.6 : p.size,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}
