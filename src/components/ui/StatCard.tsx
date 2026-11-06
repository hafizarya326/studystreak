import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { Card } from './Card'
import { ProgressBar } from './ProgressBar'

export function StatCard({
  label,
  value,
  suffix,
  icon,
  hint,
  tone = 'sage',
  progress,
  className,
}: {
  label: string
  value: ReactNode
  suffix?: string
  icon?: ReactNode
  hint?: ReactNode
  tone?: 'sage' | 'coral' | 'neutral' | 'success'
  /** optional 0-100 additional progress bar */
  progress?: number
  className?: string
}) {
  const iconTone =
    tone === 'coral'
      ? 'bg-coral/12 text-coral-600'
      : tone === 'success'
        ? 'bg-success/15 text-success'
        : tone === 'neutral'
          ? 'bg-subtle text-muted'
          : 'bg-sage/12 text-sage-700'

  return (
    <Card className={clsx('card-pad animate-fade-up', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        {icon ? (
          <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', iconTone)}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex min-w-0 items-baseline gap-1.5">
        <span className="min-w-0 truncate font-display text-3xl font-bold leading-none text-ink">{value}</span>
        {suffix ? <span className="shrink-0 text-sm font-medium text-muted">{suffix}</span> : null}
      </div>
      {progress !== undefined ? <ProgressBar value={progress} className="mt-3" tone={tone === 'coral' ? 'coral' : 'sage'} size="sm" /> : null}
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </Card>
  )
}
