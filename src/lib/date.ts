/**
 * Local-timezone date helpers.
 *
 * Rule: never use `Date.prototype.toISOString()` to derive a calendar day —
 * it converts to UTC and silently breaks streak math near midnight or in
 * non-UTC timezones. Everything here works on the user's local clock.
 */

export const MS_DAY = 86_400_000

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar key: YYYY-MM-DD */
export function toDayKey(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Parse a YYYY-MM-DD key into a local Date at 00:00. */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0)
}

export function startOfDay(date: Date | number): Date {
  const d = typeof date === 'number' ? new Date(date) : new Date(date.getTime())
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date | number, amount: number): Date {
  const d = typeof date === 'number' ? new Date(date) : new Date(date.getTime())
  d.setDate(d.getDate() + amount)
  return d
}

export function addMonths(date: Date | number, amount: number): Date {
  const d = typeof date === 'number' ? new Date(date) : new Date(date.getTime())
  d.setDate(1)
  d.setMonth(d.getMonth() + amount)
  return d
}

export function startOfWeek(date: Date | number): Date {
  const d = startOfDay(date)
  const day = d.getDay() // 0 = Sunday
  const diff = (day + 6) % 7 // Monday = 0
  return addDays(d, -diff)
}

export function endOfWeek(date: Date | number): Date {
  return addDays(startOfWeek(date), 6)
}

export function todayKey(): string {
  return toDayKey(new Date())
}

export function isSameDay(a: Date | number, b: Date | number): boolean {
  return toDayKey(a) === toDayKey(b)
}

/** Whole-day difference between two local dates (b - a). */
export function dayDiff(a: Date | number, b: Date | number): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime()
  // Round to absorb DST hour shifts.
  return Math.round(ms / MS_DAY)
}

export function eachDayKey(from: Date | number, to: Date | number): string[] {
  const keys: string[] = []
  let cur = startOfDay(from)
  const end = startOfDay(to).getTime()
  // Guard against absurd ranges.
  let guard = 0
  while (cur.getTime() <= end && guard < 4000) {
    keys.push(toDayKey(cur))
    cur = addDays(cur, 1)
    guard++
  }
  return keys
}

/** Row-major 6x7 grid of the month, Monday-first, `null` for padding cells. */
export function monthMatrix(year: number, month: number): Array<Date | null> {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<Date | null> = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  while (cells.length < 42) cells.push(null)
  return cells
}

/* ----------------------------- formatting ----------------------------- */

export function formatClock(totalSeconds: number, opts?: { showHours?: boolean }): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0 || opts?.showHours) {
    return `${h}:${pad(m)}:${pad(sec)}`
  }
  return `${pad(m)}:${pad(sec)}`
}

/** 3725 -> "1h 2m" | 300 -> "5m" | 45 -> "45s" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  if (s < 60) return `${s}s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatHours(totalSeconds: number, digits = 1): string {
  return `${(totalSeconds / 3600).toFixed(digits)}h`
}

export function formatTimeOfDay(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDateLabel(ts: number, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(ts).toLocaleDateString(
    undefined,
    opts ?? { month: 'short', day: 'numeric', year: 'numeric' },
  )
}

export function formatDayKeyLabel(key: string, opts?: Intl.DateTimeFormatOptions): string {
  return fromDayKey(key).toLocaleDateString(
    undefined,
    opts ?? { weekday: 'short', month: 'short', day: 'numeric' },
  )
}

export function relativeDayLabel(key: string): string {
  const diff = dayDiff(fromDayKey(key), new Date())
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff === -1) return 'Tomorrow'
  return formatDayKeyLabel(key, { month: 'short', day: 'numeric' })
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
