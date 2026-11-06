import type { AchievementState, Stats, StreakResult, StudySession } from '../types'
import { addDays, addMonths, fromDayKey, startOfWeek, toDayKey } from './date'
import { isQualifyingSession } from './stats'

export type AchievementMetric =
  | 'sessions'
  | 'streak'
  | 'hours'
  | 'sessionsInDay'
  | 'perfectWeek'
  | 'studyDays'

export type AchievementTier = 'bronze' | 'silver' | 'gold'

export interface AchievementDef {
  id: string
  title: string
  description: string
  metric: AchievementMetric
  target: number
  /** lucide-react icon key, resolved in the UI layer */
  icon: string
  tier: AchievementTier
  hint: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-step',
    title: 'First Step',
    description: 'Complete your first study session.',
    metric: 'sessions',
    target: 1,
    icon: 'footprints',
    tier: 'bronze',
    hint: 'Finish one focus session to begin.',
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Reach a 3-day study streak.',
    metric: 'streak',
    target: 3,
    icon: 'sprout',
    tier: 'bronze',
    hint: 'Study 3 days in a row.',
  },
  {
    id: 'consistency',
    title: 'Consistency',
    description: 'Reach a 7-day streak.',
    metric: 'streak',
    target: 7,
    icon: 'calendar-check',
    tier: 'silver',
    hint: 'Study 7 days in a row.',
  },
  {
    id: 'dedicated-student',
    title: 'Dedicated Student',
    description: 'Reach a 14-day streak.',
    metric: 'streak',
    target: 14,
    icon: 'medal',
    tier: 'silver',
    hint: 'Study 14 days in a row.',
  },
  {
    id: 'study-master',
    title: 'Study Master',
    description: 'Reach a 30-day streak.',
    metric: 'streak',
    target: 30,
    icon: 'crown',
    tier: 'gold',
    hint: 'Study 30 days in a row.',
  },
  {
    id: 'focus-champion',
    title: 'Focus Champion',
    description: 'Accumulate 100 hours of study.',
    metric: 'hours',
    target: 100,
    icon: 'trophy',
    tier: 'gold',
    hint: 'Log 100 total focus hours.',
  },
  {
    id: 'marathon-student',
    title: 'Marathon Student',
    description: 'Complete 5 study sessions in one day.',
    metric: 'sessionsInDay',
    target: 5,
    icon: 'zap',
    tier: 'silver',
    hint: 'Fit 5 sessions into a single day.',
  },
  {
    id: 'perfect-week',
    title: 'Perfect Week',
    description: 'Study every day of a calendar week.',
    metric: 'perfectWeek',
    target: 1,
    icon: 'star',
    tier: 'gold',
    hint: 'Study all 7 days of one week (Mon–Sun).',
  },
  {
    id: 'century-sessions',
    title: 'Century Club',
    description: 'Complete 100 study sessions.',
    metric: 'sessions',
    target: 100,
    icon: 'flame',
    tier: 'gold',
    hint: 'Complete 100 total sessions.',
  },
  {
    id: 'deep-diver',
    title: 'Deep Diver',
    description: 'Study on 50 different days.',
    metric: 'studyDays',
    target: 50,
    icon: 'waves',
    tier: 'gold',
    hint: 'Put in work across 50 separate days.',
  },
]

export interface AchievementContext {
  totalSessions: number
  totalHours: number
  longestStreak: number
  currentStreak: number
  maxSessionsInDay: number
  hasPerfectWeek: boolean
  totalStudyDays: number
}

export interface AchievementStatus extends AchievementDef {
  value: number
  /** 0-100 */
  pct: number
  unlocked: boolean
  unlockedAt?: number
}

function metricValue(metric: AchievementMetric, ctx: AchievementContext): number {
  switch (metric) {
    case 'sessions':
      return ctx.totalSessions
    case 'streak':
      return Math.max(ctx.longestStreak, ctx.currentStreak)
    case 'hours':
      return ctx.totalHours
    case 'sessionsInDay':
      return ctx.maxSessionsInDay
    case 'perfectWeek':
      return ctx.hasPerfectWeek ? 1 : 0
    case 'studyDays':
      return ctx.totalStudyDays
  }
}

/** True when every day of at least one Mon–Sun week was studied. */
export function detectPerfectWeek(dayKeys: Set<string>): boolean {
  if (dayKeys.size < 7) return false
  const sorted = Array.from(dayKeys).sort()
  const first = sorted[0]
  let cursor = startOfWeek(fromDayKey(first))
  const today = new Date()
  let guard = 0
  while (cursor.getTime() <= today.getTime() && guard < 600) {
    let all = true
    for (let i = 0; i < 7; i++) {
      if (!dayKeys.has(toDayKey(addDays(cursor, i)))) {
        all = false
        break
      }
    }
    if (all) return true
    cursor = addDays(cursor, 7)
    guard++
  }
  return false
}

export function buildAchievementContext(
  sessions: StudySession[],
  streak: StreakResult,
  stats: Stats,
  minSec: number,
): AchievementContext {
  const dayKeys = new Set<string>()
  for (const s of sessions) {
    if (isQualifyingSession(s, minSec)) dayKeys.add(toDayKey(s.startedAt))
  }
  let maxSessionsInDay = 0
  for (const count of Object.values(stats.sessionsByDay)) {
    if (count > maxSessionsInDay) maxSessionsInDay = count
  }
  return {
    totalSessions: stats.totalSessions,
    totalHours: stats.totalHours,
    longestStreak: streak.longest,
    currentStreak: streak.current,
    maxSessionsInDay,
    hasPerfectWeek: detectPerfectWeek(dayKeys),
    totalStudyDays: dayKeys.size,
  }
}

/**
 * Evaluate every achievement. `state` holds persisted unlock timestamps so we
 * never re-fire a celebration for something the user already unlocked.
 */
export function evaluateAchievements(
  ctx: AchievementContext,
  state: AchievementState,
): AchievementStatus[] {
  return ACHIEVEMENTS.map((def) => {
    const value = metricValue(def.metric, ctx)
    const pct = Math.min(100, Math.round((value / def.target) * 100))
    const unlocked = value >= def.target || Boolean(state[def.id])
    return {
      ...def,
      value,
      pct,
      unlocked,
      unlockedAt: state[def.id],
    }
  })
}

/** Achievements that should now be unlocked but aren't recorded yet. */
export function newlyUnlocked(
  statuses: AchievementStatus[],
  state: AchievementState,
): AchievementStatus[] {
  return statuses.filter((s) => s.pct >= 100 && !state[s.id])
}

/** Unused export guard for month helpers used elsewhere in achievements UI. */
export function monthKeysAgo(count: number): string[] {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = addMonths(now, -(count - 1 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}
