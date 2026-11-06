# StudyStreak 🔥

**English** · [Bahasa Indonesia](README.id.md)

A calm, premium study productivity app that combines a **Pomodoro study timer**
with a **TikTok-style daily streak system**, achievements and honest statistics.
Built to make studying feel rewarding enough to come back to every day.

Design language: **Warm Minimalist + Modern Productivity** — warm off-white
surfaces, muted sage green for primary actions and progress, coral orange
reserved exclusively for streaks and special achievements.

---

## ✨ Features

### Study timer
- **Pomodoro** (25/5), **Short Break**, **Long Break**, and **Custom** durations.
- Start / pause / resume / reset / skip, notification sounds, and a full-screen
  **Focus Mode**.
- Large circular countdown with a smooth progress ring and a session label.
- **Accurate, refresh-proof timing** — the timer stores its target end timestamp
  and recomputes from `Date.now()`, so it stays correct across tab switches and
  browser restarts (background-tab throttling can't drift it).
- Optional **status bar**? No — a persistent mini pill in the top bar shows a
  running session from any page.

### Daily streaks (the core feature)
- One streak day per calendar day with **at least one qualifying focus session**
  (default ≥ 1 min, configurable).
- Multiple sessions in a day count **once**.
- Consecutive days grow the streak; a fully missed day resets it.
- Uses the **user's local timezone** — never UTC.
- Longest streak and total study days are tracked separately.
- **Streak Freeze**: earn one freeze for every 7 consecutive days (bank up to 3).
  A freeze is consumed automatically to protect exactly one missed day, and the
  same missed day can never consume two freezes.
- Milestones: 1 / 3 / 7 / 14 / 30 days, each with its own message.

### Dashboard, statistics & calendars
- Streak overview, large timer, today's progress, weekly chart, activity
  heatmap, recent sessions and an achievement preview.
- GitHub-style **contribution heatmap** and a monthly **streak calendar** with
  sage-shaded intensity, freeze markers, month navigation and day detail.
- Weekly trend (area chart) and 6-month progress (bar chart), subject donut,
  consistency %, best day, totals and averages.

### History, achievements, goals & extras
- Full study history with search, subject/type filters, date ranges, by-day
  grouping, per-session notes, deletion and **CSV / JSON export**.
- 10 **achievements** with locked/unlocked states, progress indicators, unlock
  animations and celebration toasts.
- Daily / weekly / session-count **goals** with progress bars and completion
  notifications.
- Daily motivational quote, generated **ambient soundscapes** (no audio files),
  a **custom music** option (your own audio file or URL, looped and synced to the
  timer), plus an optional **Spotify embed** for a playlist you own (display-only —
  Spotify playback can't be driven by code), browser notifications, subject
  management, custom session labels and a personal study profile.
- **Light & dark** themes (system-aware, flash-free).

### Auth & storage
- Local email/password registration, login, logout, profile editing, account
  deletion, plus a one-click **demo account**.
- Passwords are hashed (SHA-256 + per-user salt); only the hash is stored.
- All progress persists in `localStorage`, scoped per user.

---

## 🧱 Tech stack

| Area | Choice |
| --- | --- |
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS (CSS-variable design tokens) |
| Icons | lucide-react |
| Charts | Recharts |
| Routing | React Router |
| Persistence | localStorage (modular repository — see below) |

---

## 🚀 Getting started

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check + production build
npm run preview    # serve the production build
npm run typecheck  # TypeScript only
npm run verify     # 54 core-logic assertions (streaks, freezes, stats, Spotify links)
npm run smoke      # end-to-end render + timer-completion test in jsdom
```

Open the printed local URL, choose **Try the demo account**, and finish a focus
session (use a short Custom timer) to light the flame.

---

## 🗂 Project structure

```
src/
  components/
    achievements/  AchievementCard
    calendar/      MonthCalendar, Heatmap, intensity levels
    charts/        Weekly / trend / monthly / subject charts
    layout/        AppLayout, Sidebar, Topbar, BottomNav, MobileDrawer
    streak/        Flame, StreakCard
    timer/         TimerPanel, CompletionModal, SoundCard
    ui/            Button, Card, Modal, ProgressBar/Ring, Toggle, Segmented…
  context/
    AuthContext      accounts, login/register/logout
    SettingsContext  per-user prefs + theme application
    DataContext      sessions, derived stats/streak/achievements + notifications
    TimerContext     timer state machine, persistence, completion handling
    ToastContext     global toast queue
  hooks/            useCurrentDay, useMediaQuery, useIsDark
  lib/
    date.ts         local-timezone date helpers
    streak.ts       pure, deterministic streak + freeze engine
    stats.ts        statistics aggregation
    achievements.ts definitions + evaluation
    repository.ts   persistence interface + LocalRepository + timer storage
    music.ts        custom audio engine + Spotify link parsing
    audio-library.ts IndexedDB store for uploaded tracks
    crypto.ts, sound.ts, quotes.ts, export.ts, defaults.ts
  pages/            Dashboard, Timer, Calendar, History, Achievements, Settings, Auth
  types/            shared domain types
scripts/
  verify.ts         executable core-logic tests
  smoke.tsx         end-to-end jsdom render + timer test
  jsdom-setup.mjs   browser environment preload for the smoke test
```

---

## 🔌 Swapping in Supabase (or any backend)

All persistence flows through the `Repository` interface in
`src/lib/repository.ts`. To move to the cloud:

1. Implement a `SupabaseRepository` with the same method signatures
   (async, so nothing in the UI changes).
2. Point `export const repository` at it.
3. Optionally replace `AuthContext`'s credential calls with Supabase Auth —
   the rest of the app only consumes `user` / `login` / `register` / `logout`.

The timer's cross-refresh state is isolated in `timerStorage` at the bottom of
the same file.

---

## 🧠 How the tricky logic works

- **Streak engine** (`lib/streak.ts`) is *pure and derived*: it recomputes from
  the qualifying session days every time, walking forward from the first study
  day to today. That makes duplicate-day prevention and one-freeze-per-missed-day
  guarantees automatic and idempotent — there is no mutable streak counter to
  corrupt.
- **Today is never "missed"** until the day actually ends, so a streak shows as
  alive (and "at risk") even before you study on the current day.
- **Timer accuracy**: running state stores `endAt`; remaining time is always
  derived from the clock, never accumulated by ticks. Completion is detected by
  comparing `now` to `endAt`, and a ref guard prevents double-recording.
- **Timezone safety**: all calendar math uses local `Date` components
  (`YYYY-MM-DD`), never `toISOString()`.

---

## ✅ Verification

The project ships with two executable test suites.

**`npm run verify`** — 54 pure-logic assertions covering local-timezone day
keys, streak growth/reset/longest tracking, duplicate-day prevention, the
qualifying threshold, freeze earning + consumption + no-duplicate usage,
perfect-week detection, statistics aggregation, achievement unlocking, Spotify
link parsing, and the midnight session-boundary edge case.

**`npm run smoke`** — renders the *real* app (all providers + router) inside
jsdom, seeds a user and sessions through the real repository, then asserts that:

- the app boots and routes an authenticated user to the dashboard,
- a persisted, already-elapsed timer is detected and its focus session is
  recorded with the correct duration, subject and label,
- the completion modal appears,
- qualifying days aggregate correctly for the streak,
- state survives a full unmount/remount, and
- **no duplicate session is recorded** on the second mount (the completion
  guard works).

Both suites exit non-zero on failure, so they can gate a build.
