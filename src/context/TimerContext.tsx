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
import type { SessionType, TimerModeId, UserSettings } from '../types'
import { useAuth } from './AuthContext'
import { useSettings } from './SettingsContext'
import { useData } from './DataContext'
import { useToast } from './ToastContext'
import { timerStorage } from '../lib/repository'
import { soundEngine } from '../lib/sound'
import { musicEngine } from '../lib/music'
import { getTrack } from '../lib/audio-library'
import { completionMessage, quoteOfTheDay } from '../lib/quotes'
import { formatDuration } from '../lib/date'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed'

interface TimerSnapshot {
  modeId: TimerModeId
  type: SessionType
  status: TimerStatus
  durationSec: number
  remainingSec: number
  endAt: number | null
  startedAt: number | null
  pomodorosCompleted: number
  subject: string
  label: string
  updatedAt: number
}

export interface TimerResult {
  type: SessionType
  durationSec: number
  completedAt: number
  isFocus: boolean
}

interface TimerContextValue {
  modeId: TimerModeId
  type: SessionType
  status: TimerStatus
  durationSec: number
  remainingSec: number
  elapsedSec: number
  /** 0 → 1 fraction elapsed */
  progress: number
  pomodorosCompleted: number
  subject: string
  label: string
  lastResult: TimerResult | null
  modeLabel: string
  start: () => void
  pause: () => void
  resume: () => void
  toggle: () => void
  reset: () => void
  skip: () => void
  setMode: (mode: TimerModeId) => void
  setSubject: (subject: string) => void
  setLabel: (label: string) => void
  setCustomMinutes: (minutes: number) => void
  dismissResult: () => void
}

const TimerContext = createContext<TimerContextValue | null>(null)

export function durationForMode(mode: TimerModeId, settings: UserSettings): number {
  switch (mode) {
    case 'pomodoro':
      return Math.max(1, Math.round(settings.pomodoroMin * 60))
    case 'short':
      return Math.max(1, Math.round(settings.shortBreakMin * 60))
    case 'long':
      return Math.max(1, Math.round(settings.longBreakMin * 60))
    case 'custom':
      return Math.max(1, Math.round(settings.customMin * 60))
  }
}

export function typeForMode(mode: TimerModeId): SessionType {
  if (mode === 'short') return 'short-break'
  if (mode === 'long') return 'long-break'
  return 'focus'
}

export const MODE_LABELS: Record<TimerModeId, string> = {
  pomodoro: 'Focus',
  short: 'Short Break',
  long: 'Long Break',
  custom: 'Custom Focus',
}

/** Break that should follow a completed focus, based on the long-break cadence. */
function breakAfterFocus(settings: UserSettings, pomodorosCompleted: number): TimerModeId {
  const interval = Math.max(1, settings.longBreakInterval)
  return pomodorosCompleted > 0 && pomodorosCompleted % interval === 0 ? 'long' : 'short'
}

/**
 * The interval that follows the current one.
 * `pomodorosCompleted` must already include the interval being finished.
 */
function nextIntervalAfter(
  type: SessionType,
  pomodorosCompleted: number,
  settings: UserSettings,
): TimerModeId {
  if (type === 'focus') return breakAfterFocus(settings, pomodorosCompleted)
  return 'pomodoro'
}

