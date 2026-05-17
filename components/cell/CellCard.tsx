import Link from 'next/link'
import { JoinCellButton } from './JoinCellButton'
import type { EzineStrategyConfig } from '@/lib/strategies/ezine'

interface CellCardProps {
  id: string
  slug: string
  title: string
  description: string | null
  memberCount: number
  memberCap: number
  minMembers: number
  stageDeadline: string | null
  strategyConfig: EzineStrategyConfig
  isMember: boolean
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

export function CellCard({
  id,
  slug,
  title,
  description,
  memberCount,
  memberCap,
  minMembers,
  stageDeadline,
  strategyConfig,
  isMember,
}: CellCardProps) {
  const fillPct = Math.round((memberCount / memberCap) * 100)
  const daysLeft = stageDeadline ? daysUntil(stageDeadline) : null
  const deadlineUrgent = daysLeft !== null && daysLeft <= 2

  return (
    <article className="border border-near-black/20 hover:border-near-black transition-colors duration-100">
      <div className="px-5 py-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <Link
            href={`/cells/${slug}`}
            className="font-serif-display text-xl hover:text-accent-red transition-colors"
          >
            {title}
          </Link>
          <span className="font-mono text-xs text-olive whitespace-nowrap shrink-0 mt-1">
            EZINE_V1
          </span>
        </div>

        {description && (
          <p className="font-body text-sm text-near-black/70 mb-4 leading-relaxed line-clamp-2">
            {description}
          </p>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 mb-4">
          <span className="font-mono text-xs text-olive">
            <span className="text-near-black">{memberCount}</span>/{memberCap} members
            {memberCount < minMembers && (
              <span className="text-olive/60"> (need {minMembers} to start)</span>
            )}
          </span>
          <span className="font-mono text-xs text-olive">
            Merit ≥{' '}
            <span className="text-near-black">{strategyConfig.min_merit_to_join}</span>
          </span>
          <span className="font-mono text-xs text-olive">
            {strategyConfig.word_count_min}–{strategyConfig.word_count_max} words
          </span>
          {daysLeft !== null && (
            <span
              className={`font-mono text-xs ${deadlineUrgent ? 'text-accent-red' : 'text-olive'}`}
            >
              {daysLeft === 0 ? 'Closing today' : `${daysLeft}d to form`}
            </span>
          )}
        </div>

        {/* Fill bar */}
        <div className="w-full h-px bg-near-black/10 mb-4 relative">
          <div
            className="absolute left-0 top-0 h-px bg-near-black transition-all duration-300"
            style={{ width: `${fillPct}%` }}
          />
        </div>

        {/* CTA */}
        {isMember ? (
          <Link
            href={`/cells/${slug}`}
            className="font-mono text-xs border border-near-black/30 px-4 py-1.5 hover:border-near-black transition-colors"
          >
            View Cell
          </Link>
        ) : (
          <JoinCellButton cellId={id} />
        )}
      </div>
    </article>
  )
}
