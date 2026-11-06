import type { ReactNode } from 'react'
import { clsx } from 'clsx'

type Tone = 'sage' | 'coral' | 'neutral' | 'success' | 'outline'

const TONES: Record<Tone, string> = {
  sage: 'bg-sage/12 text-sage-700 border-transparent',
  coral: 'bg-coral/15 text-coral-600 border-transparent',
  success: 'bg-success/15 text-success border-transparent',
  neutral: 'bg-subtle text-muted border-transparent',
  outline: 'border-line text-muted',
}

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode
  tone?: Tone
  icon?: ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
