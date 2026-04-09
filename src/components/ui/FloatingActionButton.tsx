import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, FileText, Import } from 'lucide-react'

interface FABProps {
  onAddWord: () => void
  onNewDocument: () => void
  onImport: () => void
}

export function FloatingActionButton({ onAddWord, onNewDocument, onImport }: FABProps) {
  const [open, setOpen] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)

  const handleToggle = useCallback(() => setOpen(p => !p), [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: Event) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  return (
    <>
      {/* Secondary actions */}
      {open && (
        <div className="fab-actions" style={{ bottom: 132, right: 20 }}>
          <button
            onClick={() => { onNewDocument(); setOpen(false) }}
            className="bg-white dark:bg-paper-dark text-pen animate-fab-expand"
            style={{ animationDelay: '50ms' }}
            aria-label="New document"
          >
            <FileText size={20} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => { onImport(); setOpen(false) }}
            className="bg-white dark:bg-paper-dark text-pen animate-fab-expand"
            style={{ animationDelay: '100ms' }}
            aria-label="Import vocabulary"
          >
            <Import size={20} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Primary FAB */}
      <button
        ref={fabRef}
        className="fab-button"
        style={{
          bottom: 72,
          right: 20,
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
        onClick={handleToggle}
        aria-label={open ? 'Close menu' : 'Quick actions'}
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>
    </>
  )
}
