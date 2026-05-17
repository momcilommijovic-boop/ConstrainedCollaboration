type MeritEntry = { delta: number }

function trend(history: MeritEntry[]): '↑' | '↓' | '—' {
  if (!history || history.length === 0) return '—'
  const sum = history.slice(0, 5).reduce((acc, e) => acc + (e.delta ?? 0), 0)
  if (sum > 0) return '↑'
  if (sum < 0) return '↓'
  return '—'
}

interface MeritBadgeProps {
  score: number
  history?: MeritEntry[]
  size?: 'sm' | 'lg'
}

export function MeritBadge({ score, history = [], size = 'sm' }: MeritBadgeProps) {
  const t = trend(history)
  const trendColor =
    t === '↑' ? 'text-near-black' : t === '↓' ? 'text-accent-red' : 'text-olive'

  if (size === 'lg') {
    return (
      <div className="flex items-baseline gap-2">
        <span className="font-serif-display text-3xl tabular-nums">{score}</span>
        <span className={`font-mono text-sm ${trendColor}`}>{t}</span>
      </div>
    )
  }

  return (
    <span className="font-mono text-xs">
      <span className="text-olive">Merit </span>
      <span className="text-near-black tabular-nums">{score}</span>
      <span className={`ml-1 ${trendColor}`}>{t}</span>
    </span>
  )
}
