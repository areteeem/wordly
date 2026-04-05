import React from 'react'
import { wobblyMd } from '../../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  decoration?: 'none' | 'tape' | 'tack'
  highlight?: boolean
}

export function Card({
  decoration = 'none',
  highlight = false,
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`relative bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark p-5 transition-transform duration-100 hover:rotate-[0.5deg] ${highlight ? 'bg-postit' : ''} ${className}`}
      style={{
        borderRadius: wobblyMd,
        boxShadow: '3px 3px 0px 0px rgba(45,45,45,0.1)',
      }}
      {...props}
    >
      {decoration === 'tape' && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-5 bg-pencil/10 dark:bg-pencil-dark/10 rotate-[2deg]"
          style={{ borderRadius: '2px' }}
        />
      )}
      {decoration === 'tack' && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-marker border-2 border-pencil dark:border-pencil-dark shadow-hard-sm" />
      )}
      {children}
    </div>
  )
}
