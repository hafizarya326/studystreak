/**
 * Background audio utilities & custom track player.
 *
 * - Pure helpers for ambient preset cycling, playlist queue index wrapping,
 *   user-friendly title extraction (filenames & URLs), and Spotify oEmbed lookup.
 * - `musicEngine` plays validated HTTPS audio URLs or same-origin uploaded
 *   object URLs with full play/pause/volume/ended/error support so playback
 *   stays in sync with the timer and multi-track queues advance cleanly.
 * - `parseSpotifyLink` strictly parses open.spotify.com HTTPS URLs and
 *   `spotify:` URIs into an allowlisted embed id.
 */
import type { AmbientSoundId } from '../types'
import { isSameOriginBlobUrl, LIMITS, sanitizeHttpsUrl, sanitizeText } from './security'

export interface SpotifyRef {
  type: 'track' | 'album' | 'playlist' | 'artist' | 'episode' | 'show'
  id: string
}

export type ActiveAmbientId = Exclude<AmbientSoundId, 'none'>

export interface AmbientPreset {
  id: ActiveAmbientId
  /** Concise display name shown in Now Playing controls. */
  title: string
  /** Descriptive label shown in the soundscape picker. */
  label: string
}

export const AMBIENT_PRESETS: readonly AmbientPreset[] = [
  { id: 'brown', title: 'Brown noise', label: 'Brown noise (warm)' },
  { id: 'white', title: 'White noise', label: 'White noise (crisp)' },
  { id: 'waves', title: 'Ocean waves', label: 'Ocean waves' },
  { id: 'cafe', title: 'Soft café hum', label: 'Soft café hum' },
]

/** Display title for an active ambient soundscape, or null when set to 'none'. */
export function ambientTitle(id: AmbientSoundId): string | null {
  if (id === 'none') return null
  return AMBIENT_PRESETS.find((p) => p.id === id)?.title ?? null
}

/** Cycle forward (+1) or backward (-1) across the active ambient presets with wrap-around. */
export function cycleAmbient(current: AmbientSoundId, step: 1 | -1): ActiveAmbientId {
  const idx = AMBIENT_PRESETS.findIndex((p) => p.id === current)
  if (idx < 0) return step > 0 ? AMBIENT_PRESETS[0].id : AMBIENT_PRESETS[AMBIENT_PRESETS.length - 1].id
  const nextIdx = wrapIndex(idx, AMBIENT_PRESETS.length, step)
  return AMBIENT_PRESETS[nextIdx].id
}

/**
 * Pure circular index navigation for queues/playlists.
 * Returns -1 for an empty list and 0 for a single-item list.
 */
export function wrapIndex(index: number, length: number, step: 1 | -1): number {
  if (!Number.isFinite(length) || length <= 0) return -1
  if (length === 1) return 0
  const base = Number.isFinite(index) ? Math.trunc(index) : 0
  const normalized = ((base % length) + length) % length
  return (normalized + step + length) % length
}

/**
 * Extract a user-friendly track title from a filename by stripping directories
 * and the trailing file extension (e.g. "lofi_study_beats.mp3" -> "lofi_study_beats").
 */
export function titleFromFilename(filename: string): string {
  const cleaned = sanitizeText(filename, LIMITS.filename)
  if (!cleaned) return 'Untitled track'
  // Take only the basename if a path slipped through.
  const base = cleaned.split(/[/\\]/).pop() ?? cleaned
  // Strip a trailing file extension unless the entire name is a dotfile.
  const withoutExt = base.replace(/(?<=.)\.[A-Za-z0-9]{1,8}$/, '').trim()
  return sanitizeText(withoutExt || base, LIMITS.trackTitle) || 'Untitled track'
}

/**
 * Derive a readable track title from a validated HTTPS audio URL:
 * prefers the decoded filename segment (extension stripped), falling back to hostname.
 */
