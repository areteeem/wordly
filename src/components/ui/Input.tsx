import React from 'react'
import { wobbly } from '../../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`w-full font-body bg-white dark:bg-paper-dark text-pencil dark:text-pencil-dark border-2 border-pencil dark:border-pencil-dark px-4 py-2 text-lg placeholder:text-pencil/40 dark:placeholder:text-pencil-dark/40 focus:border-pen focus:ring-2 focus:ring-pen/20 outline-none transition-colors ${className}`}
      style={{ borderRadius: wobbly }}
      {...props}
    />
  )
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function TextArea({ className = '', ...props }: TextAreaProps) {
  return (
    <textarea
      className={`w-full font-body bg-white dark:bg-paper-dark text-pencil dark:text-pencil-dark border-2 border-pencil dark:border-pencil-dark px-4 py-2 text-lg placeholder:text-pencil/40 dark:placeholder:text-pencil-dark/40 focus:border-pen focus:ring-2 focus:ring-pen/20 outline-none transition-colors resize-none ${className}`}
      style={{ borderRadius: wobbly }}
      {...props}
    />
  )
}
