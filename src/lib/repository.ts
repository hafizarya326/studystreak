/**
 * Persistence layer.
 *
 * Everything goes through the `Repository` interface. The default
 * implementation is `LocalRepository` (localStorage). To add Supabase later,
 * implement the same interface and swap the exported `repository` — no UI or
 * state code needs to change.
 *
 * All reads use prototype-pollution-safe JSON parsing and strict schema
 * sanitizers so corrupted or tampered storage entries cannot crash the app or
 * inject dangerous values.
 */
import type {
  AchievementState,
  StudySession,
  UserRecord,
  UserSettings,
} from '../types'
import { DEFAULT_SETTINGS } from './defaults'
import {
  isSafeId,
  LIMITS,
  safeJsonParse,
  sanitizeAchievements,
  sanitizeSession,
  sanitizeSettings,
  sanitizeTimerSnapshot,
  sanitizeUserRecord,
  type SanitizedTimerSnapshot,
} from './security'

const ROOT = 'studystreak.v1'

export const AUTH_STORAGE_KEY = `${ROOT}:auth`

const KEY = {
  users: `${ROOT}:users`,
  auth: AUTH_STORAGE_KEY,
  sessions: (u: string) => `${ROOT}:u:${u}:sessions`,
  settings: (u: string) => `${ROOT}:u:${u}:settings`,
  achievements: (u: string) => `${ROOT}:u:${u}:achievements`,
  timer: (u: string) => `${ROOT}:u:${u}:timer`,
}

/** In-memory fallback so the app still works if storage is unavailable/blocked. */
const memory = new Map<string, string>()

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return memory.get(key) ?? null
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    memory.set(key, value)
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    memory.delete(key)
  }
}

function readJSON<T>(key: string, fallback: T): T {
  const raw = safeGet(key)
  if (!raw) return fallback
  return safeJsonParse<T>(raw, fallback)
}

function writeJSON(key: string, value: unknown): void {
  safeSet(key, JSON.stringify(value))
}

export interface Repository {
  // auth / users
  listUsers(): Promise<UserRecord[]>
  getUser(id: string): Promise<UserRecord | null>
  findUserByEmail(email: string): Promise<UserRecord | null>
  saveUser(user: UserRecord): Promise<void>
  getActiveUserId(): Promise<string | null>
  setActiveUserId(id: string | null): Promise<void>

  // sessions
  listSessions(userId: string): Promise<StudySession[]>
  saveSession(userId: string, session: StudySession): Promise<void>
  deleteSession(userId: string, sessionId: string): Promise<void>
  clearSessions(userId: string): Promise<void>

  // settings
  getSettings(userId: string): Promise<UserSettings>
  saveSettings(userId: string, settings: UserSettings): Promise<void>

  // achievements
  getAchievements(userId: string): Promise<AchievementState>
  saveAchievements(userId: string, state: AchievementState): Promise<void>

  // account
  deleteUser(userId: string): Promise<void>
}

class LocalRepository implements Repository {
  async listUsers(): Promise<UserRecord[]> {
    const raw = readJSON<unknown>(KEY.users, [])
    if (!Array.isArray(raw)) return []
    const valid: UserRecord[] = []
    for (const item of raw) {
      const clean = sanitizeUserRecord(item)
      if (clean) valid.push(clean)
    }
    return valid
  }

  async getUser(id: string): Promise<UserRecord | null> {
    if (!isSafeId(id)) return null
    const users = await this.listUsers()
    return users.find((u) => u.id === id) ?? null
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const target = email.trim().toLowerCase()
    if (!target) return null
    const users = await this.listUsers()
    return users.find((u) => u.email.toLowerCase() === target) ?? null
  }

  async saveUser(user: UserRecord): Promise<void> {
    const clean = sanitizeUserRecord(user)
    if (!clean) throw new Error('Invalid user record.')
    const users = await this.listUsers()
    const idx = users.findIndex((u) => u.id === clean.id)
    if (idx >= 0) users[idx] = clean
    else users.push(clean)
    writeJSON(KEY.users, users)
  }

