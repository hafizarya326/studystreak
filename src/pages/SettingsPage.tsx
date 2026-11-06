import { useState } from 'react'
import {
  Bell,
  BellOff,
  Database,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Timer as TimerIcon,
  Trash2,
  Target,
  User as UserIcon,
  Volume2,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, NumberStepper, TextInput } from '../components/ui/Field'
import { Segmented } from '../components/ui/Segmented'
import { Toggle } from '../components/ui/Toggle'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { exportBackupJSON, exportSessionsCSV } from '../lib/export'
import type { ThemePreference } from '../types'

const AVATARS = ['🦉', '🐢', '🦊', '🐝', '🌱', '📚', '🚀', '🐬', '🦁', '🌙', '🐼', '🦄']
const WEEKLY_HOURS_OPTIONS = [5, 8, 10, 12, 15, 20, 25, 30]

export function SettingsPage() {
  const { user, updateProfile, logout, deleteAccount } = useAuth()
  const { settings, update, reset } = useSettings()
  const { sessions, clearAllSessions } = useData()
  const { push } = useToast()

  const [name, setName] = useState(user?.name ?? '')
  const [tagline, setTagline] = useState(user?.tagline ?? '')
  const [newSubject, setNewSubject] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveProfile = async () => {
    await updateProfile({ name: name.trim() || user?.name, tagline })
    push({ title: 'Profile updated', variant: 'success' })
  }

  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      push({ title: 'Notifications unsupported', description: 'This browser does not support notifications.', variant: 'error' })
      return
    }
    if (settings.notificationsEnabled) {
      update({ notificationsEnabled: false })
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      update({ notificationsEnabled: true })
      push({ title: 'Notifications enabled', description: 'You will be notified when a session completes.', variant: 'success' })
    } else {
      push({ title: 'Permission denied', description: 'Enable notifications in your browser settings to use this.', variant: 'error' })
    }
  }

  const addSubject = () => {
    const value = newSubject.trim()
    if (!value) return
    if (settings.subjects.some((s) => s.toLowerCase() === value.toLowerCase())) {
      push({ title: 'Subject already exists', variant: 'error' })
      return
    }
    update({ subjects: [...settings.subjects, value] })
    setNewSubject('')
  }

  const removeSubject = (subject: string) => {
    update({ subjects: settings.subjects.filter((s) => s !== subject) })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Tune your timer, goals, appearance and data. Everything is saved to this device instantly."
      />

      {/* Profile */}
      <Card className="card-pad">
        <CardHeader title="Profile" subtitle="How you appear across StudyStreak" icon={<UserIcon className="h-[18px] w-[18px]" />} />
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="label">Avatar</p>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => updateProfile({ avatar: a })}
                  className={clsx(
                    'flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition',
                    user?.avatar === a
                      ? 'border-sage bg-sage/12'
                      : 'border-line bg-card hover:bg-subtle',
                  )}
                  aria-label={`Choose avatar ${a}`}
                >
                  {a}
                </button>
              ))}
            </div>
            <Field label="Email" className="mt-5" hint="Your email is used to sign in and stays on this device.">
              <TextInput value={user?.email ?? ''} readOnly className="bg-subtle/60 text-muted" />
            </Field>
          </div>
          <div className="space-y-4">
            <Field label="Display name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </Field>
            <Field label="Tagline">
              <TextInput
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Finals in 6 weeks — no days off."
              />
            </Field>
            <div className="flex items-center gap-2">
              <Button leftIcon={<Save className="h-4 w-4" />} onClick={saveProfile}>
                Save profile
              </Button>
              <Button variant="outline" onClick={() => void logout()}>
                Log out
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Appearance */}
      <Card className="card-pad">
        <CardHeader title="Appearance" subtitle="Light by default, with a warm dark mode" icon={<Palette className="h-[18px] w-[18px]" />} />
        <div className="mt-4">
          <Segmented
            value={settings.theme}
            onChange={(v) => update({ theme: v as ThemePreference })}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        </div>
      </Card>

      {/* Timer */}
      <Card className="card-pad">
        <CardHeader title="Timer" subtitle="Session lengths and pomodoro cycle" icon={<TimerIcon className="h-[18px] w-[18px]" />} />
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Pomodoro (min)">
            <NumberStepper value={settings.pomodoroMin} onChange={(v) => update({ pomodoroMin: v })} min={1} max={180} suffix="min" ariaLabel="pomodoro length" />
          </Field>
          <Field label="Short break (min)">
            <NumberStepper value={settings.shortBreakMin} onChange={(v) => update({ shortBreakMin: v })} min={1} max={60} suffix="min" ariaLabel="short break length" />
          </Field>
          <Field label="Long break (min)">
            <NumberStepper value={settings.longBreakMin} onChange={(v) => update({ longBreakMin: v })} min={1} max={90} suffix="min" ariaLabel="long break length" />
          </Field>
          <Field label="Custom (min)">
            <NumberStepper value={settings.customMin} onChange={(v) => update({ customMin: v })} min={1} max={600} suffix="min" ariaLabel="custom length" />
          </Field>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Long break every (focus sessions)">
            <NumberStepper value={settings.longBreakInterval} onChange={(v) => update({ longBreakInterval: v })} min={2} max={12} suffix="blocks" ariaLabel="long break interval" />
          </Field>
          <Field
            label="Minimum session to count toward streak"
            hint="Shorter focus sessions still log study time but will not extend a streak."
          >
            <NumberStepper
              value={Math.round(settings.minQualifyingSec / 60)}
              onChange={(v) => update({ minQualifyingSec: Math.max(1, v) * 60 })}
              min={1}
              max={60}
              suffix="min"
              ariaLabel="minimum qualifying session"
            />
          </Field>
        </div>
        <div className="mt-5 space-y-3 border-t border-line pt-5">
          <Toggle
            checked={settings.autoStartBreaks}
            onChange={(v) => update({ autoStartBreaks: v })}
            label="Auto-start breaks"
            description="Begin the break automatically when a focus session ends."
          />
          <Toggle
            checked={settings.autoStartFocus}
            onChange={(v) => update({ autoStartFocus: v })}
            label="Auto-start next focus"
            description="Begin the next focus session automatically when a break ends."
          />
        </div>
      </Card>

      {/* Goals */}
      <Card className="card-pad">
        <CardHeader title="Study goals" subtitle="Targets that drive your dashboard" icon={<Target className="h-[18px] w-[18px]" />} />
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <Field label="Daily study goal (min)">
            <NumberStepper value={settings.dailyGoalMin} onChange={(v) => update({ dailyGoalMin: v })} min={0} max={720} step={15} suffix="min" ariaLabel="daily goal" />
          </Field>
          <Field label="Weekly study goal">
            <select
              className="input cursor-pointer"
              value={Math.round(settings.weeklyGoalMin / 60)}
              onChange={(e) => update({ weeklyGoalMin: Number(e.target.value) * 60 })}
            >
              {WEEKLY_HOURS_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h} hours
                </option>
              ))}
            </select>
          </Field>
          <Field label="Daily session target">
            <NumberStepper value={settings.dailySessionGoal} onChange={(v) => update({ dailySessionGoal: v })} min={1} max={20} suffix="sessions" ariaLabel="daily session target" />
          </Field>
        </div>
      </Card>

      {/* Notifications & sound */}
      <Card className="card-pad">
        <CardHeader title="Notifications & sound" subtitle="Gentle nudges, never noisy" icon={<Bell className="h-[18px] w-[18px]" />} />
        <div className="mt-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">Browser notifications</p>
              <p className="mt-0.5 text-xs text-muted">Show a system notification when a session completes.</p>
            </div>
            <Button
              variant={settings.notificationsEnabled ? 'subtle' : 'outline'}
              size="sm"
              leftIcon={settings.notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              onClick={requestNotifications}
            >
              {settings.notificationsEnabled ? 'Enabled' : 'Enable'}
            </Button>
          </div>
          <div className="border-t border-line pt-5">
            <Toggle
              checked={settings.soundEnabled}
              onChange={(v) => update({ soundEnabled: v })}
              label="Completion chime"
              description="Play a soft chime when sessions and breaks finish."
            />
            <div className="mt-4">
              <Field label={`Chime volume — ${Math.round(settings.chimeVolume * 100)}%`}>
                <div className="flex items-center gap-3">
                  <Volume2 className="h-4 w-4 text-muted" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.chimeVolume}
                    onChange={(e) => update({ chimeVolume: Number(e.target.value) })}
                    className="flex-1"
                    style={{ accentColor: 'rgb(var(--c-sage))' }}
                    aria-label="Chime volume"
                  />
                </div>
              </Field>
            </div>
          </div>
        </div>
      </Card>

      {/* Subjects */}
      <Card className="card-pad">
        <CardHeader title="Subjects" subtitle="Organise your sessions by topic" icon={<Plus className="h-[18px] w-[18px]" />} />
        <div className="mt-4 flex flex-wrap gap-2">
          {settings.subjects.map((s) => (
            <span key={s} className="chip !py-1.5 !text-ink">
              {s}
              <button
                type="button"
                onClick={() => removeSubject(s)}
                className="ml-0.5 rounded-full p-0.5 text-muted transition hover:bg-card hover:text-ink"
                aria-label={`Remove ${s}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-end gap-2">
          <Field label="Add subject" className="flex-1">
            <TextInput
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSubject()}
              placeholder="e.g. Chemistry"
            />
          </Field>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={addSubject}>
            Add
          </Button>
        </div>
      </Card>

      {/* Data */}
      <Card className="card-pad">
        <CardHeader title="Data & account" subtitle="Your data lives in this browser" icon={<Database className="h-[18px] w-[18px]" />} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportSessionsCSV(sessions)}>
            Export history (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              exportBackupJSON({ profile: user, sessions, achievements: {}, settings })
              push({ title: 'Backup downloaded', variant: 'success' })
            }}
          >
            Download backup (JSON)
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RotateCcw className="h-4 w-4" />}
            onClick={() => {
              reset()
              push({ title: 'Settings reset to defaults', variant: 'default' })
            }}
          >
            Reset settings
          </Button>
        </div>

        <div className="mt-5 rounded-xl border border-red-400/30 bg-red-500/[0.04] p-4">
          <p className="text-sm font-semibold text-ink">Danger zone</p>
          <p className="mt-1 text-xs text-muted">
            These actions cannot be undone. {sessions.length > 0 ? `${sessions.length} sessions on record.` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" size="sm" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmClear(true)}>
              Clear all sessions
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete account
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-center gap-2 pb-2 text-xs text-muted">
        <Badge tone="neutral">StudyStreak</Badge>
        <span>Local-first · v1.0 · Built for focus</span>
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear all sessions?"
        description="This removes every recorded session, resets your streak, and clears statistics. Achievements stay unlocked."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await clearAllSessions()
                setConfirmClear(false)
                push({ title: 'All sessions cleared', variant: 'default' })
              }}
            >
              Clear everything
            </Button>
          </>
        }
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your account?"
        description="Your profile, sessions, settings and achievements will be permanently removed from this device."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteAccount()
                push({ title: 'Account deleted', variant: 'default' })
              }}
            >
              Delete account
            </Button>
          </>
        }
      />
    </div>
  )
}