export function titleFromAudioUrl(rawUrl: string): string {
  const valid = sanitizeHttpsUrl(rawUrl)
  if (!valid) return 'Audio stream'
  try {
    const parsed = new URL(valid)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (last) {
      let decoded = last
      try {
        decoded = decodeURIComponent(last)
      } catch {
        /* keep raw segment if percent-encoding is malformed */
      }
      const title = titleFromFilename(decoded)
      if (title && title !== 'Untitled track') return title
    }
    return sanitizeText(parsed.hostname, LIMITS.trackTitle) || 'Audio stream'
  } catch {
    return 'Audio stream'
  }
}

/* ----------------------------- Spotify helpers ----------------------------- */

const SPOTIFY_TYPES = 'track|album|playlist|artist|episode|show'
const SPOTIFY_URI_RE = new RegExp(`^spotify:(${SPOTIFY_TYPES}):([A-Za-z0-9]{1,64})$`)
const SPOTIFY_PATH_RE = new RegExp(
  `^/(?:intl-[a-z]{2}/)?(?:embed/)?(${SPOTIFY_TYPES})/([A-Za-z0-9]{1,64})(?:/.*)?$`,
)

/** Accepts open.spotify.com HTTPS URLs, embed URLs and spotify: URIs. Returns null if unusable. */
export function parseSpotifyLink(input: string): SpotifyRef | null {
  const value = input.trim()
  if (!value || value.length > LIMITS.url) return null

  const uri = value.match(SPOTIFY_URI_RE)
  if (uri) return { type: uri[1] as SpotifyRef['type'], id: uri[2] }

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return null
    if (parsed.hostname.toLowerCase() !== 'open.spotify.com') return null
    if (parsed.username || parsed.password) return null
    const pathMatch = parsed.pathname.match(SPOTIFY_PATH_RE)
    if (pathMatch) {
      return { type: pathMatch[1] as SpotifyRef['type'], id: pathMatch[2] }
    }
  } catch {
    return null
  }

  return null
}

export function spotifyCanonicalUrl(ref: SpotifyRef): string {
  return `https://open.spotify.com/${ref.type}/${encodeURIComponent(ref.id)}`
}

export function spotifyEmbedUrl(ref: SpotifyRef): string {
  // Always pass `theme=0` so Spotify renders its neutral dark surface instead
  // of a bright/white card background, blending cleanly with both SoundCard and
  // Focus Mode without changing `src` (which would reload the iframe).
  return `https://open.spotify.com/embed/${ref.type}/${encodeURIComponent(ref.id)}?utm_source=generator&theme=0`
}

/**
 * Fixed embed height in SoundCard per Spotify content type:
 * - 80px for single tracks
 * - 152px for playlists, albums, shows, artists, and episodes
 * Never uses the 352px variant, which leaves an opaque white area below Spotify's player.
 */
export function spotifyEmbedHeight(ref: SpotifyRef): number {
  return ref.type === 'track' ? 80 : 152
}

/**
 * Compact height used for the mini Spotify player inside Fullscreen Focus Mode.
 * Spotify's compact horizontal player UI renders at 80px for all content types
 * (track, playlist, album, show, episode, artist) — using 152px leaves an empty
 * block underneath the player.
 */
export function spotifyMiniHeight(_ref?: SpotifyRef): number {
  void _ref
  return 80
}

export function spotifyFallbackTitle(ref: SpotifyRef): string {
  const label = ref.type.charAt(0).toUpperCase() + ref.type.slice(1)
  return `Spotify ${label}`
}

const spotifyTitleCache = new Map<string, string>()

/**
 * Fetch the public playlist/album/track title via Spotify's CORS-enabled oEmbed
 * endpoint (no API key, no login, no backend).
 *
 * Limitation: Spotify's Embed iframe & IFrame API (`EmbedController`) do not
 * expose `next()` / `previous()` track skipping or individual track titles
 * inside a playlist/album — only `play/pause/togglePlay/seek/loadUri` and
 * `{ isPaused, isBuffering, duration, position }`. Using oEmbed gives us the
 * real collection/track title without loading third-party scripts or breaking
 * our strict `script-src 'self'` CSP.
 */
