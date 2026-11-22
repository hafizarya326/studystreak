import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AlertCircle, Disc3, Music, SkipBack, SkipForward, Waves } from 'lucide-react'
import { clsx } from 'clsx'
import { useAudio } from '../../context/AudioContext'
import type { NowPlayingSource } from '../../types'

const SOURCE_META: Record<NowPlayingSource, { label: string; Icon: typeof Music }> = {
  ambient: { label: 'Ambient', Icon: Waves },
  'my-audio': { label: 'My audio', Icon: Music },
  spotify: { label: 'Spotify', Icon: Disc3 },
}

export function NowPlayingBar({
  variant = 'floating',
  trailingAction,
  className,
}: {
  /** 'floating' for Fullscreen Focus Mode 40px pill; 'inline' for SoundCard sync bar. */
  variant?: 'floating' | 'inline'
  /** Optional extra control (e.g. expand chevron for collapsed Spotify mini player). */
  trailingAction?: ReactNode
  className?: string
}) {
  const { nowPlaying, skipNext, skipPrev } = useAudio()
  const viewportRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [overflowPx, setOverflowPx] = useState(0)

  const title = nowPlaying?.title ?? ''

  useEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current
      const text = textRef.current
      if (!viewport || !text) {
        setOverflowPx(0)
        return
      }
      const delta = Math.ceil(text.scrollWidth - viewport.clientWidth)
      setOverflowPx(delta > 2 ? delta : 0)
    }

    measure()
    if (typeof ResizeObserver === 'undefined' || !viewportRef.current) return
    const observer = new ResizeObserver(measure)
    observer.observe(viewportRef.current)
    return () => observer.disconnect()
  }, [title, nowPlaying?.positionLabel])

  if (!nowPlaying) return null

  const { label: sourceLabel, Icon } = SOURCE_META[nowPlaying.source]
  const isFloating = variant === 'floating'
  const marqueeStyle =
    overflowPx > 0
      ? ({
          '--marquee-shift': `-${overflowPx}px`,
          '--marquee-duration': `${Math.max(4, Math.min(14, overflowPx / 26)).toFixed(1)}s`,
        } as CSSProperties)
      : undefined

  return (
    <div
      role="region"
      aria-label="Now playing"
      className={clsx(
        'group flex items-center gap-2.5 text-ink backdrop-blur-md transition-all duration-200 ease-out',
        isFloating
          ? 'h-10 w-full max-w-[420px] rounded-full border border-black/10 bg-card/85 pl-2 pr-1.5 shadow-lift dark:border-white/10 dark:bg-card/70'
          : 'w-full rounded-xl border border-line bg-card/90 px-3 py-2 shadow-soft',
        className,
      )}
    >
      {/* Source icon + active playing dot */}
      <span
        className={clsx(
          'relative flex shrink-0 items-center justify-center rounded-full',
          isFloating ? 'h-6 w-6' : 'h-7 w-7',
          nowPlaying.error ? 'bg-red-500/12 text-red-600' : 'bg-sage/12 text-sage-700',
        )}
        aria-hidden
      >
        {nowPlaying.error ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
        {nowPlaying.isPlaying && !nowPlaying.error ? (
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card bg-sage"
            title="Playing"
          />
        ) : null}
      </span>

      {/* Track title + source metadata */}
      {isFloating ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {sourceLabel}
          </span>
          <span className="shrink-0 text-muted/50" aria-hidden>
            ·
          </span>
          <div
            ref={viewportRef}
            className="min-w-0 flex-1 overflow-hidden"
            title={nowPlaying.error ? `${nowPlaying.title} — ${nowPlaying.error}` : nowPlaying.title}
          >
            <span
              ref={textRef}
              data-overflow={overflowPx > 0 ? 'true' : 'false'}
              style={marqueeStyle}
              className={clsx(
                'now-playing-marquee block truncate whitespace-nowrap text-xs font-medium leading-tight',
                nowPlaying.error ? 'text-red-600' : 'text-ink',
              )}
            >
              {nowPlaying.title}
            </span>
          </div>
          {nowPlaying.positionLabel ? (
            <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted">
              {nowPlaying.positionLabel}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            <span className="truncate">{sourceLabel}</span>
            {nowPlaying.positionLabel ? (
              <span className="shrink-0 tabular-nums opacity-80">· {nowPlaying.positionLabel}</span>
            ) : null}
          </div>
          <div
            ref={viewportRef}
            className="overflow-hidden"
            title={nowPlaying.error ? `${nowPlaying.title} — ${nowPlaying.error}` : nowPlaying.title}
          >
            <span
              ref={textRef}
              data-overflow={overflowPx > 0 ? 'true' : 'false'}
              style={marqueeStyle}
              className={clsx(
                'now-playing-marquee block truncate whitespace-nowrap text-xs font-medium leading-tight',
                nowPlaying.error ? 'text-red-600' : 'text-ink',
              )}
            >
              {nowPlaying.title}
            </span>
          </div>
        </div>
      )}

      {/* Transport controls (shown only when the active source supports prev/next) */}
      {nowPlaying.canPrev || nowPlaying.canSkip ? (
        <div className="flex shrink-0 items-center gap-0.5">
          {nowPlaying.canPrev ? (
            <button
              type="button"
              onClick={skipPrev}
              aria-label={`Previous ${nowPlaying.source === 'ambient' ? 'ambient sound' : 'track'}`}
              title="Previous (P)"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-subtle hover:text-ink"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {nowPlaying.canSkip ? (
            <button
              type="button"
              onClick={skipNext}
              aria-label={`Next ${nowPlaying.source === 'ambient' ? 'ambient sound' : 'track'}`}
              title="Next track (N)"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-subtle hover:text-ink"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {trailingAction ? <div className="flex shrink-0 items-center">{trailingAction}</div> : null}
    </div>
  )
}
