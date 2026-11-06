import {
  CalendarCheck,
  Crown,
  Flame,
  Footprints,
  Lock,
  Medal,
  Sprout,
  Star,
  Trophy,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { clsx } from 'clsx'
import { ProgressBar } from '../ui/ProgressBar'
import type { AchievementStatus } from '../../lib/achievements'
import { formatDateLabel } from '../../lib/date'

const ICONS: Record<string, LucideIcon> = {
  footprints: Footprints,
  sprout: Sprout,
  'calendar-check': CalendarCheck,
  medal: Medal,
  crown: Crown,
  trophy: Trophy,
  zap: Zap,
  star: Star,
  flame: Flame,
  waves: Waves,
}

export function AchievementCard({ achievement }: { achievement: AchievementStatus }) {
  const Icon = ICONS[achievement.icon] ?? Trophy
  const { unlocked } = achievement
  const special = achievement.tier === 'gold'

  return (
    <div
      className={clsx(
        'relative flex flex-col gap-3 rounded-2xl border p-4 transition',
        unlocked && 'animate-pop',
        unlocked
          ? special
            ? 'border-coral/30 bg-coral/[0.06]'
            : 'border-sage/30 bg-sage/[0.06]'
          : 'border-line bg-card',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
            unlocked
              ? special
                ? 'bg-coral/15 text-coral-600'
                : 'bg-sage/15 text-sage-700'
              : 'bg-subtle text-muted',
          )}
        >
          {unlocked ? <Icon className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
          {unlocked ? (
            <span
              className={clsx(
                'absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white',
                special ? 'bg-coral' : 'bg-sage',
              )}
            >
              ✓
            </span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={clsx('text-sm font-bold', unlocked ? 'text-ink' : 'text-ink/80')}>
              {achievement.title}
            </h3>
            <span
              className={clsx(
                'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                achievement.tier === 'gold'
                  ? 'bg-coral/15 text-coral-600'
                  : achievement.tier === 'silver'
                    ? 'bg-subtle text-muted'
                    : 'bg-subtle text-muted',
              )}
            >
              {achievement.tier}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{achievement.description}</p>
        </div>
      </div>

      {unlocked ? (
        <p className="text-[11px] font-medium text-sage-700">
          Unlocked {achievement.unlockedAt ? formatDateLabel(achievement.unlockedAt, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
        </p>
      ) : (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
            <span>{achievement.hint}</span>
            <span className="tabular-nums font-medium">
              {Math.min(achievement.value, achievement.target).toFixed(achievement.metric === 'hours' ? 1 : 0)}/
              {achievement.target}
            </span>
          </div>
          <ProgressBar value={achievement.pct} size="sm" tone={special ? 'coral' : 'sage'} />
        </div>
      )}
    </div>
  )
}
