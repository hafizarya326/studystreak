/**
 * End-to-end smoke test: renders the real app in jsdom, seeds a user +
 * sessions via the real repository, and verifies that a completed timer
 * actually records a session and updates the UI.
 *
 * Run: npm run smoke
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from '../src/App'
import { ToastProvider } from '../src/context/ToastContext'
import { AuthProvider } from '../src/context/AuthContext'
import { SettingsProvider } from '../src/context/SettingsContext'
import { DataProvider } from '../src/context/DataContext'
import { TimerProvider } from '../src/context/TimerContext'
import { repository, timerStorage } from '../src/lib/repository'
import { hashPassword, makeSalt } from '../src/lib/crypto'
import type { StudySession } from '../src/types'

const USER_ID = 'u_smoke'

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++
    console.log(`  \u2713 ${name}`)
  } else {
    failed++
    console.log(`  \u2717 ${name}`, detail !== undefined ? JSON.stringify(detail) : '')
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <DataProvider>
            <TimerProvider>{children}</TimerProvider>
          </DataProvider>
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

function seedSessions(): StudySession[] {
  const sessions: StudySession[] = []
  const now = new Date()
  // Three consecutive days ending today: today, -1, -2.
  for (let offset = 2; offset >= 0; offset--) {
    const d = new Date(now)
    d.setDate(d.getDate() - offset)
    d.setHours(9, 0, 0, 0)
    const start = d.getTime()
    sessions.push({
      id: `seed_${offset}`,
      userId: USER_ID,
      startedAt: start,
      endedAt: start + 1500_000,
      durationSec: 1500,
      type: 'focus',
      subject: 'Mathematics',
      completed: true,
      modeId: 'pomodoro',
    })
  }
  return sessions
}

async function main() {
  console.log('\nSeeding repository')
  const salt = makeSalt()
  await repository.saveUser({
    id: USER_ID,
    name: 'Smoke Tester',
    email: 'smoke@studystreak.test',
    avatar: '🦉',
    tagline: 'Automated verification.',
    createdAt: Date.now(),
    passwordHash: await hashPassword('secret123', salt),
    salt,
  })
  await repository.setActiveUserId(USER_ID)

  const seeded = seedSessions()
  for (const s of seeded) await repository.saveSession(USER_ID, s)
  check('seeded 3 sessions', (await repository.listSessions(USER_ID)).length === 3)

  // Seed a *running* custom focus timer that has already elapsed, so the
  // completion pipeline fires as soon as the app hydrates.
  timerStorage.write(USER_ID, {
    modeId: 'custom',
    type: 'focus',
    status: 'running',
    durationSec: 60,
    remainingSec: 0,
    endAt: Date.now() - 2_000,
    startedAt: Date.now() - 62_000,
    pomodorosCompleted: 0,
    subject: 'Smoke Focus',
    label: 'auto-verified',
    updatedAt: Date.now(),
  })
  check('timer state persisted', timerStorage.read(USER_ID) !== null)

  console.log('\nRendering the app')
  const container = document.getElementById('root')!
  let root: Root | null = null
  await act(async () => {
    root = createRoot(container)
    root.render(
      <Providers>
        <App />
      </Providers>,
    )
  })
  await act(async () => {
    await sleep(120)
  })

  const text = container.textContent ?? ''

  check('app shell rendered', text.includes('StudyStreak'))
  check('authenticated user reached the dashboard', !text.includes('Welcome back'))
  check('dashboard shows the streak card', text.includes('Days in a Row'))
  check('seeded subject appears in recent sessions', text.includes('Mathematics'))
  check('completion modal is shown', text.includes('Focus session complete'))

  console.log('\nVerifying the completion was recorded')
  const after = await repository.listSessions(USER_ID)
  const smokeSession = after.find((s) => s.subject === 'Smoke Focus')
  check('timer completion saved a new session', Boolean(smokeSession))
  check('total sessions is now 4', after.length === 4, { count: after.length })
  check(
    'saved session kept its planned duration',
    smokeSession?.durationSec === 60,
    smokeSession?.durationSec,
  )
  check('saved session is marked completed', smokeSession?.completed === true)
  check('saved session carries the label', smokeSession?.label === 'auto-verified')

  console.log('\nVerifying streak math on the real data')
  // 3 seeded days (today, -1, -2) + the completed session today => streak 3.
  const days = new Set(
    after
      .filter((s) => s.completed && s.type === 'focus')
      .map((s) => {
        const d = new Date(s.startedAt)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }),
  )
  check('three distinct qualifying days', days.size === 3, { days: [...days] })

  console.log('\nVerifying persistence across a remount')
  await act(async () => {
    root?.unmount()
  })
  const container2 = document.createElement('div')
  container2.id = 'root2'
  document.body.appendChild(container2)
  await act(async () => {
    root = createRoot(container2)
    root.render(
      <Providers>
        <App />
      </Providers>,
    )
  })
  await act(async () => {
    await sleep(120)
  })
  const text2 = container2.textContent ?? ''
  check('data survives a remount', text2.includes('Mathematics') && text2.includes('Days in a Row'))
  check('no duplicate session on remount', (await repository.listSessions(USER_ID)).length === 4)

  await act(async () => {
    root?.unmount()
  })

  console.log(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed > 0 ? 1 : 0)
}

// Watchdog so a stuck environment can never hang CI.
const watchdog = setTimeout(() => {
  console.error('\nSmoke test timed out after 60s')
  process.exit(2)
}, 60_000)
watchdog.unref?.()

main().catch((err) => {
  console.error('\nSmoke test crashed:\n', err)
  process.exit(1)
})
