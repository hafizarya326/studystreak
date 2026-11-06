import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, Flame, Info, Trophy, X } from 'lucide-react'
import { clsx } from 'clsx'

export type ToastVariant = 'default' | 'success' | 'streak' | 'achievement' | 'error'

export interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastItem extends ToastInput {
  id: string
  variant: ToastVariant
}

interface ToastContextValue {
  push: (toast: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VARIANT_STYLES: Record<ToastVariant, { icon: ReactNode; ring: string; iconBg: string }> = {
  default: {
    icon: <Info className="h-5 w-5" />,
    ring: 'border-line',
    iconBg: 'bg-subtle text-muted',
  },
  success: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    ring: 'border-sage/40',
    iconBg: 'bg-sage/15 text-sage-700',
  },
  streak: {
    icon: <Flame className="h-5 w-5" />,
    ring: 'border-coral/40',
    iconBg: 'bg-coral/15 text-coral-600',
  },
  achievement: {
    icon: <Trophy className="h-5 w-5" />,
    ring: 'border-coral/40',
    iconBg: 'bg-coral/15 text-coral-600',
  },
  error: {
    icon: <X className="h-5 w-5" />,
    ring: 'border-red-400/50',
    iconBg: 'bg-red-500/10 text-red-500',
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (input: ToastInput) => {
      const id = `t${++counter.current}`
      const item: ToastItem = { ...input, id, variant: input.variant ?? 'default' }
      setToasts((prev) => [...prev.slice(-3), item])
      const duration = input.duration ?? (item.variant === 'achievement' ? 6000 : 4200)
      window.setTimeout(() => remove(id), duration)
    },
    [remove],
  )

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const styles = VARIANT_STYLES[t.variant]
          return (
            <div
              key={t.id}
              className={clsx(
                'pointer-events-auto flex w-full max-w-sm animate-slide-in items-start gap-3 rounded-2xl border bg-card p-3.5 shadow-lift',
                styles.ring,
              )}
            >
              <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', styles.iconBg)}>
                {styles.icon}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="shrink-0 rounded-lg p-1 text-muted transition hover:bg-subtle hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
