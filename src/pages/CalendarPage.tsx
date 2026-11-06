import { Snowflake, Sparkles } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { MonthCalendar } from '../components/calendar/MonthCalendar'
import { Heatmap } from '../components/calendar/Heatmap'
import { MonthlyChart } from '../components/charts/Charts'
import { StreakCard } from '../components/streak/StreakCard'
import { StatCard } from '../components/ui/StatCard'
import { Flame } from '../components/streak/Flame'
import { useData } from '../context/DataContext'
import { formatDuration, formatDayKeyLabel } from '../lib/date'
import { FREEZE_EARN_INTERVAL } from '../lib/defaults'

export function CalendarPage() {
  const { stats, streak } = useData()

  return (
    <div>
      <PageHeader
        title="Streak Calendar"
        description="Every square is a day. Darker sage means more focused time — coral marks protected days."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Current streak"
          value={streak.current}
          suffix="days"
          icon={<Flame size={16} />}
          tone="coral"
        />
        <StatCard label="Longest streak" value={streak.longest} suffix="days" tone="sage" />
        <StatCard label="This month" value={formatDuration(stats.monthSec)} tone="sage" />
        <StatCard label="Consistency" value={stats.consistency} suffix="%" tone="neutral" progress={stats.consistency} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthCalendar />
        </div>

        <div className="space-y-5">
          <StreakCard compact />

          <Card className="card-pad">
            <CardHeader
              title="Streak Freeze"
              subtitle="Banked protection for missed days"
              icon={<Snowflake className="h-[18px] w-[18px]" />}
            />
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-sage/25 bg-sage/[0.06] p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-sage-700 shadow-soft">
                <Snowflake className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-2xl font-bold text-ink">
                  {streak.freezesAvailable}
                  <span className="ml-1 text-sm font-medium text-muted">available</span>
                </p>
                <p className="text-xs text-muted">{streak.freezesEarned} earned all-time</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted">
              <li className="flex gap-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage-700" />
                Earn one freeze every {FREEZE_EARN_INTERVAL} consecutive study days.
              </li>
              <li className="flex gap-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage-700" />
                If you miss a day, a freeze is used automatically to protect your streak — once per
                missed day.
              </li>
              <li className="flex gap-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage-700" />
                You can bank up to 3 at a time.
              </li>
            </ul>
            {streak.freezeDays.length > 0 ? (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Protected days
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {streak.freezeDays.slice(-6).map((d) => (
                    <span key={d} className="chip !border-coral/40 !text-coral-600">
                      {formatDayKeyLabel(d, { month: 'short', day: 'numeric' })}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="card-pad">
          <CardHeader title="Monthly progress" subtitle="Total study hours over the last 6 months" />
          <div className="mt-4">
            <MonthlyChart data={stats.monthlySeries} />
          </div>
        </Card>

        <Card className="card-pad">
          <CardHeader title="Past 20 weeks" subtitle="Your long-term study rhythm" />
          <div className="mt-4">
            <Heatmap weeks={20} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
            <div>
              <p className="font-display text-lg font-bold text-ink">{streak.totalStudyDays}</p>
              <p className="text-[11px] text-muted">study days</p>
            </div>
            <div>
              <p className="font-display text-lg font-bold text-ink">{stats.activeDays}</p>
              <p className="text-[11px] text-muted">active days</p>
            </div>
            <div>
              <p className="font-display text-lg font-bold text-ink">{stats.consistency}%</p>
              <p className="text-[11px] text-muted">consistency</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
