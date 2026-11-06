import { CheckCircle2, Coffee, Quote } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useTimer } from '../../context/TimerContext'
import { useData } from '../../context/DataContext'
import { completionMessage, quoteOfTheDay } from '../../lib/quotes'
import { formatDuration } from '../../lib/date'
import { Flame } from '../streak/Flame'

export function CompletionModal() {
  const { lastResult, dismissResult, skip, status } = useTimer()
  const { streak } = useData()
  const quote = quoteOfTheDay()

  const open = lastResult !== null
  const isFocus = lastResult?.isFocus ?? false

  return (
    <Modal
      open={open}
      onClose={dismissResult}
      size="sm"
      className="text-center"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={dismissResult} fullWidth>
            Dismiss
          </Button>
          {status === 'completed' ? (
            <Button
              variant={isFocus ? 'coral' : 'primary'}
              onClick={() => {
                skip()
                dismissResult()
              }}
              fullWidth
            >
              {isFocus ? 'Go to break' : 'Start focus'}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col items-center">
        <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-sage/12">
          <span className="absolute inset-0 animate-pulse-ring rounded-3xl bg-sage/25" aria-hidden />
          {isFocus ? (
            <CheckCircle2 className="h-10 w-10 text-sage-700" />
          ) : (
            <Coffee className="h-10 w-10 text-sage-700" />
          )}
        </div>
        <h2 className="font-display text-xl font-bold text-ink">
          {isFocus ? 'Focus session complete' : 'Break finished'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {isFocus
            ? `You studied for ${formatDuration(lastResult?.durationSec ?? 0)}.`
            : 'Nice reset. Time to dive back in.'}
        </p>

        {isFocus ? (
          <div className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-coral/25 bg-coral/[0.07] p-3.5 text-left">
            <Flame size={30} glow />
            <div>
              <p className="text-sm font-semibold text-ink">
                {streak.studiedToday
                  ? `${streak.current}-day streak ${streak.current === 1 ? 'started' : 'extended'}`
                  : 'Session logged'}
              </p>
              <p className="text-xs text-muted">
                {streak.studiedToday
                  ? 'Today counts toward your streak.'
                  : 'Complete one longer focus session to count today.'}
              </p>
            </div>
          </div>
        ) : null}

        <p className="mt-4 text-sm text-ink">{completionMessage()}</p>

        <div className="mt-4 flex w-full items-start gap-2 rounded-2xl bg-subtle/70 p-3.5 text-left">
          <Quote className="mt-0.5 h-4 w-4 shrink-0 text-sage-700" />
          <p className="text-xs italic leading-relaxed text-muted">
            “{quote.text}” <span className="not-italic">— {quote.author}</span>
          </p>
        </div>
      </div>
    </Modal>
  )
}
