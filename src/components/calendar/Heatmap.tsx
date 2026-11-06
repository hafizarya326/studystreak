import { useMemo } from 'react'
import { clsx } from 'clsx'
import { useData } from '../../context/DataContext'
import { levelClass } from './levels'
import { addDays, formatDuration, startOfWeek, toDayKey, todayKey } from '../../lib/date'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** GitHub-style contribution heatmap of the last `weeks` weeks. */
export function Heatmap({ weeks = 20, className }: { weeks?: number; className?: string }) {
  const { stats } = useData()
  const today = todayKey()

  const columns = useMemo(() => {
    const end = startOfWeek(new Date())
    const start = addDays(end, -(weeks - 1) * 7)
    const cols: Array<Array<{ key: string; sec: number; inFuture: boolean }>> = []
    for (let w = 0; w < weeks; w++) {
      const col: Array<{ key: string; sec: number; inFuture: boolean }> = []
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d)
        const key = toDayKey(date)
        col.push({ key, sec: stats.focusSecByDay[key] ?? 0, inFuture: key > today })
      }
      cols.push(col)
    }
    return cols
  }, [weeks, stats.focusSecByDay, today])

  const monthLabels = useMemo(
    () =>
      columns.map((col, i) => {
        const first = col[0]
        const date = new Date(first.key + 'T00:00:00')
        const prev = i > 0 ? new Date(columns[i - 1][0].key + 'T00:00:00') : null
        const show = i === 0 || (prev && prev.getMonth() !== date.getMonth())
        return show ? date.toLocaleDateString(undefined, { month: 'short' }) : ''
      }),
    [columns],
  )

  return (
    <div className={clsx('overflow-x-auto pb-1', className)}>
      <div className="inline-flex min-w-full gap-2">
        <div className="flex flex-col gap-[3px] pt-[18px]">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={clsx(
                'h-[13px] text-[10px] leading-[13px] text-muted',
                i % 2 === 0 ? 'opacity-100' : 'opacity-0',
              )}
            >
              {d.slice(0, 1)}
            </div>
          ))}
        </div>
        <div className="flex-1">
          <div className="mb-1 flex gap-[3px]">
            {monthLabels.map((label, i) => (
              <div key={i} className="w-[13px] whitespace-nowrap text-[10px] text-muted">
                {label}
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {col.map((cell) => (
                  <div
                    key={cell.key}
                    title={`${cell.key} · ${cell.sec > 0 ? formatDuration(cell.sec) : 'No study'}`}
                    className={clsx(
                      'h-[13px] w-[13px] rounded-[3px]',
                      cell.inFuture ? 'bg-transparent' : levelClass(cell.sec),
                      !cell.inFuture && cell.sec === 0 && 'bg-subtle',
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
