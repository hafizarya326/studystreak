import { useEffect, useState } from 'react'
import {
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
} from 'lucide-react'
import { clsx } from 'clsx'
import { useTimer, MODE_LABELS } from '../../context/TimerContext'
import { useSettings } from '../../context/SettingsContext'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { ProgressRing } from '../ui/ProgressRing'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'
import { TextInput } from '../ui/Field'
import { formatClock } from '../../lib/date'

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
  const [focusMode, setFocusMode] = useState(false)

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

  const ring = (
    <ProgressRing
      size={ringSize}
      stroke={ringStroke}
      progress={isCompleted ? 1 : Math.max(0, Math.min(1, timer.progress))}
      gradientFrom={isFocusInterval ? 'rgb(var(--c-sage))' : 'rgb(var(--c-sage))'}
      gradientTo={isFocusInterval ? 'rgb(var(--c-sage-600))' : 'rgb(var(--c-sage-600))'}
      trackClassName="stroke-subtle"
    >
      <div className="flex flex-col items-center">
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
            compact ? 'text-4xl' : isLg ? 'text-[62px]' : 'text-[52px]',
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
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-bg px-6">
          <button
            type="button"
            onClick={exitFocus}
            className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-xs font-medium text-ink transition hover:bg-subtle"
          >
            <Minimize2 className="h-4 w-4" />
            Exit focus
          </button>
          <div className="flex flex-col items-center">
            <span className="mb-8 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              {timer.subject || 'Deep focus'}
            </span>
            {ring}
            <div className="mt-10">{controls}</div>
            <p className="mt-6 text-xs text-muted">Stay with it. Distractions can wait.</p>
          </div>
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
