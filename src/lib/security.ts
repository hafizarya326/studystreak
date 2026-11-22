/**
 * Centralized client-side security primitives:
 *  - Prototype-pollution-safe JSON parsing
 *  - Input length & control/BiDi character sanitization
 *  - Strict HTTPS URL validation (blocks dangerous schemes & local/private networks)
 *  - Audio upload MIME allowlist + magic-byte inspection
 *  - Password policy (strength + PBKDF2 DoS length cap)
 *  - Login brute-force rate limiter with exponential backoff
 *  - Defensive storage schema sanitizers (protects against localStorage tampering)
 */
import type {
  AchievementState,
  AmbientSoundId,
  AudioTrackItem,
  MusicSource,
  SessionType,
  StudySession,
  ThemePreference,
  TimerModeId,
  UserRecord,
  UserSettings,
} from '../types'
import { DEFAULT_SETTINGS } from './defaults'

export const LIMITS = {
  name: 80,
  email: 254,
  passwordMin: 8,
  passwordMax: 128,
  tagline: 160,
  avatar: 16,
  subject: 60,
  subjectsMax: 50,
  label: 120,
  note: 2000,
  search: 120,
  url: 2048,
  filename: 120,
  trackTitle: 120,
  audioQueueMax: 50,
  audioUploadBytes: 40 * 1024 * 1024,
  maxSessions: 50_000,
} as const

const FORBIDDEN_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** Parse JSON while stripping prototype-pollution keys (`__proto__`, `constructor`, `prototype`). */
export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    const parsed: unknown = JSON.parse(raw, (key, value: unknown) => {
      if (FORBIDDEN_JSON_KEYS.has(key)) return undefined
      return value
    })
    return (parsed === null || parsed === undefined ? fallback : parsed) as T
  } catch {
    return fallback
  }
}

/** Validate storage identifiers (userId, sessionId) before interpolating into storage keys. */
export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)
}

/**
 * Remove control characters and Unicode BiDi override/isolate controls that
 * can be abused for spoofing or log/UI injection, then enforce a hard length cap.
 */
export function sanitizeText(
  value: unknown,
  maxLen: number,
  opts?: { multiline?: boolean; trim?: boolean },
): string {
  if (typeof value !== 'string') return ''
  // Strip Unicode BiDi controls (RLO, LRO, LRE, RLE, PDF, LRI, RLI, FSI, PDI, LRM, RLM, ALM).
  const noBidi = value.replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C]/g, '')
  const multiline = Boolean(opts?.multiline)
  let out = ''
  for (let i = 0; i < noBidi.length; i++) {
    const code = noBidi.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) {
      if (multiline && (code === 0x0a || code === 0x09)) {
        out += noBidi[i]
      } else if (!multiline) {
        out += ' '
      }
      continue
    }
    out += noBidi[i]
  }
  if (opts?.trim !== false) out = out.trim()
  return out.slice(0, maxLen)
}

/** Sanitize a filename for safe display or download (no path traversal, control, or BiDi chars). */
export function sanitizeFilename(name: string, fallback = 'file'): string {
  const cleaned = sanitizeText(name, LIMITS.filename)
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/^\.+/, '')
    .trim()
  return cleaned || fallback
}

/* ----------------------------- URL security ----------------------------- */

function isPrivateOrLocalHost(rawHostname: string): boolean {
  let host = rawHostname.toLowerCase().trim()
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)
  if (host.endsWith('.')) host = host.slice(0, -1)
  if (!host) return true

  // Loopback / local / internal domain names.
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa')
  ) {
    return true
  }

  // IPv6 literals (loopback, unspecified, ULA fc00::/7, link-local fe80::/10, IPv4-mapped).
  if (host.includes(':')) {
    const compact = host.replace(/^0+/, '')
    if (
      host === '::1' ||
      host === '::' ||
      compact === ':1' ||
      host.startsWith('fe8') ||
      host.startsWith('fe9') ||
      host.startsWith('fea') ||
      host.startsWith('feb') ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('::ffff:') ||
      host.startsWith('0:0:0:0:0:ffff:')
    ) {
      return true
    }
    return false
  }

  // Dotted IPv4 literal check.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    const c = Number(ipv4[3])
    const d = Number(ipv4[4])
    if ([a, b, c, d].some((n) => n < 0 || n > 255)) return true
    if (a === 0) return true // 0.0.0.0/8 unspecified
    if (a === 10) return true // 10.0.0.0/8 RFC1918
    if (a === 127) return true // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12 RFC1918
    if (a === 192 && b === 168) return true // 192.168.0.0/16 RFC1918
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
    if (a >= 224) return true // multicast & reserved
    return false
  }

  // Bare single-label intranet hostnames (e.g. "router", "metadata") or numeric IP tricks.
  if (!host.includes('.')) return true

  return false
}

