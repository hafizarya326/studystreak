import { Snowflake, Trophy } from 'lucide-react'
import { clsx } from 'clsx'
import { useData } from '../../context/DataContext'
import { Flame } from './Flame'
import { ProgressBar } from '../ui/ProgressBar'
import { streakNudge } from '../../lib/quotes'
import { nextMilestone } from '../../lib/streak'
import { Badge } from '../ui/Badge'

export function StreakCard({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { streak } = useData()
  const upcoming = nextMilestone(streak.current)
  const milestoneProgress = upcoming
    ? Math.min(100, Math.round((streak.current / upcoming.days) * 100))
    : 100

  const nudge = streakNudge({
    current: streak.current,
    studiedToday: streak.studiedToday,
    atRisk: streak.atRisk,
    freezesAvailable: streak.freezesAvailable,
  })

  return (
    <div
      className={clsx(
        '@container relative overflow-hidden rounded-2xl border border-coral/25 bg-card shadow-card',
        compact ? 'p-5' : 'card-pad',
        className,
      )}
    >
      {/* Warm glow accent */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-coral/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 @2xl:flex-row @2xl:items-center">
        <div className="flex items-center gap-4">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-coral/12">
            <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-coral/20" aria-hidden />
            <Flame size={compact ? 38 : 44} glow />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-5xl font-extrabold leading-none text-coral-600 tabular-nums">
                {streak.current}
              </span>
              <span className="text-sm font-semibold text-muted">day{streak.current === 1 ? '' : 's'}</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-ink">Days in a Row</p>
            <div className="mt-2">
              {streak.studiedToday ? (
                <Badge tone="sage" className="!bg-sage/12 !text-sage-700">
                  ✓ Today counted
                </Badge>
              ) : streak.current > 0 ? (
                <Badge tone="coral">Study today to keep it</Badge>
              ) : (
                <Badge tone="neutral">Start your streak</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="hidden h-16 w-px shrink-0 bg-line @2xl:block" />

        <div className="grid min-w-0 flex-1 grid-cols-3 gap-2.5">
          <Stat label="Longest" value={`${streak.longest}`} suffix="days" icon={<Trophy className="h-3.5 w-3.5" />} />
          <Stat
            label="Freezes"
            value={`${streak.freezesAvailable}`}
            suffix="ready"
            icon={<Snowflake className="h-3.5 w-3.5 text-sage-700" />}
          />
          <Stat label="Study days" value={`${streak.totalStudyDays}`} suffix="total" />
        </div>
      </div>

      <div className="relative mt-5 rounded-xl bg-subtle/70 p-3.5">
        <p className="text-xs leading-relaxed text-muted">{nudge}</p>
        {upcoming && streak.current > 0 ? (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted">
              <span>
                Next: {upcoming.days}-day — {upcoming.label}
              </span>
              <span className="tabular-nums">
                {streak.current}/{upcoming.days}
              </span>
            </div>
            <ProgressBar value={milestoneProgress} tone="coral" size="sm" />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  suffix,
  icon,
}: {
  label: string
  value: string
  suffix?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-card/60 p-2.5">
      <div className="flex min-w-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 flex min-w-0 items-baseline gap-1">
        <span className="font-display text-lg font-bold leading-none text-ink tabular-nums">{value}</span>
        {suffix ? <span className="truncate text-[10px] text-muted">{suffix}</span> : null}
      </div>
    </div>
  )
}
