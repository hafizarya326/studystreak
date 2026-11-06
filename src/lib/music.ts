/**
 * Custom background music.
 *
 * - `musicEngine` plays an audio file the user owns (direct URL or an uploaded
 *   file materialised as an object URL). Full play/pause/volume control, so it
 *   stays in sync with the timer.
 * - `parseSpotifyLink` merely extracts an embed id — Spotify playback is owned
 *   by their iframe and cannot be driven by code (needs Premium + OAuth for the
 *   Web Playback SDK), so Spotify is display-only.
 */

export interface SpotifyRef {
  type: 'track' | 'album' | 'playlist' | 'artist' | 'episode' | 'show'
  id: string
}

const SPOTIFY_TYPES = 'track|album|playlist|artist|episode|show'

/** Accepts open.spotify.com URLs, embed URLs and spotify: URIs. Returns null if unusable. */
export function parseSpotifyLink(input: string): SpotifyRef | null {
  const value = input.trim()
  if (!value) return null

  const uri = value.match(new RegExp(`^spotify:(${SPOTIFY_TYPES}):([A-Za-z0-9]+)$`))
  if (uri) return { type: uri[1] as SpotifyRef['type'], id: uri[2] }

  const url = value.match(
    new RegExp(`open\\.spotify\\.com/(?:embed/)?(${SPOTIFY_TYPES})/([A-Za-z0-9]+)`),
  )
  if (url) return { type: url[1] as SpotifyRef['type'], id: url[2] }

  return null
}

export function spotifyEmbedUrl(ref: SpotifyRef): string {
  // Compact player for a single item, taller list for collections.
  const compact = ref.type === 'track' || ref.type === 'episode'
  return `https://open.spotify.com/embed/${ref.type}/${ref.id}?utm_source=generator${
    compact ? '' : '&theme=0'
  }`
}

export function spotifyEmbedHeight(ref: SpotifyRef): number {
  return ref.type === 'track' || ref.type === 'episode' ? 152 : 352
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
      this.el = el
    }
    return this.el
  }

  play(src: string, volume: number): void {
    const el = this.ensure()
    if (!el) return
    if (this.src !== src) {
      el.src = src
      this.src = src
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
