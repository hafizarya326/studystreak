import {
  CalendarDays,
  History,
  LayoutDashboard,
  Settings,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  short: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { to: '/timer', label: 'Study Timer', short: 'Timer', icon: Timer },
  { to: '/calendar', label: 'Streak Calendar', short: 'Streak', icon: CalendarDays },
  { to: '/history', label: 'Study History', short: 'History', icon: History },
  { to: '/achievements', label: 'Achievements', short: 'Awards', icon: Trophy },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings },
]

/** Items shown in the mobile bottom bar (Settings lives in the drawer). */
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.to !== '/settings')
