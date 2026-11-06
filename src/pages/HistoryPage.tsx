import { useMemo, useState } from 'react'
import {
  CalendarDays,
  Download,
  Filter,
  List,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Field, Select, TextInput } from '../components/ui/Field'
import { Segmented } from '../components/ui/Segmented'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { exportSessionsCSV } from '../lib/export'
import {
  addDays,
  formatDateLabel,
  formatDuration,
  formatTimeOfDay,
  toDayKey,
  todayKey,
} from '../lib/date'
import type { StudySession } from '../types'

type RangePreset = 'all' | 'today' | '7' | '30' | 'custom'

export function HistoryPage() {
  const { sessions, deleteSession, updateSession } = useData()
  const { push } = useToast()

  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [preset, setPreset] = useState<RangePreset>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [view, setView] = useState<'list' | 'day'>('day')
  const [noteSession, setNoteSession] = useState<StudySession | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [confirmClear, setConfirmClear] = useState<StudySession | null>(null)

  const subjects = useMemo(() => {
    const set = new Set<string>()
    for (const s of sessions) if (s.type === 'focus') set.add(s.subject)
    return Array.from(set).sort()
  }, [sessions])

  const range = useMemo(() => {
    const today = todayKey()
    if (preset === 'today') return { from: today, to: today }
    if (preset === '7') return { from: toDayKey(addDays(new Date(), -6)), to: today }
    if (preset === '30') return { from: toDayKey(addDays(new Date(), -29)), to: today }
    if (preset === 'custom') return { from: from || '0000-01-01', to: to || '9999-12-31' }
    return { from: '0000-01-01', to: '9999-12-31' }
  }, [preset, from, to])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sessions.filter((s) => {
      const day = toDayKey(s.startedAt)
      if (day < range.from || day > range.to) return false
      if (subject !== 'all' && s.subject !== subject) return false
      if (typeFilter !== 'all' && s.type !== typeFilter) return false
      if (q) {
        const hay = `${s.subject} ${s.label ?? ''} ${s.note ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [sessions, range, subject, typeFilter, search])

  const totals = useMemo(() => {
    const sec = filtered.reduce((acc, s) => acc + s.durationSec, 0)
    const days = new Set(filtered.map((s) => toDayKey(s.startedAt)))
    return {
      sec,
      count: filtered.length,
      days: days.size,
      avg: filtered.length ? Math.round(sec / filtered.length) : 0,
    }
  }, [filtered])

  const grouped = useMemo(() => {
    const map = new Map<string, StudySession[]>()
    for (const s of filtered) {
      const key = toDayKey(s.startedAt)
      const arr = map.get(key) ?? []
      arr.push(s)
      map.set(key, arr)
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [filtered])

  const hasFilters = search !== '' || subject !== 'all' || typeFilter !== 'all' || preset !== 'all'

  const clearFilters = () => {
    setSearch('')
    setSubject('all')
    setTypeFilter('all')
    setPreset('all')
    setFrom('')
    setTo('')
  }

  const handleExport = () => {
    if (filtered.length === 0) {
      push({ title: 'Nothing to export', description: 'No sessions match your filters.', variant: 'error' })
      return
    }
    exportSessionsCSV(filtered)
    push({ title: 'Export started', description: `${filtered.length} sessions exported as CSV.`, variant: 'success' })
  }

  const openNote = (s: StudySession) => {
    setNoteSession(s)
    setNoteDraft(s.note ?? '')
  }

  const saveNote = async () => {
    if (!noteSession) return
    await updateSession(noteSession.id, { note: noteDraft.trim() || undefined })
    setNoteSession(null)
    push({ title: 'Note saved', variant: 'success' })
  }

  return (
    <div>
      <PageHeader
        title="Study History"
        description="Every completed session, with daily and weekly totals you can filter and export."
        action={
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Total time" value={formatDuration(totals.sec)} />
        <SummaryTile label="Sessions" value={`${totals.count}`} />
        <SummaryTile label="Study days" value={`${totals.days}`} />
        <SummaryTile label="Average session" value={formatDuration(totals.avg)} />
      </div>

      <Card className="card-pad mb-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1">
              <Field label="Search">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <TextInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by subject, label or note…"
                    className="pl-9"
                  />
                </div>
              </Field>
            </div>
            <Field label="Subject" className="lg:w-44">
              <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="all">All subjects</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type" className="lg:w-40">
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All types</option>
                <option value="focus">Focus</option>
                <option value="short-break">Short break</option>
                <option value="long-break">Long break</option>
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <Filter className="h-3.5 w-3.5" /> Range
            </span>
            <Segmented
              size="sm"
              value={preset}
              onChange={(v) => setPreset(v)}
              options={[
                { value: 'all', label: 'All time' },
                { value: 'today', label: 'Today' },
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
            {preset === 'custom' ? (
              <div className="flex items-center gap-2">
                <TextInput
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-auto py-1.5"
                  aria-label="From date"
                />
                <span className="text-xs text-muted">to</span>
                <TextInput
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-auto py-1.5"
                  aria-label="To date"
                />
              </div>
            ) : null}
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            ) : null}
            <div className="ml-auto">
              <Segmented
                size="sm"
                value={view}
                onChange={(v) => setView(v)}
                options={[
                  { value: 'day', label: 'By day', icon: <CalendarDays className="h-3.5 w-3.5" /> },
                  { value: 'list', label: 'List', icon: <List className="h-3.5 w-3.5" /> },
                ]}
              />
            </div>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" />}
          title="No sessions found"
          description={hasFilters ? 'Try widening your filters or clearing the search.' : 'Complete a focus session to build your history.'}
          action={hasFilters ? <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined}
        />
      ) : view === 'list' ? (
        <Card className="overflow-hidden">
          <SessionTable
            sessions={filtered}
            onNote={openNote}
            onDelete={(s) => setConfirmClear(s)}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, items]) => {
            const daySec = items.reduce((a, s) => a + s.durationSec, 0)
            return (
              <Card key={day} className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-line bg-subtle/40 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-card text-sage-700 shadow-soft">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {formatDateLabel(new Date(day + 'T00:00:00').getTime(), {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-[11px] text-muted">
                        {items.length} session{items.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <Badge tone="sage">{formatDuration(daySec)}</Badge>
                </div>
                <ul className="divide-y divide-line">
                  {items.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-xs tabular-nums text-muted">
                        {formatTimeOfDay(s.startedAt)}
                        <span className="mx-1">–</span>
                        {formatTimeOfDay(s.endedAt)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{s.subject}</p>
                        {s.label ? <p className="truncate text-xs text-muted">{s.label}</p> : null}
                      </div>
                      <Badge tone={s.type === 'focus' ? 'sage' : 'neutral'}>
                        {s.type === 'focus' ? 'Focus' : s.type === 'short-break' ? 'Short break' : 'Long break'}
                      </Badge>
                      <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
                        {formatDuration(s.durationSec)}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openNote(s)}
                          className={clsx(
                            'flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-subtle',
                            s.note ? 'text-sage-700' : 'text-muted',
                          )}
                          aria-label="Add or edit note"
                          title={s.note ? 'Edit note' : 'Add note'}
                        >
                          <StickyNote className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClear(s)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-red-500/10 hover:text-red-600"
                          aria-label="Delete session"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>
      )}

      {/* Note editor */}
      <Modal
        open={noteSession !== null}
        onClose={() => setNoteSession(null)}
        title="Session note"
        description={noteSession ? `${noteSession.subject} · ${formatDuration(noteSession.durationSec)}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoteSession(null)}>
              Cancel
            </Button>
            <Button onClick={saveNote} disabled={!noteSession}>
              Save note
            </Button>
          </>
        }
      >
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={5}
          placeholder="What did you cover? Any follow-ups?"
          className="input resize-none"
        />
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={confirmClear !== null}
        onClose={() => setConfirmClear(null)}
        title="Delete this session?"
        description="This will remove it from your history and statistics. Streak days are recalculated automatically."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (confirmClear) await deleteSession(confirmClear.id)
                setConfirmClear(null)
                push({ title: 'Session deleted', variant: 'default' })
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="card-pad">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold text-ink">{value}</p>
    </Card>
  )
}

