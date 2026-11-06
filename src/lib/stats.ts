import type { Stats, StudySession } from '../types'
import {
  addDays,
  addMonths,
  dayDiff,
  formatDayKeyLabel,
  startOfDay,
  startOfWeek,
  toDayKey,
} from './date'

export function isFocusSession(s: StudySession): boolean {
  return s.completed && s.type === 'focus' && s.durationSec > 0
}

/** A session counts toward the streak only if it was a real, long-enough focus block. */
export function isQualifyingSession(s: StudySession, minSec: number): boolean {
  return isFocusSession(s) && s.durationSec >= Math.max(0, minSec)
}

/** Set of local calendar days with at least one qualifying focus session. */
export function qualifyingDayKeys(sessions: StudySession[], minSec: number): Set<string> {
  const days = new Set<string>()
  for (const s of sessions) {
    if (isQualifyingSession(s, minSec)) days.add(toDayKey(s.startedAt))
  }
  return days
}

function sumRange(
  byDay: Record<string, number>,
  keys: Iterable<string>,
): number {
  let total = 0
  for (const k of keys) total += byDay[k] ?? 0
  return total
}

export function computeStats(sessions: StudySession[]): Stats {
  const focus = sessions.filter(isFocusSession)
  const focusSecByDay: Record<string, number> = {}
  const sessionsByDay: Record<string, number> = {}
  const subjectMap = new Map<string, { sec: number; sessions: number }>()
  let totalFocusSec = 0
  let longestSessionSec = 0

  let firstTs: number | null = null
  let lastTs: number | null = null

  for (const s of focus) {
    const key = toDayKey(s.startedAt)
    focusSecByDay[key] = (focusSecByDay[key] ?? 0) + s.durationSec
    sessionsByDay[key] = (sessionsByDay[key] ?? 0) + 1
    totalFocusSec += s.durationSec
    longestSessionSec = Math.max(longestSessionSec, s.durationSec)

    const subj = s.subject?.trim() || 'General'
    const entry = subjectMap.get(subj) ?? { sec: 0, sessions: 0 }
    entry.sec += s.durationSec
    entry.sessions += 1
    subjectMap.set(subj, entry)

    if (firstTs === null || s.startedAt < firstTs) firstTs = s.startedAt
    if (lastTs === null || s.startedAt > lastTs) lastTs = s.startedAt
  }

  const now = new Date()
  const today = toDayKey(now)

  const todaySec = focusSecByDay[today] ?? 0
  const yesterdaySec = focusSecByDay[toDayKey(addDays(now, -1))] ?? 0

  // This week (Mon–Sun) and last week.
  const weekStart = startOfWeek(now)
  const weekKeys = Array.from({ length: 7 }, (_, i) => toDayKey(addDays(weekStart, i)))
  const lastWeekKeys = Array.from({ length: 7 }, (_, i) =>
    toDayKey(addDays(addDays(weekStart, -7), i)),
  )
  const weekSec = sumRange(focusSecByDay, weekKeys)
  const lastWeekSec = sumRange(focusSecByDay, lastWeekKeys)

  // Rolling 7-day series ending today (used in the dashboard chart).
  const weeklySeries = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(now, -(6 - i))
    const key = toDayKey(d)
    return {
      key,
      label: formatDayKeyLabel(key, { weekday: 'short' }),
      sec: focusSecByDay[key] ?? 0,
      sessions: sessionsByDay[key] ?? 0,
    }
  })

  // Rolling 30-day series (used in the history/trend views).
  const daySeries = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(now, -(29 - i))
    const key = toDayKey(d)
    return {
      key,
      label: formatDayKeyLabel(key, { day: 'numeric', month: 'short' }),
      sec: focusSecByDay[key] ?? 0,
      sessions: sessionsByDay[key] ?? 0,
    }
  })

  // Last 6 months.
  const monthlySeries = Array.from({ length: 6 }, (_, i) => {
    const d = addMonths(now, -(5 - i))
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    let sec = 0
    let sessions2 = 0
    for (const [k, v] of Object.entries(focusSecByDay)) {
      if (k.startsWith(prefix)) sec += v
    }
    for (const [k, v] of Object.entries(sessionsByDay)) {
      if (k.startsWith(prefix)) sessions2 += v
    }
    return {
      key: prefix,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      sec,
      hours: Number((sec / 3600).toFixed(1)),
    }
  })

  const monthPrefix = today.slice(0, 7)
  let monthSec = 0
  for (const [k, v] of Object.entries(focusSecByDay)) if (k.startsWith(monthPrefix)) monthSec += v

  const bestEntry = Object.entries(focusSecByDay).sort((a, b) => b[1] - a[1])[0]

  let activeDays = 0
  for (const v of Object.values(focusSecByDay)) if (v > 0) activeDays++

  // Consistency = study days / elapsed days since first study day.
  let consistency = 0
  if (firstTs !== null) {
    const span = Math.max(1, dayDiff(startOfDay(firstTs), startOfDay(now)) + 1)
    consistency = Math.min(100, Math.round((activeDays / span) * 100))
  }

  const subjects = Array.from(subjectMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.sec - a.sec)

  return {
    totalSessions: focus.length,
    totalFocusSec,
    totalHours: totalFocusSec / 3600,
    todaySec,
    yesterdaySec,
    weekSec,
    lastWeekSec,
    monthSec,
    avgSessionSec: focus.length ? Math.round(totalFocusSec / focus.length) : 0,
    longestSessionSec,
    activeDays,
    consistency,
    bestDayKey: bestEntry ? bestEntry[0] : null,
    bestDaySec: bestEntry ? bestEntry[1] : 0,
    focusSecByDay,
    sessionsByDay,
    weeklySeries,
    monthlySeries,
    daySeries,
    subjects,
    // minSec kept out of the shape; callers pass it when filtering.
  }
}

/** Goal progress helper. */
export function goalProgress(current: number, goal: number) {
  const safeGoal = Math.max(1, goal)
  const pct = Math.min(100, Math.round((current / safeGoal) * 100))
  return {
    pct,
    remaining: Math.max(0, safeGoal - current),
    done: current >= safeGoal,
  }
}