export async function fetchSpotifyTitle(
  ref: SpotifyRef,
  signal?: AbortSignal,
): Promise<string | null> {
  const cacheKey = `${ref.type}:${ref.id}`
  const cached = spotifyTitleCache.get(cacheKey)
  if (cached) return cached

  if (typeof fetch !== 'function') return null
  try {
    const endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyCanonicalUrl(ref))}`
    const res = await fetch(endpoint, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal,
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    if (!data || typeof data !== 'object') return null
    const rawTitle = (data as Record<string, unknown>).title
    const clean = sanitizeText(rawTitle, LIMITS.trackTitle)
    if (!clean) return null
    spotifyTitleCache.set(cacheKey, clean)
    return clean
  } catch {
    return null
  }
}

/* ----------------------------- Audio engine ----------------------------- */

/** Validate any audio source URL before handing it to HTMLAudioElement. */
export function resolvePlayableAudioSrc(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (isSameOriginBlobUrl(trimmed)) return trimmed
  return sanitizeHttpsUrl(trimmed)
}

interface MusicEngineListeners {
  onEnded?: () => void
  onError?: (reason: string) => void
}

/** A single shared <audio> element driven by AudioContext. */
class MusicEngine {
  private el: HTMLAudioElement | null = null
  private src = ''
  private volume = 0.35
  private listeners: MusicEngineListeners = {}

  private ensure(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof window.Audio === 'undefined') return null
    if (!this.el) {
      const el = new Audio()
      el.loop = true
      el.preload = 'auto'
      // Avoid sending credentials or referrer headers to third-party audio hosts.
      el.crossOrigin = 'anonymous'
      try {
        ;(el as HTMLAudioElement & { referrerPolicy?: string }).referrerPolicy = 'no-referrer'
      } catch {
        /* referrerPolicy may be unsupported in older/jsdom environments */
      }
      el.addEventListener('ended', () => {
        if (!el.loop) this.listeners.onEnded?.()
      })
      el.addEventListener('error', () => {
        if (this.src) this.listeners.onError?.('Unable to load or decode this audio track.')
      })
      this.el = el
    }
    return this.el
  }

  setListeners(listeners: MusicEngineListeners): void {
    this.listeners = listeners
  }

  play(src: string, volume: number, opts?: { loop?: boolean }): void {
    const safeSrc = resolvePlayableAudioSrc(src)
    if (!safeSrc) {
      this.stop()
      return
    }
    const el = this.ensure()
    if (!el) return
    el.loop = opts?.loop ?? true
    if (this.src !== safeSrc) {
      el.src = safeSrc
      this.src = safeSrc
    }
    this.volume = clamp01(volume)
    el.volume = this.volume
    void el.play().catch((err: unknown) => {
      // Autoplay rejections (NotAllowedError) are expected before a user gesture
      // and should stay quiet; genuine source/decode errors notify the UI.
      const name = err instanceof Error ? err.name : ''
      if (name && name !== 'NotAllowedError' && name !== 'AbortError') {
        this.listeners.onError?.('Unable to play this audio track.')
      }
    })
  }

  setLoop(loop: boolean): void {
    if (this.el) this.el.loop = loop
  }

  setVolume(volume: number): void {
    this.volume = clamp01(volume)
    if (this.el) this.el.volume = this.volume
  }

  stop(): void {
    if (!this.el) return
    this.el.pause()
    this.el.currentTime = 0
  }

  resetSource(): void {
    this.stop()
    if (this.el) {
      this.el.removeAttribute('src')
      this.el.load()
    }
    this.src = ''
  }

  get isPlaying(): boolean {
    return this.el !== null && !this.el.paused
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))
}

export const musicEngine = new MusicEngine()
