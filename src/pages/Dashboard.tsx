import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Clock,
  Flame as FlameIcon,
  History as HistoryIcon,
  Quote,
  Sparkles,
  Target,
  Timer as TimerIcon,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { StreakCard } from '../components/streak/StreakCard'
import { TimerPanel } from '../components/timer/TimerPanel'
import { Heatmap } from '../components/calendar/Heatmap'
import { WeeklyChart } from '../components/charts/Charts'
import { AchievementCard } from '../components/achievements/AchievementCard'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { formatDuration, formatTimeOfDay, relativeDayLabel, toDayKey } from '../lib/date'
import { quoteOfTheDay } from '../lib/quotes'
import { goalProgress } from '../lib/stats'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function Dashboard() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const { stats, streak, achievements, sessions, today } = useData()
  const quote = quoteOfTheDay()

  const dailyGoalSec = settings.dailyGoalMin * 60
  const weeklyGoalSec = settings.weeklyGoalMin * 60
  const daily = goalProgress(stats.todaySec, dailyGoalSec)
  const weekly = goalProgress(stats.weekSec, weeklyGoalSec)
  const sessionsToday = stats.sessionsByDay[today] ?? 0
  const sessionGoal = goalProgress(sessionsToday, settings.dailySessionGoal)

  const preview = [...achievements]
    .sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
      if (a.unlocked && b.unlocked) return (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0)
      return b.pct - a.pct
    })
    .slice(0, 4)

  const recent = sessions.slice(0, 5)
  const weekDelta =
    stats.lastWeekSec > 0
      ? Math.round(((stats.weekSec - stats.lastWeekSec) / stats.lastWeekSec) * 100)
      : null

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(' ')[0] ?? 'student'}`}
        description="Here is your study overview. One focus session keeps the streak alive."
        action={
          <Link to="/timer">
            <Button leftIcon={<Sparkles className="h-4 w-4" />}>Start a session</Button>
          </Link>
        }
      />

      {/* Welcome banner */}
      <Card className="relative mb-5 overflow-hidden border-sage/25 bg-gradient-to-br from-sage/[0.08] to-card p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sage/10 blur-2xl" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sage/15 text-sage-700">
              <Quote className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-base font-semibold text-ink">“{quote.text}”</p>
              <p className="mt-1 text-xs text-muted">— {quote.author} · Quote of the day</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
            <Clock className="h-4 w-4" />
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-2">
          <StreakCard />

          <Card className="card-pad">
            <CardHeader
              title="Focus timer"
              subtitle="Pick a mode, choose your subject, and start focusing."
              icon={<TimerIcon className="h-[18px] w-[18px]" />}
              action={
                <Link to="/timer" className="text-xs font-semibold text-sage-700 hover:underline">
                  Full timer
                </Link>
              }
            />
            <div className="mt-5">
              <TimerPanel compact showSetup={false} />
            </div>
            <div className="mt-6 rounded-xl border border-line bg-subtle/60 p-3.5">
              <div className="mb-2 flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-muted">
                  <Target className="h-3.5 w-3.5" /> Today&apos;s goal
                </span>
                <span className="tabular-nums text-ink">
                  {formatDuration(stats.todaySec)} / {formatDuration(dailyGoalSec)}
                </span>
              </div>
              <ProgressBar value={daily.pct} tone={daily.done ? 'success' : 'sage'} />
              <p className="mt-2 text-[11px] text-muted">
                {daily.done
                  ? 'Daily goal reached — anything more is a bonus. 🎉'
                  : `${formatDuration(daily.remaining)} left to hit today's goal.`}
              </p>
            </div>
          </Card>

          <Card className="card-pad">
            <CardHeader
              title="This week"
              subtitle={`${formatDuration(stats.weekSec)} studied over the last 7 days`}
              icon={<TrendingUp className="h-[18px] w-[18px]" />}
              action={
                weekDelta !== null ? (
                  <Badge tone={weekDelta >= 0 ? 'sage' : 'neutral'}>
                    {weekDelta >= 0 ? '+' : ''}
                    {weekDelta}% vs last week
                  </Badge>
                ) : null
              }
            />
            <div className="mt-4">
              <WeeklyChart data={stats.weeklySeries} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
              <div>
                <p className="font-display text-lg font-bold text-ink">
                  {stats.weeklySeries.reduce((a, d) => a + d.sessions, 0)}
                </p>
                <p className="text-[11px] text-muted">sessions this week</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-ink">
                  {formatDuration(
                    Math.round(
                      stats.weeklySeries.reduce((a, d) => a + d.sec, 0) /
                        Math.max(1, stats.weeklySeries.filter((d) => d.sec > 0).length),
                    ),
                  )}
                </p>
                <p className="text-[11px] text-muted">avg per active day</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-ink">
                  {stats.weeklySeries.reduce((best, d) => (d.sec > best.sec ? d : best), stats.weeklySeries[0])
                    ?.label ?? '—'}
                </p>
                <p className="text-[11px] text-muted">best day</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Today"
              value={formatDuration(stats.todaySec)}
              icon={<Clock className="h-4 w-4" />}
              tone="sage"
            />
            <StatCard
              label="Sessions"
              value={stats.totalSessions}
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone="success"
            />
            <StatCard
              label="Total hours"
              value={stats.totalHours.toFixed(1)}
              suffix="h"
              icon={<HistoryIcon className="h-4 w-4" />}
              tone="neutral"
            />
            <StatCard
              label="Best day"
              value={stats.bestDaySec > 0 ? formatDuration(stats.bestDaySec) : '0m'}
              icon={<FlameIcon className="h-4 w-4" />}
              tone="coral"
            />
          </div>

          <Card className="card-pad">
            <CardHeader title="Goals" subtitle="Daily targets keep the habit sharp" icon={<Target className="h-[18px] w-[18px]" />} />
            <div className="mt-4 space-y-4">
              <GoalRow
                label="Daily study time"
                value={stats.todaySec}
                goal={dailyGoalSec}
                progress={daily}
              />
              <GoalRow label="Weekly study time" value={stats.weekSec} goal={weeklyGoalSec} progress={weekly} />
              <GoalRow
                label="Sessions today"
                value={sessionsToday}
                goal={settings.dailySessionGoal}
                progress={sessionGoal}
                format={(n) => `${n}`}
              />
            </div>
            <Link
              to="/settings"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-sage-700 hover:underline"
            >
              Adjust goals <ArrowRight className="h-3 w-3" />
            </Link>
          </Card>

          <Card className="card-pad">
            <CardHeader
              title="Recent sessions"
              icon={<CalendarRange className="h-[18px] w-[18px]" />}
              action={
                <Link to="/history" className="text-xs font-semibold text-sage-700 hover:underline">
                  View all
                </Link>
              }
            />
            <div className="mt-4">
              {recent.length === 0 ? (
                <EmptyState
                  icon={<Zap className="h-5 w-5" />}
                  title="No sessions yet"
                  description="Finish your first focus session to see it here."
                />
              ) : (
                <ul className="space-y-2.5">
                  {recent.map((s) => (
                    <li key={s.id} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage/12 text-sage-700">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{s.subject}</p>
                        <p className="text-xs text-muted">
                          {relativeDayLabel(toDayKey(s.startedAt))} · {formatTimeOfDay(s.startedAt)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                        {formatDuration(s.durationSec)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card className="card-pad">
            <CardHeader
              title="Achievements"
              subtitle={`${achievements.filter((a) => a.unlocked).length} of ${achievements.length} unlocked`}
              icon={<Trophy className="h-[18px] w-[18px]" />}
              action={
                <Link to="/achievements" className="text-xs font-semibold text-sage-700 hover:underline">
                  See all
                </Link>
              }
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-1">
              {preview.map((a) => (
                <AchievementCard key={a.id} achievement={a} />
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="card-pad mt-5">
        <CardHeader
          title="Study activity"
          subtitle={`${streak.totalStudyDays} study days · ${stats.consistency}% consistency`}
          icon={<CalendarRange className="h-[18px] w-[18px]" />}
          action={
            <Link to="/calendar" className="text-xs font-semibold text-sage-700 hover:underline">
              Open calendar
            </Link>
          }
        />
        <div className="mt-4">
          <Heatmap weeks={20} />
        </div>
      </Card>
    </div>
  )
}

function GoalRow({
  label,
  value,
  goal,
  progress,
  format = (n: number) => formatDuration(n),
}: {
  label: string
  value: number
  goal: number
  progress: { pct: number; remaining: number; done: boolean }
  format?: (n: number) => string
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular-nums text-muted">
          {format(value)} / {format(goal)}
        </span>
      </div>
      <ProgressBar value={progress.pct} tone={progress.done ? 'success' : 'sage'} size="sm" />
    </div>
  )
}
