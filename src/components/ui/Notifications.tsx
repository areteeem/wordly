import { useSettingsStore } from '../../stores/settingsStore'
import { X, Check, Info, AlertTriangle, Undo2 } from 'lucide-react'
import { useVocabularyStore } from '../../stores/vocabularyStore'
import { wobbly } from '../../lib/utils'

export function Notifications() {
  const notifications = useSettingsStore((s) => s.notifications)
  const dismiss = useSettingsStore((s) => s.dismissNotification)
  const undoDelete = useVocabularyStore((s) => s.undoDelete)
  const lastDeleted = useVocabularyStore((s) => s.lastDeleted)

  if (notifications.length === 0) return null

  // Show max 3 notifications stacked
  const visible = notifications.slice(-3)

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {visible.map((n, i) => {
        const icon =
          n.type === 'success' ? (
            <Check size={16} strokeWidth={3} className="text-green-600" />
          ) : n.type === 'error' ? (
            <AlertTriangle size={16} strokeWidth={3} className="text-marker" />
          ) : (
            <Info size={16} strokeWidth={3} className="text-pen" />
          )

        const isDeleteNotification = n.message.toLowerCase().includes('deleted') && lastDeleted

        return (
          <div
            key={n.id}
            className="relative flex items-center gap-2 bg-white dark:bg-paper-dark border-[3px] border-pencil dark:border-pencil-dark px-4 py-2 shadow-hard dark:shadow-hard-dark animate-slide-in-right font-body text-base text-pencil dark:text-pencil-dark overflow-hidden"
            style={{
              borderRadius: wobbly,
              transform: `translateY(${(visible.length - 1 - i) * -2}px)`,
            }}
          >
            {icon}
            <span className="flex-1 text-sm">{n.message}</span>
            {isDeleteNotification && (
              <button
                onClick={() => { undoDelete(); dismiss(n.id) }}
                className="flex items-center gap-1 text-pen hover:text-marker text-xs font-body px-2 py-0.5 border border-pen/30 rounded transition-colors"
                aria-label="Undo delete"
              >
                <Undo2 size={12} />
                Undo
              </button>
            )}
            <button
              onClick={() => dismiss(n.id)}
              className="text-pencil/40 hover:text-marker transition-colors"
              aria-label="Dismiss notification"
            >
              <X size={14} strokeWidth={3} />
            </button>
            {/* Auto-dismiss progress bar */}
            <div className="notification-progress animate-notification-timer" />
          </div>
        )
      })}
    </div>
  )
}
