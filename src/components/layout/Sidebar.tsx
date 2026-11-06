import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { Flame } from '../streak/Flame'
import { NAV_ITEMS } from './navItems'
import { useData } from '../../context/DataContext'

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { streak } = useData()

  return (
    <aside className="flex h-full w-64 flex-col border-r border-line bg-card">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral/12">
          <Flame size={22} />
        </span>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-extrabold tracking-tight text-ink">StudyStreak</p>
          <p className="text-[11px] text-muted">Focus · Consistency · Growth</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-sage/12 text-sage-700'
                  : 'text-muted hover:bg-subtle hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={clsx('h-[18px] w-[18px] transition', isActive ? 'text-sage-700' : 'text-muted group-hover:text-ink')}
                />
                <span>{item.label}</span>
                {isActive ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sage" /> : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="m-3 rounded-2xl border border-coral/20 bg-coral/[0.06] p-3.5">
        <div className="flex items-center gap-3">
          <Flame size={26} />
          <div>
            <p className="font-display text-lg font-bold leading-none text-coral-600">
              {streak.current}
            </p>
            <p className="text-[11px] text-muted">day streak</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[11px] text-muted">best</p>
            <p className="text-sm font-semibold text-ink">{streak.longest}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
