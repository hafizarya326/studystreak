import { useEffect, useState } from 'react'
import { toDayKey } from '../lib/date'

/** Returns the local calendar day key, refreshing automatically at midnight
 *  and whenever the tab regains focus (so an idle tab never shows stale data). */
export function useCurrentDay(): string {
  const [today, setToday] = useState(() => toDayKey(new Date()))

  useEffect(() => {
    let timeout: number

    const schedule = () => {
      const now = new Date()
      const nextMidnight = new Date(now)
      nextMidnight.setHours(24, 0, 0, 5)
      const ms = Math.max(1000, nextMidnight.getTime() - now.getTime())
      timeout = window.setTimeout(() => {
        setToday(toDayKey(new Date()))
        schedule()
      }, ms)
    }
    schedule()

    const check = () => setToday(toDayKey(new Date()))
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    const interval = window.setInterval(check, 60_000)

    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  return today
}
