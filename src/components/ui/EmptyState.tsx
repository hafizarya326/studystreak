import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-subtle/40 px-6 py-12 text-center">
      {icon ? (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-sage-700 shadow-soft">
          {icon}
        </span>
      ) : null}
      <div>
        <p className="font-display text-sm font-semibold text-ink">{title}</p>
        {description ? <p className="mx-auto mt-1 max-w-xs text-xs text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
