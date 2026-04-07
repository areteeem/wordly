import { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'
import { wobblyMd } from '../../lib/utils'

interface KeyboardShortcutsProps {
  open: boolean
  onClose: () => void
}

const shortcuts = [
  { category: 'General', items: [
    { keys: 'Ctrl + K', action: 'Command Palette' },
    { keys: 'Ctrl + N', action: 'New Document' },
    { keys: 'Ctrl + ,', action: 'Settings' },
    { keys: 'Ctrl + Shift + F', action: 'Toggle Folders Sidebar' },
    { keys: 'Ctrl + Shift + V', action: 'Toggle Vocabulary Sidebar' },
    { keys: 'Ctrl + Shift + B', action: 'Vocabulary Full Screen' },
    { keys: 'Ctrl + Shift + E', action: 'Export Dialog' },
    { keys: 'Ctrl + Shift + X', action: 'Exercise Mode' },
    { keys: '?', action: 'Keyboard Shortcuts Help' },
    { keys: 'Escape', action: 'Close Modal / Popup' },
  ]},
  { category: 'Text Editing', items: [
    { keys: 'Ctrl + B', action: 'Bold' },
    { keys: 'Ctrl + I', action: 'Italic' },
    { keys: 'Ctrl + U', action: 'Underline' },
    { keys: 'Ctrl + Shift + S', action: 'Strikethrough' },
    { keys: 'Ctrl + Shift + H', action: 'Highlight' },
    { keys: 'Ctrl + Z', action: 'Undo' },
    { keys: 'Ctrl + Shift + Z', action: 'Redo' },
  ]},
  { category: 'Vocabulary', items: [
    { keys: 'Select text', action: 'Show add-to-vocabulary popup' },
    { keys: 'Double-click word', action: 'Edit word/translation inline' },
  ]},
]

export function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-pencil/20 dark:bg-black/40" onClick={onClose} />
      <div
        className="relative bg-paper dark:bg-paper-dark border-[3px] border-pencil dark:border-pencil-dark w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-hard-lg dark:shadow-hard-lg-dark animate-pop-in z-50"
        style={{ borderRadius: wobblyMd }}
      >
        <div className="flex items-center justify-between p-5 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
          <div className="flex items-center gap-2" style={{ transform: 'rotate(-1deg)' }}>
            <Keyboard size={24} strokeWidth={2.5} className="text-pencil dark:text-pencil-dark" />
            <h2 className="font-heading text-3xl text-pencil dark:text-pencil-dark">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="text-pencil/60 hover:text-marker">
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {shortcuts.map(({ category, items }) => (
            <div key={category}>
              <h3 className="font-heading text-lg text-pencil dark:text-pencil-dark mb-2 border-b border-dashed border-pencil/15 pb-1">
                {category}
              </h3>
              <div className="space-y-1.5">
                {items.map(({ keys, action }) => (
                  <div key={keys} className="flex items-center justify-between">
                    <span className="font-body text-sm text-pencil/70 dark:text-pencil-dark/70">{action}</span>
                    <div className="flex items-center gap-1">
                      {keys.split(' + ').map((key, i, arr) => (
                        <span key={i} className="flex items-center gap-1">
                          <kbd className="font-mono text-xs bg-erased dark:bg-erased-dark px-2 py-0.5 rounded border border-pencil/20 dark:border-pencil-dark/20 text-pencil dark:text-pencil-dark">
                            {key}
                          </kbd>
                          {i < arr.length - 1 && <span className="text-pencil/30 text-xs">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
