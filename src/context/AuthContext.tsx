import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { UserProfile, UserRecord } from '../types'
import { AUTH_STORAGE_KEY, repository } from '../lib/repository'
import {
  dummyPasswordWork,
  hashPassword,
  makeSalt,
  needsRehash,
  verifyPassword,
} from '../lib/crypto'
import { uid } from '../lib/id'
import { deleteUserTracks } from '../lib/audio-library'
import { soundEngine } from '../lib/sound'
import { musicEngine } from '../lib/music'
import {
  LIMITS,
  loginRateLimiter,
  sanitizeText,
  validatePasswordStrength,
} from '../lib/security'

const AVATARS = ['🦉', '🐢', '🦊', '🐝', '🌱', '📚', '🚀', '🐬', '🦁', '🌙']
const DEMO_EMAIL = 'demo@studystreak.app'
const GENERIC_LOGIN_ERROR = 'Invalid email or password.'

interface AuthContextValue {
  user: UserProfile | null
  loading: boolean
  register: (input: { name: string; email: string; password: string }) => Promise<void>
  login: (input: { email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (patch: Partial<Omit<UserProfile, 'id' | 'createdAt'>>) => Promise<void>
  deleteAccount: () => Promise<void>
  demoLogin: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toProfile(record: UserRecord): UserProfile {
  const { passwordHash: _p, salt: _s, ...profile } = record
  void _p
  void _s
  return profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const syncActiveUser = async () => {
      try {
        const id = await repository.getActiveUserId()
        if (!id) {
          if (alive) setUser(null)
          return
        }
        const record = await repository.getUser(id)
        if (alive) setUser(record ? toProfile(record) : null)
      } finally {
        if (alive) setLoading(false)
      }
    }
    void syncActiveUser()

    // Keep sign-in / sign-out state synchronized across browser tabs.
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY || e.key === null) {
        void syncActiveUser()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      alive = false
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const register = useCallback(
    async ({ name, email, password }: { name: string; email: string; password: string }) => {
      const cleanName = sanitizeText(name, LIMITS.name)
      const cleanEmail = sanitizeText(email, LIMITS.email).toLowerCase()

      if (!cleanName) throw new Error('Please enter your name.')
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
        throw new Error('Please enter a valid email address.')
      }
      if (cleanEmail === DEMO_EMAIL) {
        throw new Error('This email address is reserved.')
      }

      const passwordError = validatePasswordStrength(password)
      if (passwordError) throw new Error(passwordError)

      const existing = await repository.findUserByEmail(cleanEmail)
      if (existing) throw new Error('Unable to create account with this email. Try logging in instead.')

      const salt = makeSalt()
      const passwordHash = await hashPassword(password, salt)
      const record: UserRecord = {
        id: uid('u_'),
        name: cleanName,
        email: cleanEmail,
        avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
        tagline: 'Ready to build a study habit.',
        createdAt: Date.now(),
        passwordHash,
        salt,
      }
      await repository.saveUser(record)
      await repository.setActiveUserId(record.id)
      setUser(toProfile(record))
    },
    [],
  )

  const login = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const cleanEmail = sanitizeText(email, LIMITS.email).toLowerCase()
    const limit = loginRateLimiter.check(cleanEmail)
    if (!limit.allowed) {
      throw new Error(
        `Too many failed sign-in attempts. Please wait ${limit.retryAfterSec}s before trying again.`,
      )
    }

    // Reject oversized password inputs before invoking PBKDF2 (prevents client DoS).
    if (!password || password.length > LIMITS.passwordMax) {
      loginRateLimiter.recordFailure(cleanEmail)
      throw new Error(GENERIC_LOGIN_ERROR)
    }

    const record = await repository.findUserByEmail(cleanEmail)
    if (!record) {
      // Equalise timing with a valid-user check to prevent account enumeration.
      await dummyPasswordWork(password)
      loginRateLimiter.recordFailure(cleanEmail)
      throw new Error(GENERIC_LOGIN_ERROR)
    }

    const ok = await verifyPassword(password, record.salt, record.passwordHash)
    if (!ok) {
      loginRateLimiter.recordFailure(cleanEmail)
      throw new Error(GENERIC_LOGIN_ERROR)
    }

    loginRateLimiter.reset(cleanEmail)

    // Transparently upgrade legacy hashes (sha256:/h:) or lower iteration counts.
    let activeRecord = record
    if (needsRehash(record.passwordHash)) {
      const nextSalt = makeSalt()
      const nextHash = await hashPassword(password, nextSalt)
      activeRecord = { ...record, salt: nextSalt, passwordHash: nextHash }
      await repository.saveUser(activeRecord)
    }

    await repository.setActiveUserId(activeRecord.id)
    setUser(toProfile(activeRecord))
  }, [])

  const demoLogin = useCallback(async () => {
    const existing = await repository.findUserByEmail(DEMO_EMAIL)
    if (existing) {
      await repository.setActiveUserId(existing.id)
      setUser(toProfile(existing))
      return
    }
    const salt = makeSalt()
    // Random non-guessable credential instead of a hardcoded literal password.
    const ephemeralSecret = makeSalt() + makeSalt()
    const record: UserRecord = {
      id: uid('u_'),
      name: 'Demo Student',
      email: DEMO_EMAIL,
      avatar: '🦉',
      tagline: 'Exploring StudyStreak.',
      createdAt: Date.now(),
      passwordHash: await hashPassword(ephemeralSecret, salt),
      salt,
    }
    await repository.saveUser(record)
    await repository.setActiveUserId(record.id)
    setUser(toProfile(record))
  }, [])

  const logout = useCallback(async () => {
    soundEngine.stopAmbient()
    musicEngine.stop()
    await repository.setActiveUserId(null)
    setUser(null)
  }, [])

  const updateProfile = useCallback(
    async (patch: Partial<Omit<UserProfile, 'id' | 'createdAt'>>) => {
      if (!user) return
      const record = await repository.getUser(user.id)
      if (!record) return

      // Explicitly whitelist mutable profile fields (prevents mass assignment).
      const nextName =
        typeof patch.name === 'string'
          ? sanitizeText(patch.name, LIMITS.name) || record.name
          : record.name
      const nextAvatar =
        typeof patch.avatar === 'string'
          ? sanitizeText(patch.avatar, LIMITS.avatar) || record.avatar
          : record.avatar
      const nextTagline =
        typeof patch.tagline === 'string'
          ? sanitizeText(patch.tagline, LIMITS.tagline)
          : record.tagline

      const next: UserRecord = {
        ...record,
        name: nextName,
        avatar: nextAvatar,
        tagline: nextTagline,
      }
      await repository.saveUser(next)
      setUser(toProfile(next))
    },
    [user],
  )

  const deleteAccount = useCallback(async () => {
    if (!user) return
    soundEngine.stopAmbient()
    musicEngine.stop()
    await deleteUserTracks(user.id)
    await repository.deleteUser(user.id)
    await repository.setActiveUserId(null)
    setUser(null)
  }, [user])

  const value = useMemo(
    () => ({ user, loading, register, login, logout, updateProfile, deleteAccount, demoLogin }),
    [user, loading, register, login, logout, updateProfile, deleteAccount, demoLogin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
