import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowRight, Check, Flame, Sparkles, Timer, TrendingUp, Trophy } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Field, TextInput } from '../components/ui/Field'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const FEATURES = [
  { icon: Timer, title: 'Pomodoro that persists', text: 'Refresh or switch tabs — your timer keeps perfect time.' },
  { icon: Flame, title: 'Daily streaks', text: 'One focus session a day keeps the flame alive, with freezes as backup.' },
  { icon: TrendingUp, title: 'Honest statistics', text: 'Weekly trends, consistency, subjects and study history.' },
  { icon: Trophy, title: 'Achievements', text: 'Unlock badges as you build a genuine study habit.' },
]

export function AuthPage() {
  const { user, login, register, demoLogin, loading } = useAuth()
  const { push } = useToast()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'register') {
        await register({ name, email, password })
        push({ title: 'Welcome to StudyStreak!', description: 'Your first session starts the flame.', variant: 'streak' })
      } else {
        await login({ email, password })
        push({ title: 'Welcome back!', variant: 'success' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const handleDemo = async () => {
    setBusy(true)
    try {
      await demoLogin()
      push({ title: 'Demo account ready', description: 'Explore freely — everything is local.', variant: 'success' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sage/10 p-10 lg:flex">
        <div className="pointer-events-none absolute -left-16 top-1/3 h-72 w-72 rounded-full bg-sage/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-10 top-10 h-56 w-56 rounded-full bg-coral/10 blur-3xl" aria-hidden />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card shadow-soft">
            <Flame size={24} />
          </span>
          <span className="font-display text-xl font-extrabold text-ink">StudyStreak</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-ink">
            Study daily.
            <br />
            Build an unbreakable streak.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            A calm, focused study timer with daily streaks, achievements and statistics — designed to
            make consistency feel genuinely rewarding.
          </p>

          <div className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-sage-700 shadow-soft">
                  <f.icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{f.title}</p>
                  <p className="text-xs text-muted">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-muted">
          <Sparkles className="h-3.5 w-3.5 text-coral" />
          Local-first: your data never leaves this device.
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral/12">
              <Flame size={22} />
            </span>
            <span className="font-display text-lg font-extrabold text-ink">StudyStreak</span>
          </div>

          <h2 className="font-display text-2xl font-bold text-ink">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {mode === 'login'
              ? 'Sign in to keep your streak alive.'
              : 'Start building your study habit today.'}
          </p>

          <div className="mt-6 inline-flex w-full rounded-xl border border-line bg-subtle p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setError('')
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  mode === m ? 'bg-card text-ink shadow-soft' : 'text-muted hover:text-ink'
                }`}
              >
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === 'register' ? (
              <Field label="Name" htmlFor="name">
                <TextInput
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  autoComplete="name"
                  required
                />
              </Field>
            ) : null}
            <Field label="Email" htmlFor="email">
              <TextInput
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <TextInput
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                required
              />
            </Field>

            {error ? (
              <p className="rounded-xl border border-red-400/40 bg-red-500/[0.06] px-3 py-2.5 text-xs font-medium text-red-600">
                {error}
              </p>
            ) : null}

            <Button type="submit" fullWidth size="lg" loading={busy} rightIcon={<ArrowRight className="h-4 w-4" />}>
              {mode === 'login' ? 'Log in' : 'Create account'}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <Button variant="outline" fullWidth onClick={handleDemo} disabled={busy}>
            Try the demo account
          </Button>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted">
            <Check className="h-3 w-3 text-sage-700" />
            Accounts and data are stored securely in your browser.
          </p>
        </div>
      </div>
    </div>
  )
}
