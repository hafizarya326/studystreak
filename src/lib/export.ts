import type { StudySession } from '../types'
import { formatDuration, formatTimeOfDay, toDayKey } from './date'

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function csvCell(value: string | number | boolean): string {
  const s = String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function sessionsToCSV(sessions: StudySession[]): string {
  const header = [
    'Date',
    'Start',
    'End',
    'Duration',
    'Duration (seconds)',
    'Subject',
    'Type',
    'Status',
    'Note',
  ]
  const rows = sessions.map((s) => [
    toDayKey(s.startedAt),
    formatTimeOfDay(s.startedAt),
    formatTimeOfDay(s.endedAt),
    formatDuration(s.durationSec),
    s.durationSec,
    s.subject,
    s.type,
    s.completed ? 'completed' : 'incomplete',
    s.note ?? '',
  ])
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}

export function exportSessionsCSV(sessions: StudySession[]): void {
  const stamp = toDayKey(new Date())
  download(`studystreak-history-${stamp}.csv`, sessionsToCSV(sessions), 'text/csv;charset=utf-8')
}

export function exportBackupJSON(payload: {
  profile?: unknown
  sessions: StudySession[]
  achievements: unknown
  settings: unknown
}): void {
  const stamp = toDayKey(new Date())
  download(
    `studystreak-backup-${stamp}.json`,
    JSON.stringify({ app: 'StudyStreak', version: 1, exportedAt: new Date().toISOString(), ...payload }, null, 2),
    'application/json;charset=utf-8',
  )
}