function SessionTable({
  sessions,
  onNote,
  onDelete,
}: {
  sessions: StudySession[]
  onNote: (s: StudySession) => void
  onDelete: (s: StudySession) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-semibold">Date</th>
            <th className="px-4 py-3 font-semibold">Start – End</th>
            <th className="px-4 py-3 font-semibold">Subject</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 text-right font-semibold">Duration</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sessions.map((s) => (
            <tr key={s.id} className="transition hover:bg-subtle/50">
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {formatDateLabel(s.startedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted tabular-nums">
                {formatTimeOfDay(s.startedAt)} – {formatTimeOfDay(s.endedAt)}
              </td>
              <td className="px-4 py-3">
                <span className="font-medium text-ink">{s.subject}</span>
                {s.label ? <span className="block text-xs text-muted">{s.label}</span> : null}
              </td>
              <td className="px-4 py-3">
                <Badge tone={s.type === 'focus' ? 'sage' : 'neutral'}>
                  {s.type === 'focus' ? 'Focus' : s.type === 'short-break' ? 'Short break' : 'Long break'}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={s.completed ? 'success' : 'neutral'}>
                  {s.completed ? 'Completed' : 'Incomplete'}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                {formatDuration(s.durationSec)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onNote(s)}
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-subtle',
                      s.note ? 'text-sage-700' : 'text-muted',
                    )}
                    aria-label="Add or edit note"
                  >
                    <StickyNote className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-red-500/10 hover:text-red-600"
                    aria-label="Delete session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
