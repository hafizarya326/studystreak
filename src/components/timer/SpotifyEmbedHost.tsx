import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { useAudio } from '../../context/AudioContext'
import { useSettings } from '../../context/SettingsContext'
import { spotifyEmbedHeight, spotifyEmbedUrl, spotifyMiniHeight } from '../../lib/music'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Single persistent Spotify embed host mounted once at the AppLayout root
 * (which lives inside `document.documentElement`, so it remains inside the
 * browser's fullscreen subtree when `document.documentElement.requestFullscreen()`
 * is active).
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

  useIsomorphicLayoutEffect(() => {
    if (!active || !activeSlot) return

    let raf1 = 0
    let raf2 = 0
    let alive = true

    const measure = () => {
      if (!alive) return
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
      if (raf1) window.cancelAnimationFrame(raf1)
      if (raf2) window.cancelAnimationFrame(raf2)
      raf1 = window.requestAnimationFrame(() => {
        raf1 = 0
        measure()
      })
    }

    // Re-measure on two consecutive animation frames after transitions
    // (fullscreenchange, collapse/expand, initial mount) so layout has settled.
    const scheduleSettled = () => {
      if (raf1) window.cancelAnimationFrame(raf1)
      if (raf2) window.cancelAnimationFrame(raf2)
      raf1 = window.requestAnimationFrame(() => {
        raf1 = 0
        measure()
        raf2 = window.requestAnimationFrame(() => {
          raf2 = 0
          measure()
        })
      })
    }

    // Measure immediately inside layout effect + settle on next animation frames.
    measure()
    scheduleSettled()

    window.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', scheduleSettled, { passive: true })
    document.addEventListener('fullscreenchange', scheduleSettled)
    document.addEventListener('webkitfullscreenchange', scheduleSettled)
    document.addEventListener('transitionend', scheduleSettled, { capture: true })

    const fontsReady = document.fonts?.ready
    if (fontsReady) {
      void fontsReady.then(() => {
        if (alive) scheduleSettled()
      })
    }

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule)
      ro.observe(activeSlot)
      // Observe immediate slot ancestors so CSS height transitions (e.g.
      // collapse/expand 40px <-> 80px) keep the fixed iframe locked to the slot.
      if (activeSlot.parentElement) ro.observe(activeSlot.parentElement)
      if (activeSlot.parentElement?.parentElement) {
        ro.observe(activeSlot.parentElement.parentElement)
      }
      if (document.documentElement) ro.observe(document.documentElement)
      if (document.body) ro.observe(document.body)
    }

    return () => {
      alive = false
      if (raf1) window.cancelAnimationFrame(raf1)
      if (raf2) window.cancelAnimationFrame(raf2)
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', scheduleSettled)
      document.removeEventListener('fullscreenchange', scheduleSettled)
      document.removeEventListener('webkitfullscreenchange', scheduleSettled)
      document.removeEventListener('transitionend', scheduleSettled, { capture: true })
      ro?.disconnect()
    }
  }, [active, activeSlot, focusMode, spotifyMiniCollapsed])

  if (!active || !spotifyRef) return null

  const targetHeight = focusMode ? spotifyMiniHeight(spotifyRef) : spotifyEmbedHeight(spotifyRef)
  const rect = activeSlot && measured?.slot === activeSlot ? measured.rect : null
  const visible = Boolean(activeSlot && rect)

  // When collapsed or off-page, keep the iframe mounted with non-zero dimensions
  // and `visibility: hidden; opacity: 0; pointer-events: none` (never `display: none`)
  // so browsers neither reload/pause audio nor paint a ghost layer at (0, 0).
  const containerStyle: CSSProperties =
    visible && rect
      ? {
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: targetHeight,
          zIndex: focusMode ? 76 : 10,
          visibility: 'visible',
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
          height: targetHeight,
          zIndex: -1,
          visibility: 'hidden',
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
        style={{ width: '100%', height: targetHeight }}
        className={clsx(
          'w-full overflow-hidden rounded-2xl ring-1 ring-black/10 dark:ring-white/10',
          focusMode ? 'bg-card/80 shadow-lift dark:bg-card/60' : 'bg-transparent',
        )}
      >
        <iframe
          title="Spotify player"
          src={spotifyEmbedUrl(spotifyRef)}
          width="100%"
          height={targetHeight}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className="block w-full rounded-2xl"
          style={{
            border: 0,
            display: 'block',
            width: '100%',
            height: targetHeight,
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
