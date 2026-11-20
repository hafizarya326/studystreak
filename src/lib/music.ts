/**
 * Custom background music.
 *
 * - `musicEngine` plays an audio file the user owns (validated HTTPS URL or an
 *   uploaded file materialised as a same-origin object URL). Full play/pause/
 *   volume control, so it stays in sync with the timer.
 * - `parseSpotifyLink` strictly parses open.spotify.com HTTPS URLs and
 *   `spotify:` URIs into an allowlisted embed id — Spotify playback is owned by
 *   their sandboxed iframe and cannot be driven by code.
 */
import { isSameOriginBlobUrl, LIMITS, sanitizeHttpsUrl } from './security'

export interface SpotifyRef {
  type: 'track' | 'album' | 'playlist' | 'artist' | 'episode' | 'show'
  id: string
}

const SPOTIFY_TYPES = 'track|album|playlist|artist|episode|show'
const SPOTIFY_URI_RE = new RegExp(`^spotify:(${SPOTIFY_TYPES}):([A-Za-z0-9]{1,64})$`)
const SPOTIFY_PATH_RE = new RegExp(`^/(?:intl-[a-z]{2}/)?(?:embed/)?(${SPOTIFY_TYPES})/([A-Za-z0-9]{1,64})(?:/.*)?$`)

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

export function spotifyEmbedUrl(ref: SpotifyRef): string {
  // Compact player for a single item, taller list for collections.
  const compact = ref.type === 'track' || ref.type === 'episode'
  return `https://open.spotify.com/embed/${ref.type}/${encodeURIComponent(ref.id)}?utm_source=generator${
    compact ? '' : '&theme=0'
  }`
}

export function spotifyEmbedHeight(ref: SpotifyRef): number {
  return ref.type === 'track' || ref.type === 'episode' ? 152 : 352
}

/** Validate any audio source URL before handing it to HTMLAudioElement. */
export function resolvePlayableAudioSrc(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (isSameOriginBlobUrl(trimmed)) return trimmed
  return sanitizeHttpsUrl(trimmed)
}

/** A single looping <audio> element, shared across the app. */
class MusicEngine {
  private el: HTMLAudioElement | null = null
  private src = ''
  private volume = 0.35

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
      this.el = el
    }
    return this.el
  }

  play(src: string, volume: number): void {
    const safeSrc = resolvePlayableAudioSrc(src)
    if (!safeSrc) {
      this.stop()
      return
    }
    const el = this.ensure()
    if (!el) return
    if (this.src !== safeSrc) {
      el.src = safeSrc
      this.src = safeSrc
    }
    this.volume = clamp01(volume)
    el.volume = this.volume
    void el.play().catch(() => {
      /* autoplay may be blocked until a user gesture */
    })
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

  get isPlaying(): boolean {
    return this.el !== null && !this.el.paused
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))
}

export const musicEngine = new MusicEngine()
