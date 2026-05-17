// Pure EZINE_V1 strategy logic — no side effects, no DB imports.
// Imported by all Edge Functions that need stage machine behaviour.

export interface PenaltyRule {
  action: 'warn' | 'warn_then_kick' | 'kick'
  merit_delta: number
}

export interface EzineConfig {
  forming_timeout_days: number
  briefing_window_days: number
  submission_window_days: number
  editing_window_days: number
  promotion_window_days: number
  min_submissions_required: number
  max_submissions_per_writer: number
  editor_election_method: 'random' | 'merit_weighted' | 'vote'
  illustrator_required: boolean
  illustrator_dedicated: boolean
  word_count_min: number
  word_count_max: number
  penalty_rules: {
    missed_brief: PenaltyRule
    missed_submission: PenaltyRule
    missed_promotion: PenaltyRule
    second_offense: PenaltyRule
    merit_kick_threshold: number
  }
  promotion_requirement: 'social_link' | 'none'
  min_merit_to_join: number
  recur_on_completion: boolean
}

export type Stage =
  | 'FORMING'
  | 'BRIEFING'
  | 'SUBMISSION'
  | 'EDITING'
  | 'PROMOTION'
  | 'COMPLETE'

const STAGE_ORDER: Stage[] = [
  'FORMING',
  'BRIEFING',
  'SUBMISSION',
  'EDITING',
  'PROMOTION',
  'COMPLETE',
]

export function getNextStage(current: Stage, recur: boolean): Stage {
  if (current === 'COMPLETE') return recur ? 'BRIEFING' : 'COMPLETE'
  const idx = STAGE_ORDER.indexOf(current)
  if (idx < 0 || idx === STAGE_ORDER.length - 1) return 'COMPLETE'
  return STAGE_ORDER[idx + 1]
}

export function getStageDurationDays(stage: Stage, config: EzineConfig): number | null {
  switch (stage) {
    case 'FORMING':     return config.forming_timeout_days
    case 'BRIEFING':    return config.briefing_window_days
    case 'SUBMISSION':  return config.submission_window_days
    case 'EDITING':     return config.editing_window_days
    case 'PROMOTION':   return config.promotion_window_days
    case 'COMPLETE':    return null
  }
}

export function deadlineForStage(stage: Stage, config: EzineConfig): string | null {
  const days = getStageDurationDays(stage, config)
  if (days === null) return null
  return new Date(Date.now() + days * 864e5).toISOString()
}

export interface DeadlinePenaltySpec {
  targetRole: 'EDITOR' | 'WRITER' | 'MEMBER'
  rule: PenaltyRule
  reason: string
}

export function getDeadlinePenalty(stage: Stage, config: EzineConfig): DeadlinePenaltySpec | null {
  const r = config.penalty_rules
  switch (stage) {
    case 'BRIEFING':
      return { targetRole: 'EDITOR', rule: r.missed_brief,      reason: 'Missed brief publication deadline' }
    case 'SUBMISSION':
      return { targetRole: 'WRITER', rule: r.missed_submission,  reason: 'Missed submission deadline' }
    case 'EDITING':
      return { targetRole: 'EDITOR', rule: r.missed_brief,      reason: 'Missed publication deadline' }
    case 'PROMOTION':
      return { targetRole: 'MEMBER', rule: r.missed_promotion,   reason: 'Missed promotion deadline' }
    default:
      return null
  }
}

export function shouldKickForMerit(score: number, config: EzineConfig): boolean {
  return score <= config.penalty_rules.merit_kick_threshold
}

// Merit gains applied at cycle completion
export const MERIT_GAINS = {
  submission_accepted:        10,
  promotion_on_time:           5,
  cycle_completed_as_editor:  15,
  cycle_completed_as_member:   3,
} as const

// Weighted-random editor election
export function electEditor(
  candidates: { userId: string; meritScore: number }[],
  method: EzineConfig['editor_election_method'],
): string {
  if (candidates.length === 0) throw new Error('No candidates for editor election')
  if (method === 'merit_weighted' || method === 'vote') {
    const total = candidates.reduce((s, c) => s + Math.max(c.meritScore, 1), 0)
    let cursor = Math.random() * total
    for (const c of candidates) {
      cursor -= Math.max(c.meritScore, 1)
      if (cursor <= 0) return c.userId
    }
    return candidates[candidates.length - 1].userId
  }
  return candidates[Math.floor(Math.random() * candidates.length)].userId
}
