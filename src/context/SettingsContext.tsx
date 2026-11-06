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
import type { UserSettings } from '../types'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import { repository } from '../lib/repository'
import { useAuth } from './AuthContext'

interface SettingsContextValue {
  settings: UserSettings
  loading: boolean
  update: (patch: Partial<UserSettings>) => void
  replace: (settings: UserSettings) => void
  reset: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const userRef = useRef<string | null>(user?.id ?? null)

  // Load per-user settings whenever the signed-in user changes.
  useEffect(() => {
    let alive = true
    userRef.current = user?.id ?? null
    if (!user) {
      setSettings(DEFAULT_SETTINGS)
      setLoading(false)
      return
    }
    setLoading(true)
    ;(async () => {
      const saved = await repository.getSettings(user.id)
      if (alive) {
        setSettings(saved)
        setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [user])

  const persist = useCallback((next: UserSettings) => {
    const id = userRef.current
    if (id) void repository.saveSettings(id, next)
  }, [])

  const update = useCallback(
    (patch: Partial<UserSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        persist(next)
        return next
      })
    },
    [persist],
  )

  const replace = useCallback(
    (next: UserSettings) => {
      setSettings(next)
      persist(next)
    },
    [persist],
  )

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    persist(DEFAULT_SETTINGS)
  }, [persist])

  // Apply theme (light / dark / system) to <html>.
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark =
        settings.theme === 'dark' || (settings.theme === 'system' && media.matches)
      root.classList.toggle('dark', dark)
      try {
        window.localStorage.setItem('studystreak.v1:theme', settings.theme)
      } catch {
        /* storage may be unavailable */
      }
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', dark ? '#1A1917' : '#F8F7F3')
    }
    apply()
    if (settings.theme === 'system') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
    return undefined
  }, [settings.theme])

  const value = useMemo(
    () => ({ settings, loading, update, replace, reset }),
    [settings, loading, update, replace, reset],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
