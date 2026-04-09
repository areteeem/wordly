import { useEffect, useRef, useCallback } from 'react'

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeDown?: () => void
  edgeThreshold?: number   // px from edge to trigger (default 30)
  minDistance?: number      // minimum swipe distance (default 60)
  enabled?: boolean
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeDown,
  edgeThreshold = 30,
  minDistance = 60,
  enabled = true,
}: UseSwipeGestureOptions) {
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return
    const touch = e.touches[0]
    if (!touch) return
    startRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
  }, [enabled])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled || !startRef.current) return
    const touch = e.changedTouches[0]
    if (!touch) return

    const dx = touch.clientX - startRef.current.x
    const dy = touch.clientY - startRef.current.y
    const elapsed = Date.now() - startRef.current.time
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    const startX = startRef.current.x
    const screenWidth = window.innerWidth

    startRef.current = null

    // Must be fast enough (under 500ms) and travel enough distance
    if (elapsed > 500) return

    // Horizontal swipe
    if (absDx > absDy && absDx > minDistance) {
      if (dx > 0 && startX < edgeThreshold) {
        // Swipe right from left edge
        onSwipeRight?.()
      } else if (dx < 0 && startX > screenWidth - edgeThreshold) {
        // Swipe left from right edge
        onSwipeLeft?.()
      }
    }

    // Vertical swipe (down)
    if (absDy > absDx && absDy > minDistance && dy > 0) {
      onSwipeDown?.()
    }
  }, [enabled, edgeThreshold, minDistance, onSwipeLeft, onSwipeRight, onSwipeDown])

  useEffect(() => {
    if (!enabled) return
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enabled, handleTouchStart, handleTouchEnd])
}
