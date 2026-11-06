/**
 * Persistence layer.
 *
 * Everything goes through the `Repository` interface. The default
 * implementation is `LocalRepository` (localStorage). To add Supabase later,
 * implement the same interface and swap the exported `repository` — no UI or
 * state code needs to change.
 */
import type {
  AchievementState,
  StudySession,
  UserRecord,
  UserSettings,
} from '../types'
import { DEFAULT_SETTINGS } from './defaults'

const ROOT = 'studystreak.v1'

const KEY = {
  users: `${ROOT}:users`,
  auth: `${ROOT}:auth`,
  sessions: (u: string) => `${ROOT}:u:${u}:sessions`,
  settings: (u: string) => `${ROOT}:u:${u}:settings`,
  achievements: (u: string) => `${ROOT}:u:${u}:achievements`,
}

/** In-memory fallback so the app still works if storage is unavailable/blocked. */
const memory = new Map<string, string>()

function safeGet(key: string): string | null {
  try {
    const v = window.localStorage.getItem(key)
    return v
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

function readJSON<T>(key: string, fallback: T): T {
  const raw = safeGet(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
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
    return readJSON<UserRecord[]>(KEY.users, [])
  }

  async getUser(id: string): Promise<UserRecord | null> {
    const users = await this.listUsers()
    return users.find((u) => u.id === id) ?? null
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const target = email.trim().toLowerCase()
    const users = await this.listUsers()
    return users.find((u) => u.email.toLowerCase() === target) ?? null
  }

  async saveUser(user: UserRecord): Promise<void> {
    const users = await this.listUsers()
    const idx = users.findIndex((u) => u.id === user.id)
    if (idx >= 0) users[idx] = user
    else users.push(user)
    writeJSON(KEY.users, users)
  }

  async getActiveUserId(): Promise<string | null> {
    const value = readJSON<{ userId?: string } | null>(KEY.auth, null)
    return value?.userId ?? null
  }

  async setActiveUserId(id: string | null): Promise<void> {
    writeJSON(KEY.auth, { userId: id })
  }

  async listSessions(userId: string): Promise<StudySession[]> {
    const list = readJSON<StudySession[]>(KEY.sessions(userId), [])
    return list.slice().sort((a, b) => b.startedAt - a.startedAt)
  }

  async saveSession(userId: string, session: StudySession): Promise<void> {
    const list = readJSON<StudySession[]>(KEY.sessions(userId), [])
    const idx = list.findIndex((s) => s.id === session.id)
    if (idx >= 0) list[idx] = session
    else list.push(session)
    writeJSON(KEY.sessions(userId), list)
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const list = readJSON<StudySession[]>(KEY.sessions(userId), [])
    writeJSON(
      KEY.sessions(userId),
      list.filter((s) => s.id !== sessionId),
    )
  }

  async clearSessions(userId: string): Promise<void> {
    writeJSON(KEY.sessions(userId), [])
  }

  async getSettings(userId: string): Promise<UserSettings> {
    const saved = readJSON<Partial<UserSettings>>(KEY.settings(userId), {})
    return { ...DEFAULT_SETTINGS, ...saved }
  }

  async saveSettings(userId: string, settings: UserSettings): Promise<void> {
    writeJSON(KEY.settings(userId), settings)
  }

  async getAchievements(userId: string): Promise<AchievementState> {
    return readJSON<AchievementState>(KEY.achievements(userId), {})
  }

  async saveAchievements(userId: string, state: AchievementState): Promise<void> {
    writeJSON(KEY.achievements(userId), state)
  }

  async deleteUser(userId: string): Promise<void> {
    const users = await this.listUsers()
    writeJSON(
      KEY.users,
      users.filter((u) => u.id !== userId),
    )
    try {
      window.localStorage.removeItem(KEY.sessions(userId))
      window.localStorage.removeItem(KEY.settings(userId))
      window.localStorage.removeItem(KEY.achievements(userId))
    } catch {
      memory.delete(KEY.sessions(userId))
      memory.delete(KEY.settings(userId))
      memory.delete(KEY.achievements(userId))
    }
  }
}

export const repository: Repository = new LocalRepository()

/**
 * Namespaced storage used by the timer so a half-finished session survives a
 * refresh or a closed tab.
 */
export const timerStorage = {
  read<T>(userId: string): T | null {
    return readJSON<T | null>(`${ROOT}:u:${userId}:timer`, null)
  },
  write(userId: string, value: unknown): void {
    writeJSON(`${ROOT}:u:${userId}:timer`, value)
  },
  clear(userId: string): void {
    try {
      window.localStorage.removeItem(`${ROOT}:u:${userId}:timer`)
    } catch {
      memory.delete(`${ROOT}:u:${userId}:timer`)
    }
  },
}
