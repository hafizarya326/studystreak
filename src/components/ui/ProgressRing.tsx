import type { ReactNode } from 'react'
import { clsx } from 'clsx'

/** SVG circular progress ring used by the timer and the consistency metric. */
export function ProgressRing({
  size = 240,
  stroke = 10,
  progress,
  trackClassName = 'stroke-subtle',
  className,
  children,
  gradientFrom = 'rgb(var(--c-sage))',
  gradientTo,
  rounded = true,
}: {
  size?: number
  stroke?: number
  /** 0 → 1 */
  progress: number
  trackClassName?: string
  className?: string
  children?: ReactNode
  gradientFrom?: string
  gradientTo?: string
  rounded?: boolean
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, progress))
  const offset = circumference * (1 - clamped)
  const id = `ring-${Math.round(size)}-${Math.round(stroke)}`
  const useGradient = Boolean(gradientTo)

  return (
    <div className={clsx('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          {useGradient ? (
            <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradientFrom} />
              <stop offset="100%" stopColor={gradientTo} />
            </linearGradient>
          ) : null}
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={useGradient ? `url(#${id})` : gradientFrom}
          strokeLinecap={rounded ? 'round' : 'butt'}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      {children ? <div className="absolute inset-0 flex items-center justify-center">{children}</div> : null}
    </div>
  )
}
