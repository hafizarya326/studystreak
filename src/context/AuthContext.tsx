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
import { repository } from '../lib/repository'
import { hashPassword, makeSalt, verifyPassword } from '../lib/crypto'
import { uid } from '../lib/id'

const AVATARS = ['🦉', '🐢', '🦊', '🐝', '🌱', '📚', '🚀', '🐬', '🦁', '🌙']

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
    ;(async () => {
      try {
        const id = await repository.getActiveUserId()
        if (id) {
          const record = await repository.getUser(id)
          if (alive && record) setUser(toProfile(record))
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const register = useCallback(
    async ({ name, email, password }: { name: string; email: string; password: string }) => {
      const cleanEmail = email.trim().toLowerCase()
      if (!name.trim()) throw new Error('Please enter your name.')
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail))
        throw new Error('Please enter a valid email address.')
      if (password.length < 6) throw new Error('Password must be at least 6 characters.')

      const existing = await repository.findUserByEmail(cleanEmail)
      if (existing) throw new Error('An account with this email already exists.')

      const salt = makeSalt()
      const passwordHash = await hashPassword(password, salt)
      const record: UserRecord = {
        id: uid('u_'),
        name: name.trim(),
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
    const record = await repository.findUserByEmail(email.trim().toLowerCase())
    if (!record) throw new Error('No account found for that email.')
    const ok = await verifyPassword(password, record.salt, record.passwordHash)
    if (!ok) throw new Error('Incorrect password. Please try again.')
    await repository.setActiveUserId(record.id)
    setUser(toProfile(record))
  }, [])

  const demoLogin = useCallback(async () => {
    const email = 'demo@studystreak.app'
    const existing = await repository.findUserByEmail(email)
    if (existing) {
      await repository.setActiveUserId(existing.id)
      setUser(toProfile(existing))
      return
    }
    const salt = makeSalt()
    const record: UserRecord = {
      id: uid('u_'),
      name: 'Demo Student',
      email,
      avatar: '🦉',
      tagline: 'Exploring StudyStreak.',
      createdAt: Date.now(),
      passwordHash: await hashPassword('demo1234', salt),
      salt,
    }
    await repository.saveUser(record)
    await repository.setActiveUserId(record.id)
    setUser(toProfile(record))
  }, [])

  const logout = useCallback(async () => {
    await repository.setActiveUserId(null)
    setUser(null)
  }, [])

  const updateProfile = useCallback(
    async (patch: Partial<Omit<UserProfile, 'id' | 'createdAt'>>) => {
      if (!user) return
      const record = await repository.getUser(user.id)
      if (!record) return
      const next: UserRecord = { ...record, ...patch, id: record.id, createdAt: record.createdAt }
      await repository.saveUser(next)
      setUser(toProfile(next))
    },
    [user],
  )

  const deleteAccount = useCallback(async () => {
    if (!user) return
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
