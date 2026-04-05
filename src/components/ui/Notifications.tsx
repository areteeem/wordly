import { useSettingsStore } from '../../stores/settingsStore'
import { X, Check, Info, AlertTriangle } from 'lucide-react'
import { wobbly } from '../../lib/utils'

export function Notifications() {
  const notifications = useSettingsStore((s) => s.notifications)
  const dismiss = useSettingsStore((s) => s.dismissNotification)

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {notifications.map((n) => {
        const icon =
          n.type === 'success' ? (
            <Check size={16} strokeWidth={3} className="text-green-600" />
          ) : n.type === 'error' ? (
            <AlertTriangle size={16} strokeWidth={3} className="text-marker" />
          ) : (
            <Info size={16} strokeWidth={3} className="text-pen" />
          )

        return (
          <div
            key={n.id}
            className="flex items-center gap-2 bg-white dark:bg-paper-dark border-[3px] border-pencil dark:border-pencil-dark px-4 py-2 shadow-hard dark:shadow-hard-dark animate-slide-in-right font-body text-base text-pencil dark:text-pencil-dark"
            style={{ borderRadius: wobbly }}
          >
            {icon}
            <span className="flex-1">{n.message}</span>
            <button
              onClick={() => dismiss(n.id)}
              className="text-pencil/40 hover:text-marker"
            >
              <X size={14} strokeWidth={3} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
