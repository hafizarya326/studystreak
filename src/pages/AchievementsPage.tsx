import { useMemo, useState } from 'react'
import { Lock, Sparkles, Trophy, Unlock } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Segmented } from '../components/ui/Segmented'
import { EmptyState } from '../components/ui/EmptyState'
import { AchievementCard } from '../components/achievements/AchievementCard'
import { Flame } from '../components/streak/Flame'
import { useData } from '../context/DataContext'
import { formatDateLabel } from '../lib/date'

export function AchievementsPage() {
  const { achievements } = useData()
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all')

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const pct = Math.round((unlockedCount / achievements.length) * 100)

  const visible = useMemo(() => {
    const list = [...achievements]
    if (filter === 'unlocked') return list.filter((a) => a.unlocked)
    if (filter === 'locked') return list.filter((a) => !a.unlocked)
    return list.sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
      return b.pct - a.pct
    })
  }, [achievements, filter])

  const history = useMemo(
    () =>
      achievements
        .filter((a) => a.unlocked && a.unlockedAt)
        .sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0)),
    [achievements],
  )

  return (
    <div>
      <PageHeader
        title="Achievements"
        description="Milestones that celebrate consistency, focus and dedication. Keep showing up."
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card className="card-pad relative overflow-hidden lg:col-span-2">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-coral/10 blur-2xl" aria-hidden />
          <div className="relative flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-coral/12">
              <Trophy className="h-8 w-8 text-coral-600" />
            </span>
            <div className="flex-1">
              <p className="font-display text-2xl font-bold text-ink">
                {unlockedCount}
                <span className="text-base font-medium text-muted"> / {achievements.length} unlocked</span>
              </p>
              <ProgressBar value={pct} tone="coral" className="mt-3" />
              <p className="mt-2 text-xs text-muted">
                {pct === 100
                  ? 'Every achievement unlocked. Absolutely legendary.'
                  : `${achievements.length - unlockedCount} left to earn. You are ${pct}% of the way there.`}
              </p>
            </div>
          </div>
        </Card>

        <Card className="card-pad">
          <CardHeader title="Achievement history" subtitle="Most recently unlocked" icon={<Sparkles className="h-[18px] w-[18px]" />} />
          <div className="mt-4">
            {history.length === 0 ? (
              <p className="text-xs text-muted">Your unlocked achievements will appear here.</p>
            ) : (
              <ul className="space-y-2.5">
                {history.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <Flame size={16} animated={false} />
                    <span className="flex-1 truncate text-sm font-medium text-ink">{a.title}</span>
                    <span className="text-[11px] text-muted">
                      {formatDateLabel(a.unlockedAt ?? 0, { month: 'short', day: 'numeric' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mb-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', icon: <Trophy className="h-3.5 w-3.5" /> },
            { value: 'unlocked', label: 'Unlocked', icon: <Unlock className="h-3.5 w-3.5" /> },
            { value: 'locked', label: 'Locked', icon: <Lock className="h-3.5 w-3.5" /> },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-5 w-5" />}
          title={filter === 'unlocked' ? 'No achievements unlocked yet' : 'Everything is unlocked!'}
          description={
            filter === 'unlocked'
              ? 'Complete focus sessions and build your streak to unlock badges.'
              : 'Incredible work — you have earned every single one.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((a) => (
            <AchievementCard key={a.id} achievement={a} />
          ))}
        </div>
      )}
    </div>
  )
}
