import { useEffect, useRef } from 'react'
import { BookOpen, Coffee, Sparkles, Target } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { TimerPanel } from '../components/timer/TimerPanel'
import { SoundCard } from '../components/timer/SoundCard'
import { StreakCard } from '../components/streak/StreakCard'
import { ProgressBar } from '../components/ui/ProgressBar'
import { useTimer } from '../context/TimerContext'
import { useSettings } from '../context/SettingsContext'
import { useData } from '../context/DataContext'
import { formatDuration } from '../lib/date'
import { goalProgress } from '../lib/stats'

const KEYBOARD_HINTS = [
  { keys: 'Space', label: 'Start / Pause' },
  { keys: 'R', label: 'Reset' },
  { keys: 'S', label: 'Skip session' },
]

export function TimerPage() {
  const timer = useTimer()
  const { settings } = useSettings()
  const { stats, today } = useData()

  const timerRef = useRef(timer)
  useEffect(() => {
    timerRef.current = timer
  })

  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const node = el as HTMLElement | null
      if (!node) return false
      return (
        node.tagName === 'INPUT' ||
        node.tagName === 'TEXTAREA' ||
        node.tagName === 'SELECT' ||
        node.isContentEditable
      )
    }
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      if (e.code === 'Space') {
        e.preventDefault()
        timerRef.current.toggle()
      } else if (e.key === 'r' || e.key === 'R') {
        timerRef.current.reset()
      } else if (e.key === 's' || e.key === 'S') {
        timerRef.current.skip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const dailyGoal = goalProgress(stats.todaySec, settings.dailyGoalMin * 60)
  const sessionsToday = stats.sessionsByDay[today] ?? 0

  return (
    <div>
      <PageHeader
        title="Study Timer"
        description="The pomodoro technique: focus deeply, then rest. Your timer keeps running even if you switch tabs or refresh."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="card-pad">
            <TimerPanel />
          </Card>

          <Card className="card-pad">
            <CardHeader title="Today at a glance" icon={<Target className="h-[18px] w-[18px]" />} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-subtle/50 p-4">
                <p className="text-xs font-medium text-muted">Focused time</p>
                <p className="mt-1 font-display text-2xl font-bold text-ink">
                  {formatDuration(stats.todaySec)}
                </p>
                <ProgressBar value={dailyGoal.pct} className="mt-3" tone={dailyGoal.done ? 'success' : 'sage'} />
                <p className="mt-2 text-[11px] text-muted">
                  {dailyGoal.done
                    ? 'Goal complete — brilliant.'
                    : `${formatDuration(dailyGoal.remaining)} to your ${formatDuration(settings.dailyGoalMin * 60)} goal`}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-subtle/50 p-4">
                <p className="text-xs font-medium text-muted">Sessions completed today</p>
                <p className="mt-1 font-display text-2xl font-bold text-ink">
                  {sessionsToday}
                  <span className="ml-1 text-sm font-medium text-muted">/ {settings.dailySessionGoal}</span>
                </p>
                <ProgressBar
                  value={Math.min(100, (sessionsToday / Math.max(1, settings.dailySessionGoal)) * 100)}
                  className="mt-3"
                />
                <p className="mt-2 text-[11px] text-muted">
                  {timer.pomodorosCompleted} pomodoro{timer.pomodorosCompleted === 1 ? '' : 's'} this session cycle
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <StreakCard compact />

          <SoundCard />

          <Card className="card-pad">
            <CardHeader title="How it works" icon={<BookOpen className="h-[18px] w-[18px]" />} />
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sage/12 text-sage-700">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <p className="text-muted">
                  Complete a full focus session of at least{' '}
                  <span className="font-medium text-ink">{formatDuration(settings.minQualifyingSec)}</span> to
                  count the day toward your streak.
                </p>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sage/12 text-sage-700">
                  <Coffee className="h-3.5 w-3.5" />
                </span>
                <p className="text-muted">
                  After {settings.longBreakInterval} focus blocks you earn a longer break. Breaks never count
                  toward streaks.
                </p>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-coral/12 text-coral-600">
                  <Target className="h-3.5 w-3.5" />
                </span>
                <p className="text-muted">
                  Skipping or abandoning a session records nothing — only completed focus sessions count.
                </p>
              </li>
            </ul>

            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Keyboard</p>
              <div className="flex flex-wrap gap-2">
                {KEYBOARD_HINTS.map((k) => (
                  <span key={k.keys} className="chip">
                    <kbd className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink">
                      {k.keys}
                    </kbd>
                    {k.label}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
