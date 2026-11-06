import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '../components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage/12 text-sage-700">
        <Compass className="h-7 w-7" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold text-ink">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-muted">
        The page you are looking for does not exist. Let's get you back to studying.
      </p>
      <Link to="/" className="mt-5">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  )
}
