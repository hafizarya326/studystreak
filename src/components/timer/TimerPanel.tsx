import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronUp,
  Coffee,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useTimer, MODE_LABELS } from '../../context/TimerContext'
import { useSettings } from '../../context/SettingsContext'
import { useAudio } from '../../context/AudioContext'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { ProgressRing } from '../ui/ProgressRing'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'
import { TextInput } from '../ui/Field'
import { NowPlayingBar } from './NowPlayingBar'
import { formatClock } from '../../lib/date'
import { spotifyMiniHeight } from '../../lib/music'
import { LIMITS } from '../../lib/security'

const FOCUS_MODE_STORAGE_KEY = 'studystreak.v1:focus_mode'

function readSavedFocusMode(): boolean {
  try {
    return window.sessionStorage.getItem(FOCUS_MODE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeSavedFocusMode(active: boolean): void {
  try {
    if (active) window.sessionStorage.setItem(FOCUS_MODE_STORAGE_KEY, '1')
    else window.sessionStorage.removeItem(FOCUS_MODE_STORAGE_KEY)
  } catch {
    /* sessionStorage may be unavailable */
  }
}

const MODES = [
  { value: 'pomodoro' as const, label: 'Pomodoro' },
  { value: 'short' as const, label: 'Short Break' },
  { value: 'long' as const, label: 'Long Break' },
  { value: 'custom' as const, label: 'Custom' },
]

export function TimerPanel({
  compact = false,
  showSetup = true,
  className,
}: {
  compact?: boolean
  showSetup?: boolean
  className?: string
}) {
  const timer = useTimer()
  const { settings, update } = useSettings()
  const {
    nowPlaying,
    skipNext,
    skipPrev,
    spotifyRef,
    setFocusMode: setAudioFocusMode,
    spotifyMiniCollapsed,
    toggleSpotifyMini,
    spotifyPlayHintDismissed,
    dismissSpotifyPlayHint,
    registerSpotifySlot,
  } = useAudio()
  const [focusMode, setFocusMode] = useState<boolean>(() => (showSetup ? readSavedFocusMode() : false))

  const audioRef = useRef({ nowPlaying, skipNext, skipPrev })
  useEffect(() => {
    audioRef.current = { nowPlaying, skipNext, skipPrev }
  })

  // Keep AudioContext aware of Focus Mode so the persistent SpotifyEmbedHost
  // repositions its single <iframe> without ever unmounting or reloading it.
  // IMPORTANT: Do NOT clear `registerSpotifySlot('fullscreen', null)` in the
  // `[focusMode]` effect cleanup — React attaches the slot callback ref during
  // commit BEFORE running the previous effect's cleanup, so clearing there
  // wipes out the newly mounted fullscreen slot in production builds.
  useEffect(() => {
    setAudioFocusMode(focusMode)
    if (showSetup) writeSavedFocusMode(focusMode)
  }, [focusMode, showSetup, setAudioFocusMode])

  // Clean up only on unmount (slot unmount itself also triggers callback ref with null).
  useEffect(() => {
    return () => {
      setAudioFocusMode(false)
      registerSpotifySlot('fullscreen', null)
    }
  }, [setAudioFocusMode, registerSpotifySlot])

  // Lock page scroll while Focus Mode is open so the underlying page scrollbar
  // never shows along the right edge of the 100dvh overlay.
  useEffect(() => {
    if (!focusMode) return
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
    }
  }, [focusMode])

  const spotifyFullscreenSlotRef = useCallback(
    (el: HTMLDivElement | null) => {
      registerSpotifySlot('fullscreen', el)
    },
    [registerSpotifySlot],
  )

  const isSm = useMediaQuery('(min-width: 640px)')
  const isLg = useMediaQuery('(min-width: 1024px)')
  const ringSize = compact ? (isSm ? 210 : 178) : isLg ? 320 : isSm ? 280 : 232
  const ringStroke = compact ? 10 : isLg ? 12 : 11

  const isRunning = timer.status === 'running'
  const isPaused = timer.status === 'paused'
  const isCompleted = timer.status === 'completed'
  const isFocusInterval = timer.type === 'focus'

  // Real fullscreen + overlay.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFocusMode(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Keyboard shortcuts while inside Fullscreen Focus Mode:
  // N = Next track / ambient preset, P = Previous track, Escape = Exit focus.
  // Kept distinct from TimerPage's Space (Start/Pause), R (Reset), and S (Skip timer).
  useEffect(() => {
    if (!focusMode) return
    const isTyping = (el: EventTarget | null) => {
      const node = el as HTMLElement | null
      if (!node) return false
      return (
        node.tagName === 'INPUT' ||
        node.tagName === 'TEXTAREA' ||
        node.tagName === 'SELECT' ||
        node.isContentEditable
      )
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const { nowPlaying: np, skipNext: next, skipPrev: prev } = audioRef.current
      if (e.key === 'n' || e.key === 'N') {
        if (np?.canSkip) {
          e.preventDefault()
          next()
        }
      } else if (e.key === 'p' || e.key === 'P') {
        if (np?.canPrev) {
          e.preventDefault()
          prev()
        }
      } else if (e.key === 'Escape') {
        setFocusMode(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

  const enterFocus = () => {
    setFocusMode(true)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
  const exitFocus = () => {
    setFocusMode(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  const primaryLabel = isCompleted
    ? 'Next session'
    : isRunning
      ? 'Pause'
      : isPaused
        ? 'Resume'
        : 'Start'

  const onPrimary = () => {
    if (isCompleted) {
      timer.skip()
      return
    }
    timer.toggle()
  }

  const renderRing = (inFocusMode = false) => (
    <ProgressRing
      size={inFocusMode ? 296 : ringSize}
      displaySize={inFocusMode ? 'clamp(176px, min(72vw, 38dvh), 296px)' : undefined}
      stroke={inFocusMode ? 11 : ringStroke}
      progress={isCompleted ? 1 : Math.max(0, Math.min(1, timer.progress))}
      gradientFrom={isFocusInterval ? 'rgb(var(--c-sage))' : 'rgb(var(--c-sage))'}
      gradientTo={isFocusInterval ? 'rgb(var(--c-sage-600))' : 'rgb(var(--c-sage-600))'}
      trackClassName="stroke-subtle"
    >
      <div className="flex flex-col items-center px-4">
        <span
          className={clsx(
            'mb-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
            isFocusInterval ? 'bg-sage/12 text-sage-700' : 'bg-subtle text-muted',
          )}
        >
          {isFocusInterval ? <Sparkles className="h-3 w-3" /> : <Coffee className="h-3 w-3" />}
          {MODE_LABELS[timer.modeId]}
        </span>
        <span
          className={clsx(
            'font-display font-extrabold leading-none tabular-nums text-ink',
            inFocusMode
              ? 'text-[clamp(2.25rem,6.5dvh,3.6rem)]'
              : compact
                ? 'text-4xl'
                : isLg
                  ? 'text-[62px]'
                  : 'text-[52px]',
          )}
        >
          {formatClock(timer.remainingSec, { showHours: timer.durationSec >= 3600 })}
        </span>
        <span className="mt-2 text-xs font-medium text-muted">
          {isCompleted
            ? 'Completed — nice work'
            : isRunning
              ? 'Focus in progress'
              : isPaused
                ? 'Paused'
                : `${formatClock(timer.durationSec, { showHours: timer.durationSec >= 3600 })} session`}
        </span>
      </div>
    </ProgressRing>
  )

  const ring = renderRing(false)

  const controls = (
    <div className="flex items-center justify-center gap-2.5">
      <button
        type="button"
        onClick={timer.reset}
        disabled={timer.status === 'idle'}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-ink transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Reset timer"
        title="Reset"
      >
        <RotateCcw className="h-[18px] w-[18px]" />
      </button>

      <Button
        size={compact ? 'md' : 'lg'}
        variant={isFocusInterval ? 'primary' : 'subtle'}
        onClick={onPrimary}
        className={clsx('min-w-[9rem]', !isFocusInterval && !isCompleted && 'bg-sage text-white hover:bg-sage-600')}
        leftIcon={
          isCompleted ? (
            <SkipForward className="h-4 w-4" />
          ) : isRunning ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )
        }
      >
        {primaryLabel}
      </Button>

      <button
        type="button"
        onClick={timer.skip}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-ink transition hover:bg-subtle"
        aria-label="Skip session"
        title="Skip session"
      >
        <SkipForward className="h-[18px] w-[18px]" />
      </button>
    </div>
  )

  const setup = showSetup ? (
    <div className="mt-6 space-y-4">
      <Segmented
        options={MODES}
        value={timer.modeId}
        onChange={timer.setMode}
        className="flex w-full flex-wrap justify-center sm:inline-flex sm:w-auto"
      />

      {timer.modeId === 'custom' ? (
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs font-medium text-muted">Custom length</span>
          <div className="flex items-center gap-1.5">
            <TextInput
              type="number"
              min={1}
              max={600}
              value={settings.customMin}
              onChange={(e) => {
                const v = Number(e.target.value)
                update({ customMin: v })
                timer.setCustomMinutes(v)
              }}
              className="w-20 py-1.5 text-center"
              aria-label="Custom duration in minutes"
            />
            <span className="text-xs text-muted">min</span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Subject</span>
          <TextInput
            list="subject-options"
            value={timer.subject}
            onChange={(e) => timer.setSubject(e.target.value)}
            maxLength={LIMITS.subject}
            placeholder="What are you studying?"
          />
          <datalist id="subject-options">
            {settings.subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="label">Session label (optional)</span>
          <TextInput
            value={timer.label}
            onChange={(e) => timer.setLabel(e.target.value)}
            maxLength={LIMITS.label}
            placeholder="e.g. Chapter 4 — Thermodynamics"
          />
        </label>
      </div>
    </div>
  ) : null

  const utilityRow = (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => update({ soundEnabled: !settings.soundEnabled })}
        className={clsx(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition',
          settings.soundEnabled ? 'border-sage/30 bg-sage/10 text-sage-700' : 'border-line bg-card text-muted',
        )}
        aria-pressed={settings.soundEnabled}
      >
        {settings.soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        {settings.soundEnabled ? 'Sound on' : 'Sound off'}
      </button>

      {!isFocusInterval ? (
        <PassiveChip label={`Focus blocks completed: ${timer.pomodorosCompleted}`} />
      ) : null}

      <button
        type="button"
        onClick={focusMode ? exitFocus : enterFocus}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-subtle"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Focus mode
      </button>
    </div>
  )

  return (
    <div className={clsx('flex flex-col items-center', className)}>
      {ring}
      <div className="mt-6 w-full">{controls}</div>
      {utilityRow}
      {setup}

      {/* Full-screen focus mode */}
      {focusMode ? (
        <div
          data-focus-mode="true"
          className="fixed inset-0 z-[70] flex h-[100dvh] w-full flex-col items-center justify-between overflow-hidden bg-bg px-4 pt-5 sm:px-6"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          {/* Top bar: centered subject label + Exit focus button with guaranteed clearance */}
          <div className="relative flex min-h-[2.25rem] w-full shrink-0 items-center justify-center">
            <span className="max-w-full truncate px-24 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              {timer.subject || 'Deep focus'}
            </span>
            <button
              type="button"
              onClick={exitFocus}
              className="absolute right-0 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-xl border border-line bg-card/95 px-3 py-2 text-xs font-medium text-ink shadow-soft backdrop-blur-md transition hover:bg-subtle"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span>Exit focus</span>
            </button>
          </div>

          {/* Center stage: responsive ring + controls */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 py-2">
            {renderRing(true)}
            <div className="shrink-0">{controls}</div>
            <p className="shrink-0 text-center text-xs text-muted">
              Stay with it. Distractions can wait.
            </p>
          </div>

          {/* Bottom audio dock: consistent max-w-[420px] centered pill / 80px Spotify embed */}
          {nowPlaying ? (
            <div className="flex w-full shrink-0 flex-col items-center pt-2">
              {nowPlaying.source === 'spotify' && spotifyRef ? (
                <div className="flex w-full max-w-[420px] flex-col items-center">
                  <div
                    className="relative w-full transition-[height,opacity] duration-200 ease-out"
                    style={{
                      height: spotifyMiniCollapsed ? 40 : spotifyMiniHeight(spotifyRef),
                    }}
                  >
                    {spotifyMiniCollapsed ? (
                      <NowPlayingBar
                        variant="floating"
                        trailingAction={
                          <button
                            type="button"
                            onClick={toggleSpotifyMini}
                            aria-label="Expand Spotify player"
                            aria-expanded={false}
                            title="Expand Spotify player"
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-subtle hover:text-ink"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                        }
                      />
                    ) : (
                      <div
                        role="region"
                        aria-label="Spotify mini player"
                        className="relative h-full w-full"
                      >
                        <div
                          ref={spotifyFullscreenSlotRef}
                          style={{ height: spotifyMiniHeight(spotifyRef) }}
                          className="w-full overflow-hidden rounded-2xl bg-card/50"
                        />
                      </div>
                    )}
                  </div>

                  {!spotifyMiniCollapsed && !spotifyPlayHintDismissed ? (
                    <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-muted/80">
                      <span>Press play in the Spotify player</span>
                      <button
                        type="button"
                        onClick={dismissSpotifyPlayHint}
                        aria-label="Dismiss Spotify playback hint"
                        className="rounded p-0.5 text-muted/80 transition hover:bg-subtle hover:text-ink"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </p>
                  ) : null}
                </div>
              ) : (
                <NowPlayingBar variant="floating" />
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function PassiveChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-muted">
      {label}
    </span>
  )
}
