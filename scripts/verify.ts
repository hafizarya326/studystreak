/**
 * Core-logic verification for StudyStreak.
 * Run:  npx esbuild scripts/verify.ts --bundle --platform=node --format=esm --outfile=scripts/.verify.mjs && node scripts/.verify.mjs
 *
 * Focuses on the tricky, high-risk logic: local-timezone day keys, streak math,
 * freeze earning/consumption, duplicate-day prevention and statistics.
 */
import { computeStreak as streakFn } from '../src/lib/streak'
import { fromDayKey, toDayKey, addDays, startOfWeek } from '../src/lib/date'
import { computeStats, qualifyingDayKeys, isQualifyingSession } from '../src/lib/stats'
import {
  buildAchievementContext,
  detectPerfectWeek,
  evaluateAchievements,
} from '../src/lib/achievements'
import { parseSpotifyLink, spotifyEmbedUrl } from '../src/lib/music'
import { hashPassword, makeSalt, needsRehash, verifyPassword } from '../src/lib/crypto'
import { sessionsToCSV } from '../src/lib/export'
import {
  detectAudioMagicBytes,
  isSafeId,
  loginRateLimiter,
  safeJsonParse,
  sanitizeFilename,
  sanitizeHttpsUrl,
  sanitizeSession,
  sanitizeSettings,
  sanitizeText,
  validatePasswordStrength,
} from '../src/lib/security'
import type { StudySession } from '../src/types'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  \u2713 ${name}`)
  } else {
    failed++
    console.log(`  \u2717 ${name}`, detail !== undefined ? JSON.stringify(detail) : '')
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected })
}

/* ----------------------------- helpers ----------------------------- */

const TODAY = '2026-03-15'

function day(offset: number): string {
  return toDayKey(addDays(fromDayKey(TODAY), offset))
}

function session(dayKey: string, durationSec = 1500, subject = 'Math'): StudySession {
  const start = new Date(dayKey + 'T09:00:00').getTime()
  return {
    id: `s_${dayKey}_${Math.random().toString(36).slice(2, 6)}`,
    userId: 'u_test',
    startedAt: start,
    endedAt: start + durationSec * 1000,
    durationSec,
    type: 'focus',
    subject,
    completed: true,
    modeId: 'pomodoro',
  }
}

function sessionsForDays(offsets: number[], durationSec = 1500): StudySession[] {
  return offsets.map((o) => session(day(o), durationSec))
}

function streakFor(offsets: number[], today = TODAY) {
  const days = new Set(offsets.map((o) => day(o)))
  return streakFn(days, today)
}

/* ----------------------------- tests ----------------------------- */

console.log('\nDate / timezone handling')
{
  const lateNight = new Date(2026, 0, 15, 23, 30, 0)
  eq('23:30 local stays on the local calendar day', toDayKey(lateNight), '2026-01-15')
  const earlyMorning = new Date(2026, 0, 16, 0, 5, 0)
  eq('00:05 local stays on the local calendar day', toDayKey(earlyMorning), '2026-01-16')
  eq('fromDayKey round-trips', toDayKey(fromDayKey('2026-02-28')), '2026-02-28')
  eq('addDays crosses month boundary', toDayKey(addDays(fromDayKey('2026-01-31'), 1)), '2026-02-01')
  eq('startOfWeek is Monday', startOfWeek(fromDayKey('2026-03-15')).getDay(), 1)
}

console.log('\nStreak basics')
{
  eq('no sessions -> 0', streakFor([]).current, 0)
  eq('study today only -> 1', streakFor([0]).current, 1)
  eq('3 consecutive ending today -> 3', streakFor([-2, -1, 0]).current, 3)
  eq('streak alive but today pending', streakFor([-3, -2, -1]).current, 3)
  check('atRisk when today not studied', streakFor([-1]).atRisk === true)
  check('not atRisk once today studied', streakFor([0]).atRisk === false)
  eq('missed a full day resets', streakFor([-4, -3, -2]).current, 0)
  eq('longest retained after reset', streakFor([-8, -7, -6, -5, -4, -1, 0]).longest, 5)
  eq('current after reset then rebuild', streakFor([-8, -7, -6, -5, -4, -1, 0]).current, 2)
}

console.log('\nDuplicate-day prevention')
{
  const three = [session(day(0), 1500), session(day(0), 900), session(day(0), 600)]
  eq('3 sessions same day -> 1 qualifying day', qualifyingDayKeys(three, 60).size, 1)
  eq('3 sessions same day -> streak 1', streakFn(qualifyingDayKeys(three, 60), TODAY).current, 1)
}

console.log('\nQualifying threshold')
{
  const shortSession = session(day(0), 30) // 30 seconds
  check('sub-threshold session does not qualify', !isQualifyingSession(shortSession, 60))
  check('threshold session qualifies', isQualifyingSession(session(day(0), 60), 60))
  eq('sub-threshold day does not count', qualifyingDayKeys([shortSession], 60).size, 0)
}

console.log('\nStreak Freeze')
{
  const s7 = streakFor([-7, -6, -5, -4, -3, -2, -1])
  eq('7-day streak earns a freeze', s7.freezesAvailable, 1)
  eq('7-day streak current', s7.current, 7)

  // Missing day is bridged by the freeze.
  const bridged = streakFor([-8, -7, -6, -5, -4, -3, -2, 0].filter((o) => o !== -1) as number[])
  eq('missing day bridged -> freeze used', bridged.freezesAvailable, 0)
  // -8..-2 (7 days) + freeze bridges -1 + study on 0 => 8
  eq('bridged streak continues', bridged.current, 8)
  check('bridged streak recorded the missed day', bridged.freezeDays.includes(day(-1)))

  // With one freeze, only one missed day is bridged.
  const twoMisses = streakFn(
    new Set([day(-9), day(-8), day(-7), day(-6), day(-5), day(-4), day(0)]),
    TODAY,
  )
  check('single freeze cannot bridge two missed days', twoMisses.current <= 1)

  // No duplicate freeze usage on the same day.
  const freezeDays = bridged.freezeDays
  eq('freeze used exactly once', new Set(freezeDays).size, freezeDays.length)
}

console.log('\nPerfect week')
{
  const week = new Set([0, 1, 2, 3, 4, 5, 6].map((i) => toDayKey(addDays(startOfWeek(fromDayKey(TODAY)), i))))
  check('full calendar week detected', detectPerfectWeek(week))
  const broken = new Set([0, 1, 2, 3, 4, 5].map((i) => toDayKey(addDays(startOfWeek(fromDayKey(TODAY)), i))))
  check('six days is not a perfect week', !detectPerfectWeek(broken))
}

console.log('\nStatistics')
{
  const sessions = sessionsForDays([-6, -5, -4, -3, -2, -1, 0], 3600)
  const stats = computeStats(sessions)
  eq('total sessions', stats.totalSessions, 7)
  eq('total hours', Number(stats.totalHours.toFixed(2)), 7)
  eq('weekly series length', stats.weeklySeries.length, 7)
  eq('monthly series length', stats.monthlySeries.length, 6)
  eq('day series length', stats.daySeries.length, 30)
  eq('active days', stats.activeDays, 7)
  check('consistency within 0-100', stats.consistency >= 0 && stats.consistency <= 100)
  eq('subject aggregation', stats.subjects[0]?.name, 'Math')

  // Weekly/monthly series are anchored to the real current date, so verify with a
  // session created "now".
  const nowSession: StudySession = {
    id: 'now',
    userId: 'u',
    startedAt: Date.now() - 600_000,
    endedAt: Date.now(),
    durationSec: 600_000 / 1000,
    type: 'focus',
    subject: 'Now',
    completed: true,
    modeId: 'pomodoro',
  }
  const nowStats = computeStats([nowSession])
  eq('session today counts toward this week', nowStats.weekSec, 600)
  eq('session today counts toward today', nowStats.todaySec, 600)

  const empty = computeStats([])
  eq('empty stats sessions', empty.totalSessions, 0)
  eq('empty stats hours', empty.totalHours, 0)
  eq('empty consistency', empty.consistency, 0)
}

console.log('\nAchievements')
{
  const fiveInADay = Array.from({ length: 5 }, () => session(day(0), 1200))
  const stats = computeStats(fiveInADay)
  const streak = streakFn(qualifyingDayKeys(fiveInADay, 60), TODAY)
  const ctx = buildAchievementContext(fiveInADay, streak, stats, 60)
  const evaluated = evaluateAchievements(ctx, {})

  const firstStep = evaluated.find((a) => a.id === 'first-step')
  check('First Step unlocked', firstStep?.unlocked === true)
  const marathon = evaluated.find((a) => a.id === 'marathon-student')
  check('Marathon Student unlocked (5 in a day)', marathon?.unlocked === true)

  const longStreak = streakFn(
    new Set(Array.from({ length: 30 }, (_, i) => day(-(29 - i)))),
    TODAY,
  )
  const bigStats = computeStats(
    Array.from({ length: 30 }, (_, i) => session(day(-(29 - i)), 4 * 3600)),
  )
  const bigCtx = buildAchievementContext(
    Array.from({ length: 30 }, (_, i) => session(day(-(29 - i)), 4 * 3600)),
    longStreak,
    bigStats,
    60,
  )
  const bigEval = evaluateAchievements(bigCtx, {})
  check('Study Master (30d) unlocked', bigEval.find((a) => a.id === 'study-master')?.unlocked === true)
  check('Focus Champion (100h) unlocked', bigEval.find((a) => a.id === 'focus-champion')?.unlocked === true)
  check('Perfect Week unlocked', bigEval.find((a) => a.id === 'perfect-week')?.unlocked === true)
}

console.log('\nTimer-adjacent day boundary simulation')
{
  // A session that starts before midnight and ends after it counts for the start day.
  const start = new Date(2026, 5, 10, 23, 50, 0).getTime()
  const s: StudySession = {
    id: 'boundary',
    userId: 'u',
    startedAt: start,
    endedAt: start + 25 * 60 * 1000,
    durationSec: 1500,
    type: 'focus',
    subject: 'Late night',
    completed: true,
    modeId: 'pomodoro',
  }
  const stats = computeStats([s])
  check('late-night session attributed to start day', Boolean(stats.focusSecByDay['2026-06-10']))
}

/* ----------------------------- summary ----------------------------- */

console.log('\nSpotify link parsing')
{
  eq('parses a playlist URL', parseSpotifyLink('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'), {
    type: 'playlist',
    id: '37i9dQZF1DXcBWIGoYBM5M',
  })
  eq('parses a track URL with query string', parseSpotifyLink('https://open.spotify.com/track/abc123?si=x'), {
    type: 'track',
    id: 'abc123',
  })
  eq('parses an embed URL', parseSpotifyLink('https://open.spotify.com/embed/album/xyz789'), {
    type: 'album',
    id: 'xyz789',
  })
  eq('parses a spotify: URI', parseSpotifyLink('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'), {
    type: 'playlist',
    id: '37i9dQZF1DXcBWIGoYBM5M',
  })
  check('rejects a plain URL', parseSpotifyLink('https://example.com/song.mp3') === null)
  check('rejects empty input', parseSpotifyLink('   ') === null)
  check(
    'builds an embed URL',
    spotifyEmbedUrl({ type: 'playlist', id: 'abc' }).startsWith('https://open.spotify.com/embed/playlist/abc'),
  )
}

console.log('\nPassword hashing')
{
  const salt = makeSalt()
  const hash = await hashPassword('correct horse battery', salt)
  check('new hashes use PBKDF2', hash.startsWith('pbkdf2:'))
  check('correct password verifies', await verifyPassword('correct horse battery', salt, hash))
  check('wrong password is rejected', !(await verifyPassword('wrong password', salt, hash)))
  check('salt changes the hash', (await hashPassword('same', 'a')) !== (await hashPassword('same', 'b')))

  const enc = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`studystreak::${salt}::legacy`))
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  check('legacy sha256 hash still verifies', await verifyPassword('legacy', salt, `sha256:${hex}`))
}

console.log('\nCSV export safety')
{
  const s: StudySession = {
    id: 'csv',
    userId: 'u',
    startedAt: Date.now(),
    endedAt: Date.now() + 60_000,
    durationSec: 60,
    type: 'focus',
    subject: '=HYPERLINK("http://evil")',
    note: '@SUM(1)',
    completed: true,
    modeId: 'pomodoro',
  }
  const csv = sessionsToCSV([s])
  check('formula-injection subject is neutralised', csv.includes(`"'=HYPERLINK`))
  check('formula-injection note is neutralised', csv.includes(`'@SUM(1)`))
  const csvSpaces = sessionsToCSV([{ ...s, subject: '  =CMD()', note: '|calc' }])
  check('leading-space formula injection neutralised', csvSpaces.includes(`'  =CMD()`))
  check('pipe DDE injection neutralised', csvSpaces.includes(`'|calc`))
}

