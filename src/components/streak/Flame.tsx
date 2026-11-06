import { Flame as FlameIcon } from 'lucide-react'
import { clsx } from 'clsx'

/**
 * The streak flame. Coral is reserved for streak + special achievements, so
 * every flame in the app flows through this component.
 */
export function Flame({
  size = 24,
  className,
  animated = true,
  glow = false,
}: {
  size?: number
  className?: string
  animated?: boolean
  glow?: boolean
}) {
  return (
    <span className={clsx('relative inline-flex', className)}>
      {glow ? (
        <span className="absolute inset-0 -z-10 animate-pulse rounded-full bg-coral/30 blur-md" aria-hidden />
      ) : null}
      <FlameIcon
        size={size}
        strokeWidth={2.1}
        className={clsx('text-coral', animated && 'animate-flicker')}
        fill="currentColor"
        fillOpacity={0.28}
      />
    </span>
  )
}
