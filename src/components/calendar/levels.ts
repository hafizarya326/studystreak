/** Shared intensity scale for study-activity calendars. */
export interface LevelStyle {
  level: 0 | 1 | 2 | 3 | 4
  className: string
  label: string
}

export const LEVELS: LevelStyle[] = [
  { level: 0, className: 'bg-subtle/70', label: 'No study' },
  { level: 1, className: 'bg-sage/25', label: 'Under 30 min' },
  { level: 2, className: 'bg-sage/45', label: '30 min – 1 h' },
  { level: 3, className: 'bg-sage/70', label: '1 – 2 h' },
  { level: 4, className: 'bg-sage', label: '2 h or more' },
]

export function levelForSeconds(sec: number): 0 | 1 | 2 | 3 | 4 {
  if (!sec || sec <= 0) return 0
  if (sec < 1800) return 1
  if (sec < 3600) return 2
  if (sec < 7200) return 3
  return 4
}

export function levelClass(sec: number): string {
  return LEVELS[levelForSeconds(sec)].className
}