  async getActiveUserId(): Promise<string | null> {
    const value = readJSON<{ userId?: unknown } | null>(KEY.auth, null)
    return value && isSafeId(value.userId) ? value.userId : null
  }

  async setActiveUserId(id: string | null): Promise<void> {
    if (id !== null && !isSafeId(id)) return
    writeJSON(KEY.auth, { userId: id })
  }

  async listSessions(userId: string): Promise<StudySession[]> {
    if (!isSafeId(userId)) return []
    const raw = readJSON<unknown>(KEY.sessions(userId), [])
    if (!Array.isArray(raw)) return []
    const valid: StudySession[] = []
    for (const item of raw.slice(0, LIMITS.maxSessions)) {
      const clean = sanitizeSession(item, userId)
      if (clean) valid.push(clean)
    }
    return valid.sort((a, b) => b.startedAt - a.startedAt)
  }

  async saveSession(userId: string, session: StudySession): Promise<void> {
    if (!isSafeId(userId)) return
    const clean = sanitizeSession(session, userId)
    if (!clean) return
    const list = await this.listSessions(userId)
    const idx = list.findIndex((s) => s.id === clean.id)
    if (idx >= 0) list[idx] = clean
    else if (list.length < LIMITS.maxSessions) list.push(clean)
    writeJSON(KEY.sessions(userId), list)
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    if (!isSafeId(userId) || !isSafeId(sessionId)) return
    const list = await this.listSessions(userId)
    writeJSON(
      KEY.sessions(userId),
      list.filter((s) => s.id !== sessionId),
    )
  }

  async clearSessions(userId: string): Promise<void> {
    if (!isSafeId(userId)) return
    writeJSON(KEY.sessions(userId), [])
  }

  async getSettings(userId: string): Promise<UserSettings> {
    if (!isSafeId(userId)) return { ...DEFAULT_SETTINGS }
    const saved = readJSON<unknown>(KEY.settings(userId), {})
    return sanitizeSettings(saved)
  }

  async saveSettings(userId: string, settings: UserSettings): Promise<void> {
    if (!isSafeId(userId)) return
    writeJSON(KEY.settings(userId), sanitizeSettings(settings))
  }

  async getAchievements(userId: string): Promise<AchievementState> {
    if (!isSafeId(userId)) return {}
    const raw = readJSON<unknown>(KEY.achievements(userId), {})
    return sanitizeAchievements(raw)
  }

  async saveAchievements(userId: string, state: AchievementState): Promise<void> {
    if (!isSafeId(userId)) return
    writeJSON(KEY.achievements(userId), sanitizeAchievements(state))
  }

  async deleteUser(userId: string): Promise<void> {
    if (!isSafeId(userId)) return
    const users = await this.listUsers()
    writeJSON(
      KEY.users,
      users.filter((u) => u.id !== userId),
    )
    safeRemove(KEY.sessions(userId))
    safeRemove(KEY.settings(userId))
    safeRemove(KEY.achievements(userId))
    safeRemove(KEY.timer(userId))
  }
}

export const repository: Repository = new LocalRepository()

/**
 * Namespaced storage used by the timer so a half-finished session survives a
 * refresh or a closed tab.
 */
export const timerStorage = {
  read(userId: string): SanitizedTimerSnapshot | null {
    if (!isSafeId(userId)) return null
    const raw = readJSON<unknown>(KEY.timer(userId), null)
    return sanitizeTimerSnapshot(raw)
  },
  write(userId: string, value: unknown): void {
    if (!isSafeId(userId)) return
    const clean = sanitizeTimerSnapshot(value)
    if (!clean) return
    writeJSON(KEY.timer(userId), clean)
  },
  clear(userId: string): void {
    if (!isSafeId(userId)) return
    safeRemove(KEY.timer(userId))
  },
}
