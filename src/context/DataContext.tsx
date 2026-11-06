import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AchievementState,
  Stats,
  StreakResult,
  StudySession,
} from '../types'
import { repository } from '../lib/repository'
import { useAuth } from './AuthContext'
import { useSettings } from './SettingsContext'
import { useCurrentDay } from '../hooks/useCurrentDay'
import { useToast } from './ToastContext'
import { computeStreak, milestoneFor } from '../lib/streak'
import { computeStats, qualifyingDayKeys } from '../lib/stats'
import {
  buildAchievementContext,
  evaluateAchievements,
  newlyUnlocked,
  type AchievementStatus,
} from '../lib/achievements'
import { uid } from '../lib/id'
import { formatDuration } from '../lib/date'

export interface NewSessionInput {
  startedAt: number
  endedAt: number
  durationSec: number
  type: StudySession['type']
  subject: string
  label?: string
  note?: string
  completed: boolean
  modeId: StudySession['modeId']
}

interface DataContextValue {
  sessions: StudySession[]
  loading: boolean
  stats: Stats
  streak: StreakResult
  achievements: AchievementStatus[]
  achievementState: AchievementState
  today: string
  addSession: (input: NewSessionInput) => Promise<StudySession>
  updateSession: (id: string, patch: Partial<StudySession>) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  clearAllSessions: () => Promise<void>
  reload: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

const EMPTY_ACHIEVEMENTS: AchievementState = {}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const { push } = useToast()
  const today = useCurrentDay()

  const [sessions, setSessions] = useState<StudySession[]>([])
  const [achievementState, setAchievementState] = useState<AchievementState | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (userId: string) => {
    const [list, ach] = await Promise.all([
      repository.listSessions(userId),
      repository.getAchievements(userId),
    ])
    setSessions(list)
    setAchievementState(ach)
  }, [])

  useEffect(() => {
    let alive = true
    if (!user) {
      setSessions([])
      setAchievementState(null)
      setLoading(false)
      return
    }
    setLoading(true)
    ;(async () => {
      await load(user.id)
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [user, load])

  const reload = useCallback(async () => {
    if (user) await load(user.id)
  }, [user, load])

  /* --------------------------- derived state --------------------------- */

  const streak = useMemo(() => {
    const days = qualifyingDayKeys(sessions, settings.minQualifyingSec)
    return computeStreak(days, today)
  }, [sessions, settings.minQualifyingSec, today])

  const stats = useMemo(() => computeStats(sessions), [sessions])

  const achContext = useMemo(
    () => buildAchievementContext(sessions, streak, stats, settings.minQualifyingSec),
    [sessions, streak, stats, settings.minQualifyingSec],
  )

  const achievements = useMemo(
    () => evaluateAchievements(achContext, achievementState ?? {}),
    [achContext, achievementState],
  )

  /* --------------------------- mutations --------------------------- */

  const addSession = useCallback(
    async (input: NewSessionInput): Promise<StudySession> => {
      const session: StudySession = {
        id: uid('s_'),
        userId: user?.id ?? 'guest',
        ...input,
      }
      if (user) {
        await repository.saveSession(user.id, session)
        setSessions((prev) => [session, ...prev])
      } else {
        setSessions((prev) => [session, ...prev])
      }
      return session
    },
    [user],
  )

  const updateSession = useCallback(
    async (id: string, patch: Partial<StudySession>) => {
      // Resolve the merged session up front — a state updater must stay pure,
      // so we never read a value out of it.
      const current = sessions.find((s) => s.id === id)
      if (!current) return
      const next: StudySession = { ...current, ...patch }
      setSessions((prev) => prev.map((s) => (s.id === id ? next : s)))
      if (user) await repository.saveSession(user.id, next)
    },
    [sessions, user],
  )

  const deleteSession = useCallback(
    async (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (user) {
        await repository.deleteSession(user.id, id)
        // Re-check achievements against persisted state (never revoke unlocks).
      }
    },
    [user],
  )

  const clearAllSessions = useCallback(async () => {
    if (user) await repository.clearSessions(user.id)
    setSessions([])
  }, [user])

  /* --------------------- achievement unlock watcher --------------------- */

  useEffect(() => {
    if (!user || loading || achievementState === null) return
    const fresh = newlyUnlocked(achievements, achievementState)
    if (fresh.length === 0) return
    const now = Date.now()
    setAchievementState((prev) => {
      const next = { ...(prev ?? {}) }
      for (const a of fresh) next[a.id] = now
      void repository.saveAchievements(user.id, next)
      return next
    })
    for (const a of fresh) {
      push({
        title: `Achievement unlocked: ${a.title}`,
        description: a.description,
        variant: 'achievement',
      })
    }
  }, [achievements, achievementState, user, loading, push])

  /* --------------------- streak celebration watcher --------------------- */

  const prevStreak = useRef<number | null>(null)
  const prevFreezeCount = useRef<number | null>(null)

  useEffect(() => {
    if (loading) return
    // Streak grew.
    if (prevStreak.current !== null && streak.current > prevStreak.current) {
      const m = milestoneFor(streak.current)
      push({
        title: `${streak.current}-day streak!`,
        description: m ? m.message : 'Your flame is still burning. Keep it going!',
        variant: 'streak',
      })
    } else if (prevStreak.current !== null && streak.current === 0 && prevStreak.current > 1) {
      push({
        title: 'Streak reset',
        description: 'A day was missed. Start a new streak today — one session is all it takes.',
        variant: 'default',
      })
    }
    prevStreak.current = streak.current

    // Freeze used.
    if (
      prevFreezeCount.current !== null &&
      streak.freezeDays.length > prevFreezeCount.current
    ) {
      push({
        title: 'Streak Freeze activated',
        description: 'A missed day was protected, so your streak is safe.',
        variant: 'streak',
      })
    }
    prevFreezeCount.current = streak.freezeDays.length
  }, [streak.current, streak.freezeDays.length, loading, push])

  /* --------------------------- goal notifications --------------------------- */

  const goalNotified = useRef<string>('')
  useEffect(() => {
    if (loading) return
    const key = `${today}:daily`
    const goalSec = settings.dailyGoalMin * 60
    if (goalSec > 0 && stats.todaySec >= goalSec && goalNotified.current !== key) {
      goalNotified.current = key
      push({
        title: 'Daily goal complete! 🎉',
        description: `You hit ${formatDuration(goalSec)} of focused study today. Outstanding.`,
        variant: 'success',
      })
    }
  }, [stats.todaySec, settings.dailyGoalMin, today, loading, push])

  const value = useMemo(
    () => ({
      sessions,
      loading,
      stats,
      streak,
      achievements,
      achievementState: achievementState ?? EMPTY_ACHIEVEMENTS,
      today,
      addSession,
      updateSession,
      deleteSession,
      clearAllSessions,
      reload,
    }),
    [
      sessions,
      loading,
      stats,
      streak,
      achievements,
      achievementState,
      today,
      addSession,
      updateSession,
      deleteSession,
      clearAllSessions,
      reload,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within a DataProvider')
  return ctx
}
