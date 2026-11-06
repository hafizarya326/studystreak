import { Minus, Plus } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { clsx } from 'clsx'

export function Field({
  label,
  hint,
  children,
  htmlFor,
  className,
}: {
  label?: string
  hint?: ReactNode
  children: ReactNode
  htmlFor?: string
  className?: string
}) {
  return (
    <div className={className}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('input', className)} {...rest} />
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx('input cursor-pointer appearance-none bg-no-repeat pr-9', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23858585' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.75rem center',
      }}
      {...rest}
    >
      {children}
    </select>
  )
}

export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 600,
  step = 1,
  suffix,
  ariaLabel,
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  ariaLabel?: string
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel ?? ''}`}
        onClick={() => onChange(clamp(value - step))}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-ink transition hover:bg-subtle"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="flex h-10 min-w-[4.5rem] flex-1 items-center justify-center gap-1 rounded-xl border border-line bg-card tabular-nums">
        <span className="font-display text-base font-bold text-ink">{value}</span>
        {suffix ? <span className="text-xs text-muted">{suffix}</span> : null}
      </div>
      <button
        type="button"
        aria-label={`Increase ${ariaLabel ?? ''}`}
        onClick={() => onChange(clamp(value + step))}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-ink transition hover:bg-subtle"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