/**
 * Validate a user-supplied external URL:
 *  - Strictly HTTPS only (blocks javascript:, data:, file:, http:, blob:, etc.)
 *  - No embedded credentials
 *  - Blocks localhost / loopback / private RFC1918 / link-local / metadata hosts
 *  - Enforces max URL length
 */
export function sanitizeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > LIMITS.url) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    if (isPrivateOrLocalHost(url.hostname)) return null
    return url.toString()
  } catch {
    return null
  }
}

/** True only for object URLs created by this app's own origin. */
export function isSameOriginBlobUrl(raw: string): boolean {
  if (!raw.startsWith('blob:')) return false
  if (typeof window === 'undefined' || !window.location?.origin || window.location.origin === 'null') {
    return false
  }
  return raw.startsWith(`blob:${window.location.origin}/`)
}

/* ----------------------------- audio upload security ----------------------------- */

const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/flac',
  'audio/x-flac',
])

/**
 * Inspect leading file magic bytes to verify the payload is genuinely an audio
 * container and not a renamed HTML/SVG/script/executable file.
 */
export function detectAudioMagicBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null

  // ID3v2 tag (MP3): "ID3"
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'audio/mpeg'

  // Ogg container: "OggS"
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return 'audio/ogg'
  }

  // FLAC: "fLaC"
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return 'audio/flac'
  }

  // WAV: "RIFF" .... "WAVE"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return 'audio/wav'
  }

  // WebM / Matroska EBML header: 1A 45 DF A3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'audio/webm'
  }

  // MP4 / M4A ISO Base Media: .... "ftyp"
  if (
    bytes.length >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return 'audio/mp4'
  }

  // Raw MPEG / ADTS frame sync (11-bit syncword: 0xFF + top 3 bits set).
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    // Layer bits == 00 -> AAC ADTS; otherwise MP3 frame.
    return (bytes[1] & 0x06) === 0x00 ? 'audio/aac' : 'audio/mpeg'
  }

  return null
}

export async function validateAudioFile(
  file: File,
): Promise<{ ok: true; blob: Blob; safeName: string } | { ok: false; error: string }> {
  if (file.size <= 0) {
    return { ok: false, error: 'The selected file is empty.' }
  }
  if (file.size > LIMITS.audioUploadBytes) {
    return { ok: false, error: 'Keep audio files under 40 MB.' }
  }

  const mime = (file.type || '').toLowerCase().trim()
  if (mime && !ALLOWED_AUDIO_MIMES.has(mime)) {
    return { ok: false, error: 'Unsupported audio format. Use MP3, OGG, WAV, M4A, AAC, FLAC, or WebM.' }
  }

  let header: Uint8Array
  try {
    const buf = await file.slice(0, 32).arrayBuffer()
    header = new Uint8Array(buf)
  } catch {
    return { ok: false, error: 'Could not read the selected file.' }
  }

  const detectedMime = detectAudioMagicBytes(header)
  if (!detectedMime) {
    return {
      ok: false,
      error: 'File content does not match a valid audio format (MP3, OGG, WAV, FLAC, M4A, AAC, or WebM).',
    }
  }

  // Re-wrap with the verified safe audio MIME type so spoofed types never persist.
  const safeBlob = new Blob([file], { type: detectedMime })
  return { ok: true, blob: safeBlob, safeName: sanitizeFilename(file.name, 'audio-track') }
}

/* ----------------------------- auth security ----------------------------- */

const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty12',
  'qwerty123',
  'abcdefgh',
  'letmein1',
  'welcome1',
  'admin123',
  'studystreak',
  'demo1234',
  'iloveyou',
  '00000000',
  '11111111',
])

/** Returns a user-facing error message if the password is too weak or too long, or null if valid. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < LIMITS.passwordMin) {
    return `Password must be at least ${LIMITS.passwordMin} characters.`
  }
  if (password.length > LIMITS.passwordMax) {
    return `Password must be at most ${LIMITS.passwordMax} characters.`
  }
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return 'This password is too common. Choose a stronger password.'
  }
  // Passphrases of 12+ chars are accepted directly (NIST SP 800-63B); shorter
  // passwords must mix letters and numbers.
  if (password.length < 12 && !(/[A-Za-z]/.test(password) && /\d/.test(password))) {
    return 'Use at least 8 characters with both letters and numbers (or a 12+ character passphrase).'
  }
  return null
}

interface LockoutEntry {
  failures: number
  lockedUntil: number
}

const LOCKOUT_STORAGE_KEY = 'studystreak.v1:auth_lockout'
const LOCKOUT_THRESHOLD = 5
const LOCKOUT_BASE_MS = 30_000
const LOCKOUT_MAX_MS = 5 * 60_000

/**
 * Exponential-backoff brute-force protection for local login attempts.
 * Persists in sessionStorage (with in-memory fallback) so simple page reloads
 * cannot bypass an active cooldown.
 */
