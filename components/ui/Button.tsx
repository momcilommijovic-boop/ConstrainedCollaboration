'use client'

import { useFormStatus } from 'react-dom'

type ButtonVariant = 'primary' | 'ghost' | 'danger'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-near-black text-off-white border border-near-black hover:bg-accent-red hover:border-accent-red',
  ghost:
    'bg-transparent text-near-black border border-near-black hover:bg-near-black hover:text-off-white',
  danger:
    'bg-accent-red text-off-white border border-accent-red hover:bg-near-black hover:border-near-black',
}

export function Button({ variant = 'primary', loading, children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`
        font-mono text-sm px-5 py-2.5 transition-colors duration-100
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${className}
      `}
      {...props}
    >
      {loading ? 'Loading…' : children}
    </button>
  )
}

export function SubmitButton({ children, variant = 'primary', className = '', disabled }: {
  children: React.ReactNode
  variant?: ButtonVariant
  className?: string
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} loading={pending} disabled={pending || disabled} className={className}>
      {children}
    </Button>
  )
}
