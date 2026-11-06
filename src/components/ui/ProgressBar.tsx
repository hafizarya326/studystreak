import { clsx } from 'clsx'

export function ProgressBar({
  value,
  max = 100,
  tone = 'sage',
  size = 'md',
  className,
  showPulse,
}: {
  value: number
  max?: number
  tone?: 'sage' | 'coral' | 'success'
  size?: 'sm' | 'md'
  className?: string
  showPulse?: boolean
}) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0))
  const toneClass =
    tone === 'coral' ? 'bg-coral' : tone === 'success' ? 'bg-success' : 'bg-sage'
  return (
    <div
      className={clsx(
        'relative w-full overflow-hidden rounded-full bg-subtle',
        size === 'sm' ? 'h-1.5' : 'h-2.5',
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={clsx('h-full rounded-full transition-[width] duration-700 ease-out', toneClass)}
        style={{ width: `${pct}%` }}
      />
      {showPulse && pct > 0 && pct < 100 ? (
        <span className={clsx('absolute inset-y-0 rounded-full opacity-30 animate-pulse', toneClass)} style={{ width: `${pct}%` }} />
      ) : null}
    </div>
  )
}
