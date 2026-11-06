import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, BellOff, LogOut, Menu, Moon, Settings as SettingsIcon, Sun, Timer as TimerIcon, User } from 'lucide-react'
import { clsx } from 'clsx'
import { NAV_ITEMS } from './navItems'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useTimer } from '../../context/TimerContext'
import { useData } from '../../context/DataContext'
import { useIsDark } from '../../hooks/useIsDark'
import { formatClock } from '../../lib/date'
import { Flame } from '../streak/Flame'

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user, logout } = useAuth()
  const { settings, update } = useSettings()
  const { status, remainingSec, type } = useTimer()
  const { streak } = useData()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isDark = useIsDark()
  const active =
    NAV_ITEMS.find((i) => (i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to))) ??
    NAV_ITEMS[0]

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const showTimerPill = status === 'running' && location.pathname !== '/timer'

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-ink transition hover:bg-subtle lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-coral/12">
            <Flame size={17} />
          </span>
          <span className="font-display text-[15px] font-extrabold text-ink">StudyStreak</span>
        </div>

        <div className="hidden min-w-0 lg:block">
          <h1 className="truncate font-display text-lg font-bold text-ink">{active.label}</h1>
          <p className="text-xs text-muted">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {showTimerPill ? (
            <button
              type="button"
              onClick={() => navigate('/timer')}
              className="hidden items-center gap-2 rounded-full border border-sage/30 bg-sage/10 px-3 py-1.5 text-xs font-semibold text-sage-700 transition hover:bg-sage/20 sm:inline-flex"
            >
              <TimerIcon className="h-3.5 w-3.5 animate-pulse" />
              <span className="tabular-nums">{formatClock(remainingSec)}</span>
              <span className="text-sage-700/70">{type === 'focus' ? 'focus' : 'break'}</span>
            </button>
          ) : null}

          <div
            className="hidden items-center gap-1.5 rounded-full border border-coral/25 bg-coral/[0.08] px-2.5 py-1.5 text-xs font-semibold text-coral-600 sm:inline-flex"
            title="Current streak"
          >
            <Flame size={14} animated={false} />
            <span className="tabular-nums">{streak.current}</span>
          </div>

          <button
            type="button"
            onClick={() => update({ theme: isDark ? 'light' : 'dark' })}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-ink transition hover:bg-subtle"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-10 items-center gap-2 rounded-xl border border-line bg-card pl-2 pr-3 transition hover:bg-subtle"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-subtle text-sm">
                {user?.avatar ?? '🧑‍🎓'}
              </span>
              <span className="hidden max-w-[7rem] truncate text-sm font-medium text-ink sm:block">
                {user?.name ?? 'Student'}
              </span>
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 origin-top-right animate-fade-up rounded-2xl border border-line bg-card p-1.5 shadow-lift"
              >
                <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-subtle text-xl">
                    {user?.avatar ?? '🧑‍🎓'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
                    <p className="truncate text-xs text-muted">{user?.email}</p>
                  </div>
                </div>
                <div className="my-1 h-px bg-line" />
                <MenuItem icon={<User className="h-4 w-4" />} label="Profile & goals" to="/settings" onClick={() => setMenuOpen(false)} />
                <MenuItem
                  icon={settings.notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  label={settings.notificationsEnabled ? 'Notifications on' : 'Notifications off'}
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                />
                <MenuItem icon={<SettingsIcon className="h-4 w-4" />} label="Settings" to="/settings" onClick={() => setMenuOpen(false)} />
                <div className="my-1 h-px bg-line" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    void logout()
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

function MenuItem({
  icon,
  label,
  to,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  to: string
  onClick: () => void
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-subtle')}
    >
      {icon}
      {label}
    </Link>
  )
}
