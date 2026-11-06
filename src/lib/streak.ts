/**
 * Streak engine.
 *
 * Design goals:
 *  - Pure + deterministic: recomputed from the session log, so it can never
 *    drift or double-count. The same input always yields the same streak.
 *  - Local timezone calendar days (see lib/date).
 *  - One streak day per calendar day, no matter how many sessions.
 *  - A missed day is bridged by a Streak Freeze when one is banked.
 *  - Freeze usage is derived, so the same missed day can never consume two
 *    freezes and re-renders are idempotent.
 */
import type { StreakMilestone, StreakResult } from '../types'
import { addDays, toDayKey } from './date'
import { FREEZE_EARN_INTERVAL, MAX_STREAK_FREEZES } from './defaults'

export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 1, label: 'First Step!', message: 'Every journey starts with a single session. Welcome aboard.' },
  { days: 3, label: 'Building Momentum!', message: 'Three days in — the habit is starting to take hold.' },
  { days: 7, label: 'One Week Strong!', message: 'A full week of focus. You earned a Streak Freeze for it.' },
  { days: 14, label: 'Consistency Master!', message: 'Two weeks unbroken. This is what consistency feels like.' },
  { days: 30, label: 'Study Legend!', message: 'Thirty days in a row. You are officially a study legend.' },
]

/** Highest milestone reached for a given streak length (or null). */
export function milestoneFor(days: number): StreakMilestone | null {
  let found: StreakMilestone | null = null
  for (const m of STREAK_MILESTONES) if (days >= m.days) found = m
  return found
}

/** The next milestone the user is working toward. */
export function nextMilestone(days: number): StreakMilestone | null {
  return STREAK_MILESTONES.find((m) => m.days > days) ?? null
}

export function milestoneMessage(days: number): string {
  const m = milestoneFor(days)
  return m ? m.message : 'Keep the fire burning — one focused session a day is all it takes.'
}

/**
 * @param studiedDayKeys every calendar day that has >= 1 qualifying focus session
 * @param today the user's local YYYY-MM-DD
 */
export function computeStreak(
  studiedDayKeys: Iterable<string>,
  today: string = toDayKey(new Date()),
): StreakResult {
  const studied = new Set(studiedDayKeys)
  const sorted = Array.from(studied).sort()

  const empty: StreakResult = {
    current: 0,
    longest: 0,
    freezesAvailable: 0,
    freezesEarned: 0,
    freezeDays: [],
    studiedToday: false,
    studiedYesterday: false,
    lastStudyDay: null,
    totalStudyDays: studied.size,
    atRisk: false,
    milestone: null,
  }
  if (sorted.length === 0) return empty

  const firstDay = sorted[0]
  const todayDate = new Date(today)
  const yesterday = toDayKey(addDays(todayDate, -1))

  let streak = 0
  let longest = 0
  let freezesEarned = 0
  let freezesAvailable = 0
  const freezeDays: string[] = []
  const usedFreezeDays = new Set<string>()

  // Walk forward from the first study day to today. Freezes are only ever used
  // on *past* missed days, so today never triggers a freeze (the day isn't over).
  let cursor = new Date(firstDay)
  const endTime = todayDate.getTime()
  let guard = 0

  while (cursor.getTime() <= endTime && guard < 4000) {
    const key = toDayKey(cursor)
    const isToday = key === today

    if (studied.has(key)) {
      streak += 1
      if (streak > longest) longest = streak
      // Earn a freeze at each multiple of the interval.
      if (streak % FREEZE_EARN_INTERVAL === 0) {
        freezesEarned += 1
        if (freezesAvailable < MAX_STREAK_FREEZES) freezesAvailable += 1
      }
    } else if (isToday) {
      // Today simply hasn't been studied yet — the streak is still alive.
    } else if (streak > 0 && freezesAvailable > 0 && !usedFreezeDays.has(key)) {
      // Bridge exactly one missed day with one freeze.
      freezesAvailable -= 1
      usedFreezeDays.add(key)
      freezeDays.push(key)
    } else {
      streak = 0
    }

    cursor = addDays(cursor, 1)
    guard++
  }

  const studiedToday = studied.has(today)
  const studiedYesterday = studied.has(yesterday)

  return {
    current: streak,
    longest,
    freezesAvailable,
    freezesEarned,
    freezeDays,
    studiedToday,
    studiedYesterday,
    lastStudyDay: sorted[sorted.length - 1],
    totalStudyDays: studied.size,
    atRisk: streak > 0 && !studiedToday,
    milestone: milestoneFor(streak),
  }
}
