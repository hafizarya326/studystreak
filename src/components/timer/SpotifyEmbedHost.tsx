import { useEffect, useState, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { useAudio } from '../../context/AudioContext'
import { useSettings } from '../../context/SettingsContext'
import { spotifyEmbedUrl } from '../../lib/music'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

/**
 * Single persistent Spotify embed host mounted once at the AppLayout root.
 *
 * CRITICAL: Browsers reload an <iframe> whenever it is unmounted OR moved to a
 * different DOM parent (including retargeting a React portal), which restarts
 * Spotify playback. Keeping one <iframe> in a fixed parent and repositioning
 * it purely with CSS over whichever placeholder slot is active (SoundCard or
 * Fullscreen Focus Mode) preserves uninterrupted playback across:
 *   - entering / exiting Fullscreen Focus Mode
 *   - collapsing / expanding the Focus Mode mini player
 *   - navigating between routes while Spotify is active
 *
 * Note on blending & color-scheme:
 * Browsers paint an opaque white canvas behind cross-origin iframes whenever
 * the iframe's `color-scheme` mismatches the host page. Setting `colorScheme:
 * 'dark'` on the wrapper/iframe to match Spotify's `theme=0` dark embed and
 * clipping with `overflow-hidden rounded-2xl` eliminates any white area.
 */
export function SpotifyEmbedHost() {
  const { settings } = useSettings()
  const {
    spotifyRef,
    focusMode,
    spotifyMiniCollapsed,
    toggleSpotifyMini,
    spotifyCardSlot,
    spotifyFullscreenSlot,
  } = useAudio()

  const active = settings.musicSource === 'spotify' && spotifyRef !== null
  const activeSlot = focusMode
    ? spotifyMiniCollapsed
      ? null
      : spotifyFullscreenSlot
    : spotifyCardSlot

  const [measured, setMeasured] = useState<{ slot: HTMLDivElement; rect: Rect } | null>(null)

  useEffect(() => {
    if (!active || !activeSlot) return

    let raf = 0
    const measure = () => {
      raf = 0
      const box = activeSlot.getBoundingClientRect()
      if (box.width <= 0 || box.height <= 0) {
        setMeasured((prev) => (prev?.slot === activeSlot ? null : prev))
        return
      }
      setMeasured((prev) => {
        if (
          prev &&
          prev.slot === activeSlot &&
          Math.abs(prev.rect.top - box.top) < 0.5 &&
          Math.abs(prev.rect.left - box.left) < 0.5 &&
          Math.abs(prev.rect.width - box.width) < 0.5 &&
          Math.abs(prev.rect.height - box.height) < 0.5
        ) {
          return prev
        }
        return {
          slot: activeSlot,
          rect: { top: box.top, left: box.left, width: box.width, height: box.height },
        }
      })
    }

    const schedule = () => {
      if (raf) return
      raf = window.requestAnimationFrame(measure)
    }

    schedule()
    window.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule, { passive: true })

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule)
      ro.observe(activeSlot)
      if (document.body) ro.observe(document.body)
    }

    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      ro?.disconnect()
    }
  }, [active, activeSlot, focusMode, spotifyMiniCollapsed])

  if (!active || !spotifyRef) return null

  const rect = activeSlot && measured?.slot === activeSlot ? measured.rect : null
  const visible = Boolean(activeSlot && rect)

  // When collapsed or off-page, keep the iframe mounted with non-zero dimensions
  // and `opacity: 0; pointer-events: none` (never `display: none`) so browsers
  // do not reload, throttle, or pause playback.
  const containerStyle: CSSProperties =
    visible && rect
      ? {
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          zIndex: focusMode ? 76 : 10,
          opacity: 1,
          pointerEvents: 'auto',
          colorScheme: 'dark',
          backgroundColor: 'transparent',
        }
      : {
          position: 'fixed',
          top: 0,
          left: 0,
          width: 320,
          height: 80,
          zIndex: -1,
          opacity: 0,
          pointerEvents: 'none',
          colorScheme: 'dark',
          backgroundColor: 'transparent',
        }

  return (
    <div
      style={containerStyle}
      aria-hidden={!visible}
      className="transition-opacity duration-200 ease-out"
    >
      <div
        className={clsx(
          'h-full w-full overflow-hidden border',
          focusMode
            ? 'rounded-2xl border-black/10 bg-card/80 shadow-lift dark:border-white/10 dark:bg-card/60'
            : 'rounded-xl border-line bg-card',
        )}
      >
        <iframe
          title="Spotify player"
          src={spotifyEmbedUrl(spotifyRef)}
          width="100%"
          height="100%"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          style={{
            border: 0,
            display: 'block',
            width: '100%',
            height: '100%',
            backgroundColor: 'transparent',
            colorScheme: 'dark',
          }}
        />
      </div>
      {focusMode && visible ? (
        <button
          type="button"
          onClick={toggleSpotifyMini}
          aria-label="Collapse Spotify player"
          aria-expanded={true}
          title="Collapse Spotify player"
          className="absolute -top-3 right-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-card/95 text-muted shadow-soft backdrop-blur-md transition hover:bg-subtle hover:text-ink dark:border-white/10"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}
