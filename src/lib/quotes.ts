export interface Quote {
  text: string
  author: string
}

export const QUOTES: Quote[] = [
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Small daily improvements are the key to staggering long-term results.', author: 'Robin Sharma' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'The expert in anything was once a beginner.', author: 'Helen Hayes' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'Focus is not saying yes. It is saying no to a thousand good ideas.', author: 'Steve Jobs' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'Continuous improvement is better than delayed perfection.', author: 'Mark Twain' },
  { text: 'A little progress each day adds up to big results.', author: 'Satya Nani' },
  { text: 'Motivation gets you started. Habit keeps you going.', author: 'Jim Ryun' },
  { text: 'You do not have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
  { text: 'Great things are not done by impulse, but by a series of small things.', author: 'Vincent van Gogh' },
]

/** Deterministic quote of the day, stable for the whole local calendar day. */
export function quoteOfTheDay(date = new Date()): Quote {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / 86_400_000)
  return QUOTES[dayOfYear % QUOTES.length]
}

/** Random-but-encouraging message shown when a focus session completes. */
const CELEBRATIONS = [
  'Session complete. That is a brick in the wall.',
  'Nice focus! Your future self says thank you.',
  'Another session in the books. Momentum is real.',
  'You showed up and did the work. That counts.',
  'Focused and finished. Keep the streak alive.',
  'That is how consistency is built — one session at a time.',
  'Great work. Rest, reset, and go again.',
]

export function completionMessage(): string {
  return CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)]
}

/** Messages for the streak card depending on state. */
export function streakNudge(opts: {
  current: number
  studiedToday: boolean
  atRisk: boolean
  freezesAvailable: number
}): string {
  if (opts.studiedToday) {
    if (opts.current <= 1) return 'You started today. Come back tomorrow to build the flame.'
    return `Day ${opts.current} is locked in. See you tomorrow!`
  }
  if (opts.current > 0) {
    const freezeLine =
      opts.freezesAvailable > 0
        ? ` You have ${opts.freezesAvailable} freeze${opts.freezesAvailable > 1 ? 's' : ''} as backup.`
        : ''
    return `Your ${opts.current}-day streak is waiting — one session keeps it alive.${freezeLine}`
  }
  return 'No streak yet. Complete one focus session to light the flame.'
}
