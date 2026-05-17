const STAGE_ORDER = ['FORMING', 'BRIEFING', 'SUBMISSION', 'EDITING', 'PROMOTION', 'COMPLETE']

const STAGE_LABELS: Record<string, string> = {
  FORMING: 'Forming',
  BRIEFING: 'Briefing',
  SUBMISSION: 'Submission',
  EDITING: 'Editing',
  PROMOTION: 'Promotion',
  COMPLETE: 'Complete',
}

export function StageTimeline({ currentStage }: { currentStage: string }) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage)

  return (
    <div className="flex items-center overflow-x-auto pb-1">
      {STAGE_ORDER.map((stage, i) => {
        const isPast = i < currentIdx
        const isCurrent = i === currentIdx
        return (
          <div key={stage} className="flex items-center shrink-0">
            <div
              className={`font-mono text-xs px-3 py-1 border ${
                isCurrent
                  ? 'border-accent-red text-accent-red'
                  : isPast
                    ? 'border-near-black/20 text-olive'
                    : 'border-near-black/10 text-near-black/25'
              }`}
            >
              {STAGE_LABELS[stage] ?? stage}
            </div>
            {i < STAGE_ORDER.length - 1 && (
              <div
                className={`w-4 h-px ${
                  i < currentIdx ? 'bg-near-black/20' : 'bg-near-black/10'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
