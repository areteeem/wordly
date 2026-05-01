import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { wobbly } from '../../lib/utils'

interface SelectOption {
  value: string
  label: string
  description?: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  menuClassName?: string
  disabled?: boolean
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  className = '',
  menuClassName = '',
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        className="flex min-w-[140px] items-center justify-between gap-3 border-2 border-pencil bg-white px-3 py-2 font-body text-sm text-pencil outline-none transition-colors hover:bg-erased disabled:cursor-not-allowed disabled:opacity-50 dark:border-pencil-dark dark:bg-paper-dark dark:text-pencil-dark dark:hover:bg-erased-dark"
        style={{ borderRadius: wobbly }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.5}
          className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={`absolute left-0 top-[calc(100%+8px)] z-50 min-w-full border-2 border-pencil bg-white p-1 shadow-hard dark:border-pencil-dark dark:bg-paper-dark dark:shadow-hard-dark ${menuClassName}`}
          style={{ borderRadius: wobbly }}
          role="listbox"
        >
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? 'bg-postit text-pencil dark:bg-erased-dark dark:text-pencil-dark'
                    : 'text-pencil hover:bg-erased dark:text-pencil-dark dark:hover:bg-erased-dark'
                }`}
                style={{ borderRadius: wobbly }}
                role="option"
                aria-selected={isSelected}
              >
                <span>
                  <span className="block font-body text-sm">{option.label}</span>
                  {option.description && (
                    <span className="mt-0.5 block font-body text-xs text-pencil/45 dark:text-pencil-dark/45">
                      {option.description}
                    </span>
                  )}
                </span>
                {isSelected && <Check size={16} strokeWidth={2.5} className="mt-0.5 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}