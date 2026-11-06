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
import { hashPassword, makeSalt, verifyPassword } from '../src/lib/crypto'
import { sessionsToCSV } from '../src/lib/export'
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
}

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