console.log('\nSecurity hardening')
{
  // Prototype pollution guard
  const polluted = safeJsonParse<Record<string, unknown>>(
    '{"ok":1,"__proto__":{"polluted":true},"constructor":{"bad":1},"prototype":{"bad":1}}',
    {},
  )
  check('prototype pollution keys stripped', !Object.prototype.hasOwnProperty.call(polluted, '__proto__'))
  check('constructor key stripped', !Object.prototype.hasOwnProperty.call(polluted, 'constructor'))
  check('Object.prototype remained clean', !('polluted' in ({} as Record<string, unknown>)))
  eq('valid fields preserved by safeJsonParse', polluted.ok, 1)

  // Safe ID & text sanitization
  check('valid user id accepted', isSafeId('u_abc123-XYZ'))
  check('storage key traversal rejected', !isSafeId('../admin:sessions'))
  check('BiDi override stripped from filename', !sanitizeFilename('song\u202Egpj.mp3').includes('\u202E'))
  check('path separators stripped from filename', !sanitizeFilename('../../etc/passwd').includes('/'))
  check('control chars stripped from text', !sanitizeText('hi\x00\x07there', 50).includes('\x00'))

  // Strict HTTPS URL / SSRF-in-browser protection
  check('public https URL accepted', sanitizeHttpsUrl('https://cdn.example.com/focus.mp3') !== null)
  check('javascript: scheme blocked', sanitizeHttpsUrl('javascript:alert(1)') === null)
  check('data: scheme blocked', sanitizeHttpsUrl('data:audio/mp3;base64,AAA') === null)
  check('http: cleartext blocked', sanitizeHttpsUrl('http://cdn.example.com/focus.mp3') === null)
  check('localhost blocked', sanitizeHttpsUrl('https://localhost:8080/a.mp3') === null)
  check('127.0.0.1 blocked', sanitizeHttpsUrl('https://127.0.0.1/a.mp3') === null)
  check('RFC1918 192.168.x.x blocked', sanitizeHttpsUrl('https://192.168.1.1/a.mp3') === null)
  check('RFC1918 10.x.x.x blocked', sanitizeHttpsUrl('https://10.0.0.5/a.mp3') === null)
  check('cloud metadata 169.254.169.254 blocked', sanitizeHttpsUrl('https://169.254.169.254/latest') === null)
  check('IPv6 loopback blocked', sanitizeHttpsUrl('https://[::1]/a.mp3') === null)
  check('embedded credentials blocked', sanitizeHttpsUrl('https://user:pass@cdn.example.com/a.mp3') === null)

  // Spotify URL spoofing blocked
  check(
    'spoofed host containing open.spotify.com rejected',
    parseSpotifyLink('https://evil.com/open.spotify.com/track/abc123') === null,
  )
  check(
    'http spotify link rejected',
    parseSpotifyLink('http://open.spotify.com/track/abc123') === null,
  )

  // Audio magic bytes inspection
  check('ID3 MP3 header accepted', detectAudioMagicBytes(new Uint8Array([0x49, 0x44, 0x33, 0x03])) === 'audio/mpeg')
  check('OGG header accepted', detectAudioMagicBytes(new Uint8Array([0x4f, 0x67, 0x67, 0x53])) === 'audio/ogg')
  check(
    'WAV header accepted',
    detectAudioMagicBytes(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])) === 'audio/wav',
  )
  check(
    'HTML disguised as audio rejected',
    detectAudioMagicBytes(new TextEncoder().encode('<!doctype html><script>alert(1)</script>')) === null,
  )

  // Password policy & PBKDF2 DoS cap
  check('short password rejected', validatePasswordStrength('abc123') !== null)
  check('common password rejected', validatePasswordStrength('password123') !== null)
  check('oversized password rejected (PBKDF2 DoS guard)', validatePasswordStrength('a1'.repeat(100)) !== null)
  check('strong 8+ char password accepted', validatePasswordStrength('Study99!') === null)
  check('12+ char passphrase accepted', validatePasswordStrength('correct horse battery') === null)
  check('legacy sha256 flagged for rehash', needsRehash('sha256:abcd'))
  check('current PBKDF2 hash does not need rehash', !needsRehash(await hashPassword('Study99!', makeSalt())))

  // Login brute-force rate limiter
  const testEmail = 'attacker@example.com'
  loginRateLimiter.reset(testEmail)
  const t0 = 1_700_000_000_000
  for (let i = 0; i < 4; i++) loginRateLimiter.recordFailure(testEmail, t0)
  check('allowed before lockout threshold', loginRateLimiter.check(testEmail, t0).allowed === true)
  loginRateLimiter.recordFailure(testEmail, t0)
  const locked = loginRateLimiter.check(testEmail, t0)
  check('locked out after 5 consecutive failures', locked.allowed === false)
  check('unlocked after cooldown expires', loginRateLimiter.check(testEmail, t0 + 60_000).allowed === true)
  loginRateLimiter.reset(testEmail)

  // Storage tampering sanitization
  const tamperedSettings = sanitizeSettings({
    theme: 'evil',
    pomodoroMin: -999,
    ambientVolume: 99,
    customAudioUrl: 'javascript:alert(1)',
    subjects: 'not-an-array',
  })
  eq('tampered theme reset to default', tamperedSettings.theme, 'light')
  eq('tampered pomodoroMin clamped', tamperedSettings.pomodoroMin, 1)
  eq('tampered volume clamped', tamperedSettings.ambientVolume, 1)
  eq('javascript customAudioUrl cleared', tamperedSettings.customAudioUrl, '')
  check('tampered subjects restored to array', Array.isArray(tamperedSettings.subjects))

  check(
    'tampered session with invalid id rejected',
    sanitizeSession({ id: '../bad', startedAt: 1, endedAt: 2, durationSec: 60 }) === null,
  )
}

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
