import React from 'react'
import { wobbly } from '../../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full font-body bg-white dark:bg-paper-dark text-pencil dark:text-pencil-dark border-2 border-pencil dark:border-pencil-dark px-4 py-2 text-lg placeholder:text-pencil/40 dark:placeholder:text-pencil-dark/40 focus:border-pen focus:ring-2 focus:ring-pen/20 outline-none transition-colors ${className}`}
      style={{ borderRadius: wobbly }}
      {...props}
    />
  )
})

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className = '', ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`w-full font-body bg-white dark:bg-paper-dark text-pencil dark:text-pencil-dark border-2 border-pencil dark:border-pencil-dark px-4 py-2 text-lg placeholder:text-pencil/40 dark:placeholder:text-pencil-dark/40 focus:border-pen focus:ring-2 focus:ring-pen/20 outline-none transition-colors resize-none ${className}`}
      style={{ borderRadius: wobbly }}
      {...props}
    />
  )
})