class LoginRateLimiter {
  private mem = new Map<string, LockoutEntry>()

  private keyFor(email: string): string {
    return email.trim().toLowerCase().slice(0, LIMITS.email) || '_empty'
  }

  private readAll(): Record<string, LockoutEntry> {
    try {
      const raw = window.sessionStorage.getItem(LOCKOUT_STORAGE_KEY)
      if (!raw) return {}
      const parsed = safeJsonParse<Record<string, LockoutEntry>>(raw, {})
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return Object.fromEntries(this.mem.entries())
    }
  }

  private writeAll(map: Record<string, LockoutEntry>): void {
    try {
      window.sessionStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(map))
    } catch {
      this.mem = new Map(Object.entries(map))
    }
  }

  check(email: string, now = Date.now()): { allowed: true } | { allowed: false; retryAfterSec: number } {
    const k = this.keyFor(email)
    const entry = this.readAll()[k]
    if (entry && entry.lockedUntil > now) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)),
      }
    }
    return { allowed: true }
  }

  recordFailure(email: string, now = Date.now()): void {
    const k = this.keyFor(email)
    const all = this.readAll()
    const prev = all[k] ?? { failures: 0, lockedUntil: 0 }
    const failures = prev.failures + 1
    let lockedUntil = 0
    if (failures >= LOCKOUT_THRESHOLD) {
      const exponent = Math.min(4, failures - LOCKOUT_THRESHOLD)
      const cooldown = Math.min(LOCKOUT_MAX_MS, LOCKOUT_BASE_MS * 2 ** exponent)
      lockedUntil = now + cooldown
    }
    all[k] = { failures, lockedUntil }
    // Keep table bounded to prevent storage bloat.
    const keys = Object.keys(all)
    if (keys.length > 50) {
      for (const oldKey of keys.slice(0, keys.length - 50)) delete all[oldKey]
    }
    this.writeAll(all)
  }

  reset(email: string): void {
    const k = this.keyFor(email)
    const all = this.readAll()
    if (k in all) {
      delete all[k]
      this.writeAll(all)
    }
  }
}

export const loginRateLimiter = new LoginRateLimiter()

/* ----------------------------- schema sanitizers ----------------------------- */

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNum(value, min, max, fallback))
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

const VALID_THEMES: ReadonlySet<ThemePreference> = new Set(['light', 'dark', 'system'])
const VALID_AMBIENTS: ReadonlySet<AmbientSoundId> = new Set(['none', 'brown', 'white', 'waves', 'cafe'])
const VALID_MUSIC_SOURCES: ReadonlySet<MusicSource> = new Set(['ambient', 'custom', 'spotify'])
const VALID_SESSION_TYPES: ReadonlySet<SessionType> = new Set(['focus', 'short-break', 'long-break'])
const VALID_TIMER_MODES: ReadonlySet<TimerModeId> = new Set(['pomodoro', 'short', 'long', 'custom'])

export function sanitizeUserRecord(raw: unknown): UserRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isSafeId(r.id)) return null
  if (typeof r.email !== 'string' || !r.email.includes('@')) return null
  if (typeof r.passwordHash !== 'string' || !r.passwordHash) return null
  if (typeof r.salt !== 'string' || !r.salt) return null

  return {
    id: r.id,
    name: sanitizeText(r.name, LIMITS.name) || 'Student',
    email: sanitizeText(r.email, LIMITS.email).toLowerCase(),
    avatar: sanitizeText(r.avatar, LIMITS.avatar) || '🦉',
    tagline: sanitizeText(r.tagline, LIMITS.tagline),
    createdAt: clampInt(r.createdAt, 0, 8_640_000_000_000_000, Date.now()),
    passwordHash: r.passwordHash.slice(0, 256),
    salt: r.salt.slice(0, 128),
  }
}

