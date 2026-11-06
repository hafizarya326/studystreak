import type { UserSettings } from '../types'

export const DEFAULT_SUBJECTS = [
  'General',
  'Mathematics',
  'Science',
  'History',
  'Languages',
  'Programming',
  'Reading',
]

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'light',
  soundEnabled: true,
  chimeVolume: 0.5,
  notificationsEnabled: false,

  ambient: 'none',
  ambientVolume: 0.35,
  musicSource: 'ambient',
  customAudioUrl: '',
  customAudioName: '',
  spotifyUrl: '',

  autoStartBreaks: false,
  autoStartFocus: false,

  pomodoroMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakInterval: 4,
  customMin: 45,

  dailyGoalMin: 120,
  weeklyGoalMin: 720,
  dailySessionGoal: 4,

  minQualifyingSec: 60,

  defaultSubject: 'General',
  subjects: DEFAULT_SUBJECTS,
}

/** Max freezes a user can bank at once. */
export const MAX_STREAK_FREEZES = 3
/** One freeze is earned for every N consecutive study days. */
export const FREEZE_EARN_INTERVAL = 7
