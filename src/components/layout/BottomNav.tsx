import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { MOBILE_NAV_ITEMS } from './navItems'
import { useTimer } from '../../context/TimerContext'
import { formatClock } from '../../lib/date'

export function BottomNav() {
  const { status, remainingSec } = useTimer()
  const running = status === 'running'

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile navigation"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {MOBILE_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              clsx(
                'relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition',
                isActive ? 'text-sage-700' : 'text-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <item.icon className={clsx('h-[20px] w-[20px]', isActive && 'text-sage-700')} />
                  {item.to === '/timer' && running ? (
                    <span className="absolute -right-2 -top-1 rounded-full bg-sage px-1 text-[8px] font-bold leading-tight text-white tabular-nums">
                      {formatClock(remainingSec).replace(/:\d\d$/, '')}
                    </span>
                  ) : null}
                </span>
                <span>{item.short}</span>
                {isActive ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-sage" /> : null}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