export function sanitizeSession(raw: unknown, expectedUserId?: string): StudySession | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (!isSafeId(s.id)) return null

  const startedAt = typeof s.startedAt === 'number' && Number.isFinite(s.startedAt) ? s.startedAt : null
  const endedAt = typeof s.endedAt === 'number' && Number.isFinite(s.endedAt) ? s.endedAt : null
  if (startedAt === null || endedAt === null || startedAt < 0 || endedAt < 0) return null

  const durationSec = clampInt(s.durationSec, 0, 86_400, 0)
  const type = VALID_SESSION_TYPES.has(s.type as SessionType) ? (s.type as SessionType) : 'focus'
  const modeId = VALID_TIMER_MODES.has(s.modeId as TimerModeId) ? (s.modeId as TimerModeId) : 'pomodoro'
  const subject = sanitizeText(s.subject, LIMITS.subject) || 'General'
  const label = sanitizeText(s.label, LIMITS.label)
  const note = sanitizeText(s.note, LIMITS.note, { multiline: true })
  const userId = expectedUserId && isSafeId(expectedUserId)
    ? expectedUserId
    : isSafeId(s.userId)
      ? s.userId
      : 'guest'

  return {
    id: s.id,
    userId,
    startedAt,
    endedAt,
    durationSec,
    type,
    subject,
    label: label || undefined,
    note: note || undefined,
    completed: asBool(s.completed, true),
    modeId,
  }
}

export function sanitizeSettings(raw: unknown): UserSettings {
  const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_SETTINGS

  const theme = VALID_THEMES.has(s.theme as ThemePreference) ? (s.theme as ThemePreference) : d.theme
  const ambient = VALID_AMBIENTS.has(s.ambient as AmbientSoundId)
    ? (s.ambient as AmbientSoundId)
    : d.ambient
  const musicSource = VALID_MUSIC_SOURCES.has(s.musicSource as MusicSource)
    ? (s.musicSource as MusicSource)
    : d.musicSource

  const rawSubjects = Array.isArray(s.subjects) ? s.subjects : d.subjects
  const seen = new Set<string>()
  const subjects: string[] = []
  for (const item of rawSubjects) {
    if (subjects.length >= LIMITS.subjectsMax) break
    const clean = sanitizeText(item, LIMITS.subject)
    if (!clean) continue
    const key = clean.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    subjects.push(clean)
  }

  // Allow keeping partial user input in customAudioUrl up to max length while
  // blocking dangerous protocols; playback also enforces strict HTTPS validation.
  const rawAudioUrl = sanitizeText(s.customAudioUrl, LIMITS.url)
  const safeAudioUrl = /^(javascript|data|vbscript|file):/i.test(rawAudioUrl) ? '' : rawAudioUrl

  const rawSpotifyUrl = sanitizeText(s.spotifyUrl, LIMITS.url)
  const safeSpotifyUrl = /^(javascript|data|vbscript|file):/i.test(rawSpotifyUrl) ? '' : rawSpotifyUrl

  const safeCustomAudioName = sanitizeFilename(
    typeof s.customAudioName === 'string' ? s.customAudioName : '',
    '',
  )

  const customAudioQueue: AudioTrackItem[] = []
  const seenTrackIds = new Set<string>()
  if (Array.isArray(s.customAudioQueue)) {
    for (const entry of s.customAudioQueue) {
      if (customAudioQueue.length >= LIMITS.audioQueueMax) break
      if (!entry || typeof entry !== 'object') continue
      const item = entry as Record<string, unknown>
      if (!isSafeId(item.id) || seenTrackIds.has(item.id)) continue
      const kind = item.kind === 'file' || item.kind === 'url' ? item.kind : null
      if (!kind) continue
      const title = sanitizeText(item.title, LIMITS.trackTitle) || 'Untitled track'
      if (kind === 'url') {
        const cleanUrl = sanitizeHttpsUrl(item.url)
        if (!cleanUrl) continue
        seenTrackIds.add(item.id)
        customAudioQueue.push({ id: item.id, kind: 'url', title, url: cleanUrl })
      } else {
        seenTrackIds.add(item.id)
        customAudioQueue.push({ id: item.id, kind: 'file', title })
      }
    }
  } else if (customAudioQueue.length === 0) {
    // Transparent migration for pre-queue settings (legacy single URL or uploaded file).
    const legacyUrl = sanitizeHttpsUrl(safeAudioUrl)
    if (legacyUrl) {
      customAudioQueue.push({
        id: 'legacy_url',
        kind: 'url',
        title: sanitizeText(safeCustomAudioName, LIMITS.trackTitle) || 'Linked audio',
        url: legacyUrl,
      })
    } else if (safeCustomAudioName) {
      const stripped = safeCustomAudioName.replace(/\.[^.\s]{1,8}$/, '').trim()
      customAudioQueue.push({
        id: 'legacy',
        kind: 'file',
        title: sanitizeText(stripped || safeCustomAudioName, LIMITS.trackTitle),
      })
    }
  }

  const maxQueueIndex = Math.max(0, customAudioQueue.length - 1)
  const customAudioIndex =
    customAudioQueue.length > 0 ? clampInt(s.customAudioIndex, 0, maxQueueIndex, 0) : 0

  return {
    theme,
    soundEnabled: asBool(s.soundEnabled, d.soundEnabled),
    chimeVolume: clampNum(s.chimeVolume, 0, 1, d.chimeVolume),
    notificationsEnabled: asBool(s.notificationsEnabled, d.notificationsEnabled),

    ambient,
    ambientVolume: clampNum(s.ambientVolume, 0, 1, d.ambientVolume),
    musicSource,
    customAudioUrl: safeAudioUrl,
    customAudioName: safeCustomAudioName,
    customAudioQueue,
    customAudioIndex,
    spotifyUrl: safeSpotifyUrl,
    spotifyMiniCollapsed: asBool(s.spotifyMiniCollapsed, d.spotifyMiniCollapsed),
    spotifyPlayHintDismissed: asBool(s.spotifyPlayHintDismissed, d.spotifyPlayHintDismissed),

    autoStartBreaks: asBool(s.autoStartBreaks, d.autoStartBreaks),
    autoStartFocus: asBool(s.autoStartFocus, d.autoStartFocus),

    pomodoroMin: clampInt(s.pomodoroMin, 1, 180, d.pomodoroMin),
    shortBreakMin: clampInt(s.shortBreakMin, 1, 60, d.shortBreakMin),
    longBreakMin: clampInt(s.longBreakMin, 1, 90, d.longBreakMin),
    longBreakInterval: clampInt(s.longBreakInterval, 1, 12, d.longBreakInterval),
    customMin: clampInt(s.customMin, 1, 600, d.customMin),

    dailyGoalMin: clampInt(s.dailyGoalMin, 0, 720, d.dailyGoalMin),
    weeklyGoalMin: clampInt(s.weeklyGoalMin, 0, 5040, d.weeklyGoalMin),
    dailySessionGoal: clampInt(s.dailySessionGoal, 1, 50, d.dailySessionGoal),

    minQualifyingSec: clampInt(s.minQualifyingSec, 1, 3600, d.minQualifyingSec),

    defaultSubject: sanitizeText(s.defaultSubject, LIMITS.subject) || d.defaultSubject,
    subjects: subjects.length > 0 ? subjects : d.subjects,
  }
}