function freshSnapshot(mode: TimerModeId, settings: UserSettings): TimerSnapshot {
  const durationSec = durationForMode(mode, settings)
  return {
    modeId: mode,
    type: typeForMode(mode),
    status: 'idle',
    durationSec,
    remainingSec: durationSec,
    endAt: null,
    startedAt: null,
    pomodorosCompleted: 0,
    subject: settings.defaultSubject,
    label: '',
    updatedAt: Date.now(),
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const { addSession } = useData()
  const { push } = useToast()

  const [snapshot, setSnapshot] = useState<TimerSnapshot>(() => freshSnapshot('pomodoro', settings))
  const [now, setNow] = useState(() => Date.now())
  const [lastResult, setLastResult] = useState<TimerResult | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const snapRef = useRef(snapshot)
  const settingsRef = useRef(settings)
  const completingRef = useRef(false)

  // Keep refs in sync for event handlers / async callbacks without writing
  // during render.
  useEffect(() => {
    snapRef.current = snapshot
    settingsRef.current = settings
  })

  /* --------------------------- hydration --------------------------- */

  useEffect(() => {
    const stored = user ? timerStorage.read<TimerSnapshot>(user.id) : null
    if (stored && stored.durationSec > 0 && stored.modeId) {
      setSnapshot({ ...stored })
    } else {
      setSnapshot(freshSnapshot('pomodoro', settingsRef.current))
    }
    setNow(Date.now())
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  /* --------------------------- persistence --------------------------- */

  useEffect(() => {
    if (!hydrated || !user) return
    timerStorage.write(user.id, snapshot)
  }, [snapshot, user, hydrated])

  /* --------------------------- ticking --------------------------- */

  useEffect(() => {
    if (snapshot.status !== 'running') return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [snapshot.status, snapshot.endAt])

  // Recompute instantly when the tab becomes visible again so a throttled
  // background tab never drifts.
  useEffect(() => {
    if (snapshot.status !== 'running') return
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [snapshot.status])

  const remainingSec = useMemo(() => {
    if (snapshot.status === 'running' && snapshot.endAt) {
      return Math.max(0, Math.round((snapshot.endAt - now) / 1000))
    }
    return Math.max(0, snapshot.remainingSec)
  }, [snapshot.status, snapshot.endAt, snapshot.remainingSec, now])

  /* --------------------------- ambient / custom audio --------------------------- */

  // Resolve the custom track source: an explicit URL wins, otherwise the
  // uploaded blob from IndexedDB (turned into a temporary object URL).
  const [customSrc, setCustomSrc] = useState('')
  useEffect(() => {
    let alive = true
    let objectUrl = ''
    if (!user || settings.musicSource !== 'custom' || settings.customAudioUrl) {
      setCustomSrc('')
      return
    }
    void (async () => {
      const blob = await getTrack(user.id)
      if (!alive || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setCustomSrc(objectUrl)
    })()
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [user, settings.musicSource, settings.customAudioUrl, settings.customAudioName])

  const customTrackSrc =
    settings.musicSource === 'custom' ? settings.customAudioUrl || customSrc : ''

  useEffect(() => {
    const focusRunning = snapshot.status === 'running' && snapshot.type === 'focus'

    const ambientShouldPlay =
      focusRunning && settings.musicSource === 'ambient' && settings.ambient !== 'none'
    if (ambientShouldPlay) soundEngine.startAmbient(settings.ambient, settings.ambientVolume)
    else soundEngine.stopAmbient()

    const customShouldPlay = focusRunning && settings.musicSource === 'custom' && !!customTrackSrc
    if (customShouldPlay) musicEngine.play(customTrackSrc, settings.ambientVolume)
    else musicEngine.stop()

    // Intentionally keyed on start/stop conditions only; volume is handled below
    // so dragging the volume slider doesn't restart playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.status, snapshot.type, settings.musicSource, settings.ambient, customTrackSrc])

  useEffect(() => {
    soundEngine.setAmbientVolume(settings.ambientVolume)
    musicEngine.setVolume(settings.ambientVolume)
  }, [settings.ambientVolume])

  /* --------------------------- completion --------------------------- */

  const advanceTo = useCallback((mode: TimerModeId, autoStart: boolean, pomodoros: number) => {
    const s = settingsRef.current
    const durationSec = durationForMode(mode, s)
    setSnapshot({
      modeId: mode,
      type: typeForMode(mode),
      status: autoStart ? 'running' : 'idle',
      durationSec,
      remainingSec: durationSec,
      endAt: autoStart ? Date.now() + durationSec * 1000 : null,
      startedAt: autoStart ? Date.now() : null,
      pomodorosCompleted: pomodoros,
      subject: snapRef.current.subject,
      label: '',
      updatedAt: Date.now(),
    })
    if (autoStart) setNow(Date.now())
  }, [])

  const complete = useCallback(
    async (endedAtOverride?: number) => {
      if (completingRef.current) return
      completingRef.current = true
      const snap = snapRef.current
      const s = settingsRef.current
      const endedAt = endedAtOverride ?? snap.endAt ?? Date.now()
      const startedAt = snap.startedAt ?? endedAt - snap.durationSec * 1000
      const isFocus = snap.type === 'focus'

      // 1. Persist the completed focus session (breaks are never recorded).
      if (isFocus) {
        await addSession({
          startedAt,
          endedAt,
          durationSec: snap.durationSec,
          type: 'focus',
          subject: snap.subject || s.defaultSubject,
          label: snap.label || undefined,
          completed: true,
          modeId: snap.modeId === 'short' || snap.modeId === 'long' ? 'pomodoro' : snap.modeId,
        })
      }

      const nextPomodoros = isFocus ? snap.pomodorosCompleted + 1 : snap.pomodorosCompleted

      // 2. Feedback: chime + toast + optional browser notification.
      if (s.soundEnabled) soundEngine.playChime(s.chimeVolume)
      const durationText = formatDuration(snap.durationSec)
      if (isFocus) {
        push({
          title: `Focus session complete · ${durationText}`,
          description: completionMessage(),
          variant: 'success',
        })
      } else {
        push({
          title: 'Break finished',
          description: 'Time to get back into deep focus.',
          variant: 'default',
        })
      }
      if (s.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(isFocus ? 'Focus session complete' : 'Break finished', {
            body: isFocus ? `${durationText} logged. Well done!` : 'Ready for your next focus session?',
          })
        } catch {
          /* notifications may be blocked */
        }
      }

      setLastResult({ type: snap.type, durationSec: snap.durationSec, completedAt: endedAt, isFocus })

      // 3. Advance: auto-start the next interval, or park on a "completed" screen
      //    that keeps the finished session visible until the user continues.
      const nextMode = nextIntervalAfter(snap.type, nextPomodoros, s)
      const autoStart = isFocus ? s.autoStartBreaks : s.autoStartFocus
      if (autoStart) {
        advanceTo(nextMode, true, nextPomodoros)
      } else {
        setSnapshot((prev) => ({
          ...prev,
          status: 'completed',
          remainingSec: 0,
          endAt: null,
          startedAt: null,
          pomodorosCompleted: nextPomodoros,
          updatedAt: Date.now(),
        }))
      }

      completingRef.current = false
    },
    [addSession, advanceTo, push],
  )

  useEffect(() => {
    if (!hydrated) return
    if (snapshot.status === 'running' && snapshot.endAt !== null && now >= snapshot.endAt) {
      void complete()
    }
  }, [snapshot.status, snapshot.endAt, now, hydrated, complete])

  /* --------------------------- actions --------------------------- */

  const start = useCallback(() => {
    soundEngine.unlock()
    const snap = snapRef.current
    if (snap.status === 'running') return
    const remaining = snap.status === 'paused' ? snap.remainingSec : snap.durationSec
    if (settingsRef.current.soundEnabled) soundEngine.playClick(settingsRef.current.chimeVolume)
    setSnapshot((prev) => ({
      ...prev,
      status: 'running',
      remainingSec: remaining,
      endAt: Date.now() + remaining * 1000,
      startedAt: prev.startedAt ?? Date.now(),
      updatedAt: Date.now(),
    }))
    setNow(Date.now())
  }, [])

  const pause = useCallback(() => {
    setSnapshot((prev) => {
      if (prev.status !== 'running') return prev
      const remaining = prev.endAt ? Math.max(0, Math.round((prev.endAt - Date.now()) / 1000)) : prev.remainingSec
      return { ...prev, status: 'paused', remainingSec: remaining, endAt: null, updatedAt: Date.now() }
    })
    soundEngine.stopAmbient()
    musicEngine.stop()
  }, [])

  const resume = useCallback(() => {
    const snap = snapRef.current
    if (snap.status !== 'paused') return
    soundEngine.unlock()
    setSnapshot((prev) => ({
      ...prev,
      status: 'running',
      endAt: Date.now() + prev.remainingSec * 1000,
      startedAt: prev.startedAt ?? Date.now(),
      updatedAt: Date.now(),
    }))
    setNow(Date.now())
  }, [])

  const reset = useCallback(() => {
    soundEngine.stopAmbient()
    musicEngine.stop()
    setSnapshot((prev) => ({
      ...prev,
      status: 'idle',
      remainingSec: prev.durationSec,
      endAt: null,
      startedAt: null,
      updatedAt: Date.now(),
    }))
    setLastResult(null)
  }, [])

  /** Skip the current interval without recording it (interrupted = no streak credit). */
  const skip = useCallback(() => {
    soundEngine.stopAmbient()
    musicEngine.stop()
    const snap = snapRef.current
    const s = settingsRef.current
    const nextMode = nextIntervalAfter(snap.type, snap.pomodorosCompleted, s)
    const durationSec = durationForMode(nextMode, s)
    setSnapshot({
      modeId: nextMode,
      type: typeForMode(nextMode),
      status: 'idle',
      durationSec,
      remainingSec: durationSec,
      endAt: null,
      startedAt: null,
      pomodorosCompleted: snap.pomodorosCompleted,
      subject: snap.subject,
      label: '',
      updatedAt: Date.now(),
    })
  }, [])

  const setMode = useCallback((mode: TimerModeId) => {
    soundEngine.stopAmbient()
    musicEngine.stop()
    const s = settingsRef.current
    const durationSec = durationForMode(mode, s)
    setSnapshot((prev) => ({
      ...prev,
      modeId: mode,
      type: typeForMode(mode),
      status: 'idle',
      durationSec,
      remainingSec: durationSec,
      endAt: null,
      startedAt: null,
      updatedAt: Date.now(),
    }))
  }, [])

  const setSubject = useCallback((subject: string) => {
    setSnapshot((prev) => ({ ...prev, subject, updatedAt: Date.now() }))
  }, [])

  const setLabel = useCallback((label: string) => {
    setSnapshot((prev) => ({ ...prev, label, updatedAt: Date.now() }))
  }, [])

  const setCustomMinutes = useCallback((minutes: number) => {
    const clamped = Math.min(600, Math.max(1, Math.round(minutes)))
    setSnapshot((prev) => {
      if (prev.modeId !== 'custom') return prev
      return {
        ...prev,
        durationSec: clamped * 60,
        remainingSec: prev.status === 'running' ? prev.remainingSec : clamped * 60,
        updatedAt: Date.now(),
      }
    })
  }, [])

  const dismissResult = useCallback(() => setLastResult(null), [])

  const toggle = useCallback(() => {
    const snap = snapRef.current
    if (snap.status === 'running') pause()
    else if (snap.status === 'paused') resume()
    else start()
  }, [pause, resume, start])

  // When settings change the configured duration (and the timer isn't running),
  // keep the idle snapshot's length in sync — e.g. editing Pomodoro minutes.
  useEffect(() => {
    if (snapshot.status !== 'idle') return
    const expected = durationForMode(snapshot.modeId, settings)
    if (expected !== snapshot.durationSec) {
      setSnapshot((prev) => ({
        ...prev,
        durationSec: expected,
        remainingSec: expected,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.pomodoroMin,
    settings.shortBreakMin,
    settings.longBreakMin,
    settings.customMin,
  ])

  const progress = snapshot.durationSec > 0 ? 1 - remainingSec / snapshot.durationSec : 0
  const elapsedSec = Math.max(0, snapshot.durationSec - remainingSec)

  const value = useMemo<TimerContextValue>(
    () => ({
      modeId: snapshot.modeId,
      type: snapshot.type,
      status: snapshot.status,
      durationSec: snapshot.durationSec,
      remainingSec,
      elapsedSec,
      progress,
      pomodorosCompleted: snapshot.pomodorosCompleted,
      subject: snapshot.subject,
      label: snapshot.label,
      lastResult,
      modeLabel: MODE_LABELS[snapshot.modeId],
      start,
      pause,
      resume,
      toggle,
      reset,
      skip,
      setMode,
      setSubject,
      setLabel,
      setCustomMinutes,
      dismissResult,
    }),
    [
      snapshot.modeId,
      snapshot.type,
      snapshot.status,
      snapshot.durationSec,
      snapshot.pomodorosCompleted,
      snapshot.subject,
      snapshot.label,
      remainingSec,
      elapsedSec,
      progress,
      lastResult,
      start,
      pause,
      resume,
      toggle,
      reset,
      skip,
      setMode,
      setSubject,
      setLabel,
      setCustomMinutes,
      dismissResult,
    ],
  )

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer must be used within a TimerProvider')
  return ctx
}

/** Suggestion shown in the timer's completion modal. */
export function timerQuote(): string {
  return quoteOfTheDay().text
}
