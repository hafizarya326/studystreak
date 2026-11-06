import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Snowflake, Flame } from 'lucide-react'
import { clsx } from 'clsx'
import { useData } from '../../context/DataContext'
import { LEVELS, levelClass } from './levels'
import { addMonths, formatDuration, monthLabel, monthMatrix, toDayKey, todayKey } from '../../lib/date'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function MonthCalendar() {
  const { stats, streak } = useData()
  const now = new Date()
  const [view, setView] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [selected, setSelected] = useState<string | null>(todayKey())

  const cells = useMemo(() => monthMatrix(view.getFullYear(), view.getMonth()), [view])
  const freezeSet = useMemo(() => new Set(streak.freezeDays), [streak.freezeDays])
  const today = todayKey()
  const monthPrefix = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, '0')}`

  const monthTotals = useMemo(() => {
    let sec = 0
    let days = 0
    let sessions = 0
    for (const [key, value] of Object.entries(stats.focusSecByDay)) {
      if (key.startsWith(monthPrefix)) {
        sec += value
        days++
      }
    }
    for (const [key, value] of Object.entries(stats.sessionsByDay)) {
      if (key.startsWith(monthPrefix)) sessions += value
    }
    return { sec, days, sessions }
  }, [stats.focusSecByDay, stats.sessionsByDay, monthPrefix])

  const isCurrentMonth = view.getFullYear() === now.getFullYear() && view.getMonth() === now.getMonth()
  const canGoNext = view.getTime() < new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  const selectedSec = selected ? stats.focusSecByDay[selected] ?? 0 : 0
  const selectedSessions = selected ? stats.sessionsByDay[selected] ?? 0 : 0
  const selectedIsFreeze = selected ? freezeSet.has(selected) : false

  return (
    <div className="card card-pad">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage/12 text-sage-700">
            <CalendarDays className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h3 className="font-display text-base font-bold text-ink">{monthLabel(view)}</h3>
            <p className="text-xs text-muted">
              {formatDuration(monthTotals.sec)} studied · {monthTotals.days} active day
              {monthTotals.days === 1 ? '' : 's'} · {monthTotals.sessions} session
              {monthTotals.sessions === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!isCurrentMonth ? (
            <button
              type="button"
              onClick={() => setView(new Date(now.getFullYear(), now.getMonth(), 1))}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-sage-700 transition hover:bg-sage/10"
            >
              Today
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setView((v) => addMonths(v, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card text-ink transition hover:bg-subtle"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => setView((v) => addMonths(v, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card text-ink transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
            {d.slice(0, 1)}
            <span className="hidden sm:inline">{d.slice(1)}</span>
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="aspect-square" />
          const key = toDayKey(date)
          const sec = stats.focusSecByDay[key] ?? 0
          const isToday = key === today
          const isFreeze = freezeSet.has(key)
          const isSelected = key === selected
          const isFuture = key > today
          return (
            <div key={key} className="group relative">
              <button
                type="button"
                onClick={() => setSelected(key)}
                title={`${key} · ${sec > 0 ? formatDuration(sec) : 'No study'}`}
                className={clsx(
                  'flex aspect-square w-full flex-col items-center justify-center rounded-lg border text-xs font-medium transition',
                  isFuture
                    ? 'border-transparent bg-transparent text-muted/40'
                    : isFreeze
                      ? 'border-dashed border-coral/60 bg-coral/[0.08] text-coral-600'
                      : `border-transparent ${levelClass(sec)} ${sec > 0 ? 'text-ink/80' : 'text-muted'}`,
                  isToday && 'ring-2 ring-coral/50 ring-offset-1 ring-offset-card',
                  isSelected && 'ring-2 ring-sage ring-offset-1 ring-offset-card',
                )}
              >
                <span className="leading-none">{date.getDate()}</span>
                {sec > 0 ? <span className="mt-0.5 hidden h-1 w-1 rounded-full bg-ink/30 sm:block" /> : null}
              </button>
              {levelFor(sec) >= 3 && !isFuture ? (
                <Flame size={11} className="absolute right-1 top-1 text-coral/70" />
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <span>Less</span>
        {LEVELS.map((l) => (
          <span key={l.level} className="flex items-center gap-1.5">
            <span className={clsx('h-3.5 w-3.5 rounded', l.className)} />
          </span>
        ))}
        <span>More</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded border border-dashed border-coral/60 bg-coral/10" />
          Streak Freeze
        </span>
      </div>

      {/* Selected day detail */}
      {selected ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-subtle/70 p-3.5 text-sm">
          <div>
            <p className="text-xs text-muted">
              {new Date(selected + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="font-display text-base font-bold text-ink">
              {selectedSec > 0 ? formatDuration(selectedSec) : 'No study recorded'}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            {selectedSessions > 0 ? (
              <span className="chip">
                {selectedSessions} session{selectedSessions === 1 ? '' : 's'}
              </span>
            ) : null}
            {selectedIsFreeze ? (
              <span className="chip !border-coral/40 !text-coral-600">
                <Snowflake className="h-3 w-3" /> Freeze protected
              </span>
            ) : null}
            {selectedSec >= 60 ? (
              <span className="chip !border-sage/40 !text-sage-700">
                <Flame size={12} className="text-coral" /> Counted for streak
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function levelFor(sec: number): number {
  if (sec >= 7200) return 4
  if (sec >= 3600) return 3
  if (sec >= 1800) return 2
  if (sec > 0) return 1
  return 0
}