export function sanitizeAchievements(raw: unknown): AchievementState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: AchievementState = {}
  const entries = Object.entries(raw as Record<string, unknown>)
  for (const [key, val] of entries.slice(0, 200)) {
    if (!isSafeId(key)) continue
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      out[key] = val
    }
  }
  return out
}

export interface SanitizedTimerSnapshot {
  modeId: TimerModeId
  type: SessionType
  status: 'idle' | 'running' | 'paused' | 'completed'
  durationSec: number
  remainingSec: number
  endAt: number | null
  startedAt: number | null
  pomodorosCompleted: number
  subject: string
  label: string
  updatedAt: number
}

const VALID_STATUSES = new Set(['idle', 'running', 'paused', 'completed'])

export function sanitizeTimerSnapshot(raw: unknown): SanitizedTimerSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (!VALID_TIMER_MODES.has(s.modeId as TimerModeId)) return null
  if (!VALID_STATUSES.has(s.status as string)) return null

  const durationSec = clampInt(s.durationSec, 1, 36_000, 0)
  if (durationSec <= 0) return null

  const type: SessionType = VALID_SESSION_TYPES.has(s.type as SessionType)
    ? (s.type as SessionType)
    : s.modeId === 'short'
      ? 'short-break'
      : s.modeId === 'long'
        ? 'long-break'
        : 'focus'

  return {
    modeId: s.modeId as TimerModeId,
    type,
    status: s.status as SanitizedTimerSnapshot['status'],
    durationSec,
    remainingSec: clampInt(s.remainingSec, 0, durationSec, durationSec),
    endAt: typeof s.endAt === 'number' && Number.isFinite(s.endAt) ? s.endAt : null,
    startedAt: typeof s.startedAt === 'number' && Number.isFinite(s.startedAt) ? s.startedAt : null,
    pomodorosCompleted: clampInt(s.pomodorosCompleted, 0, 10_000, 0),
    subject: sanitizeText(s.subject, LIMITS.subject) || 'General',
    label: sanitizeText(s.label, LIMITS.label),
    updatedAt: clampInt(s.updatedAt, 0, 8_640_000_000_000_000, Date.now()),
  }
}
