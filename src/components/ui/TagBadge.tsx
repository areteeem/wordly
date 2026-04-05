import { X } from 'lucide-react'
import { wobblySmall } from '../../lib/utils'

const TAG_COLORS = [
  '#fde68a', '#bfdbfe', '#bbf7d0', '#fecaca', '#ddd6fe',
  '#fed7aa', '#a5f3fc', '#fbcfe8', '#d9f99d', '#e9d5ff',
]

function tagColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

interface TagBadgeProps {
  label: string
  onRemove?: () => void
  color?: string
}

export function TagBadge({ label, onRemove, color }: TagBadgeProps) {
  const bg = color || tagColor(label)
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-sm font-body border-[2px] border-pencil dark:border-pencil-dark text-pencil dark:text-pencil animate-pop-in"
      style={{ borderRadius: wobblySmall, backgroundColor: bg }}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:text-marker transition-colors"
          aria-label={`Remove tag ${label}`}
        >
          <X size={12} strokeWidth={3} />
        </button>
      )}
    </span>
  )
}
