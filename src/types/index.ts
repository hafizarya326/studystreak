/**
 * Core domain types for StudyStreak.
 * Kept framework-agnostic so the same shapes can be stored locally today
 * and synced to Supabase later without a rewrite.
 */

export type TimerModeId = 'pomodoro' | 'short' | 'long' | 'custom'

/** Study sessions are "focus"; breaks are tracked separately and never counted. */
export type SessionType = 'focus' | 'short-break' | 'long-break'

export interface StudySession {
  id: string
  userId: string
  /** epoch ms */
  startedAt: number
  /** epoch ms */
  endedAt: number
  /** planned/actual focus duration in seconds */
  durationSec: number
  type: SessionType
  subject: string
  label?: string
  note?: string
  completed: boolean
  modeId: TimerModeId
}

export type ThemePreference = 'light' | 'dark' | 'system'

export type AmbientSoundId = 'none' | 'brown' | 'white' | 'waves' | 'cafe'

/** Which background-audio source plays during a focus session. */
export type MusicSource = 'ambient' | 'custom' | 'spotify'

export interface UserSettings {
  theme: ThemePreference
  soundEnabled: boolean
  chimeVolume: number
  notificationsEnabled: boolean

  ambient: AmbientSoundId
  /** Shared background-audio volume (ambient noise and custom audio). */
  ambientVolume: number
  musicSource: MusicSource
  /** Direct link to an audio file the user owns (mp3/ogg/…). */
  customAudioUrl: string
  /** Display name of an uploaded track (the file itself lives in IndexedDB). */
  customAudioName: string
  /** Spotify playlist/track/album link to embed (playback stays manual). */
  spotifyUrl: string

  autoStartBreaks: boolean
  autoStartFocus: boolean

  pomodoroMin: number
  shortBreakMin: number
  longBreakMin: number
  longBreakInterval: number
  customMin: number

  dailyGoalMin: number
  weeklyGoalMin: number
  dailySessionGoal: number

  /** Minimum focus duration (seconds) that counts as a valid, streak-qualifying session. */
  minQualifyingSec: number

  defaultSubject: string
  subjects: string[]
}

export interface UserProfile {
  id: string
  name: string
  email: string
  avatar: string
  createdAt: number
  tagline: string
}

/** Stored user record (includes credential hash — never a plain password). */
export interface UserRecord extends UserProfile {
  passwordHash: string
  salt: string
}

/** achievementId -> unlock timestamp (epoch ms) */
export type AchievementState = Record<string, number>

/** freezeDayKey -> true for days protected by a Streak Freeze */
export type FreezeState = Record<string, boolean>

export interface StreakResult {
  /** Consecutive qualifying days up to today (today pending does not break it). */
  current: number
  longest: number
  freezesAvailable: number
  freezesEarned: number
  /** Calendar day keys that were protected by a freeze. */
  freezeDays: string[]
  studiedToday: boolean
  studiedYesterday: boolean
  lastStudyDay: string | null
  /** Total qualifying study days, all time. */
  totalStudyDays: number
  /** True when the streak is alive but today has no session yet. */
  atRisk: boolean
  milestone: StreakMilestone | null
}

export interface StreakMilestone {
  days: number
  label: string
  message: string
}

export interface Stats {
  totalSessions: number
  totalFocusSec: number
  totalHours: number
  todaySec: number
  yesterdaySec: number
  weekSec: number
  lastWeekSec: number
  monthSec: number
  avgSessionSec: number
  longestSessionSec: number
  activeDays: number
  /** Study days / days since first session, as a 0-100 percentage. */
  consistency: number
  bestDayKey: string | null
  bestDaySec: number
  /** YYYY-MM-DD -> focus seconds */
  focusSecByDay: Record<string, number>
  /** YYYY-MM-DD -> completed focus session count */
  sessionsByDay: Record<string, number>
  weeklySeries: Array<{ key: string; label: string; sec: number; sessions: number }>
  monthlySeries: Array<{ key: string; label: string; sec: number; hours: number }>
  daySeries: Array<{ key: string; label: string; sec: number; sessions: number }>
  subjects: Array<{ name: string; sec: number; sessions: number }>
}
