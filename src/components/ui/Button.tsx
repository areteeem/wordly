import React from 'react'
import { wobbly } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'font-body cursor-pointer border-pencil dark:border-pencil-dark transition-all duration-100 btn-press select-none inline-flex items-center justify-center gap-2'

  const variants = {
    primary:
      'bg-white dark:bg-paper-dark border-[3px] text-pencil dark:text-pencil-dark shadow-hard dark:shadow-hard-dark hover:bg-marker hover:text-white hover:shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px]',
    secondary:
      'bg-erased dark:bg-erased-dark border-[3px] text-pencil dark:text-pencil-dark shadow-hard dark:shadow-hard-dark hover:bg-pen hover:text-white hover:shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px]',
    ghost:
      'border-2 border-dashed bg-transparent text-pencil dark:text-pencil-dark hover:bg-erased/50 dark:hover:bg-erased-dark/50',
  }

  const sizes = {
    sm: 'text-sm px-3 py-1',
    md: 'text-lg px-5 py-2',
    lg: 'text-2xl px-7 py-3',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      style={{ borderRadius: wobbly }}
      {...props}
    >
      {children}
    </button>
  )
}
