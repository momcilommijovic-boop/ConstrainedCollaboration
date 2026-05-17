import { z } from 'zod'
import type {
  CellStage,
  DeadlinePenalty,
  EditorCandidate,
  MeritEvent,
  StrategyEngine,
  ValidationResult,
} from './types'

// ── Config schema (mirrors the EZINE_V1 default_config in the DB) ────────────

const PenaltyRuleSchema = z.object({
  action: z.enum(['warn', 'warn_then_kick', 'kick']),
  merit_delta: z.number().int().negative(),
})

export const EzineStrategyConfigSchema = z.object({
  forming_timeout_days: z.number().int().min(1).max(60),
  briefing_window_days: z.number().int().min(1).max(14),
  submission_window_days: z.number().int().min(1).max(30),
  editing_window_days: z.number().int().min(1).max(14),
  promotion_window_days: z.number().int().min(1).max(14),
  min_submissions_required: z.number().int().min(1),
  max_submissions_per_writer: z.number().int().min(1),
  editor_election_method: z.enum(['random', 'merit_weighted', 'vote']),
  illustrator_required: z.boolean(),
  illustrator_dedicated: z.boolean(),
  word_count_min: z.number().int().min(50),
  word_count_max: z.number().int().min(100),
  penalty_rules: z.object({
    missed_brief: PenaltyRuleSchema,
    missed_submission: PenaltyRuleSchema,
    missed_promotion: PenaltyRuleSchema,
    second_offense: PenaltyRuleSchema,
    merit_kick_threshold: z.number().int().min(0).max(100),
  }),
  promotion_requirement: z.enum(['social_link', 'none']),
  min_merit_to_join: z.number().int().min(0).max(100),
  recur_on_completion: z.boolean(),
})

export type EzineStrategyConfig = z.infer<typeof EzineStrategyConfigSchema>

// ── Stage ordering ────────────────────────────────────────────────────────────

const STAGE_SEQUENCE: CellStage[] = [
  'FORMING',
  'BRIEFING',
  'SUBMISSION',
  'EDITING',
  'PROMOTION',
  'COMPLETE',
]

// ── Merit gain table ──────────────────────────────────────────────────────────

const MERIT_GAINS: Record<MeritEvent, number> = {
  submission_accepted: 10,
  promotion_on_time: 5,
  cycle_completed_as_editor: 15,
  cycle_completed_as_member: 3,
}

// ── EzineStrategy ─────────────────────────────────────────────────────────────

export class EzineStrategy implements StrategyEngine {
  readonly strategyId = 'EZINE_V1'

  constructor(private readonly config: EzineStrategyConfig) {}

  // ── Stage machine ────────────────────────────────────────────────────────

  getNextStage(currentStage: CellStage): CellStage {
    if (currentStage === 'COMPLETE') {
      // Recurring cells go back to BRIEFING; non-recurring stay at COMPLETE.
      return this.config.recur_on_completion ? 'BRIEFING' : 'COMPLETE'
    }
    const idx = STAGE_SEQUENCE.indexOf(currentStage)
    if (idx === -1 || idx === STAGE_SEQUENCE.length - 1) return 'COMPLETE'
    return STAGE_SEQUENCE[idx + 1]
  }

  getStageDurationDays(stage: CellStage): number | null {
    switch (stage) {
      case 'FORMING':
        return this.config.forming_timeout_days
      case 'BRIEFING':
        return this.config.briefing_window_days
      case 'SUBMISSION':
        return this.config.submission_window_days
      case 'EDITING':
        return this.config.editing_window_days
      case 'PROMOTION':
        return this.config.promotion_window_days
      case 'COMPLETE':
        return null
      default:
        return null
    }
  }

  // ── Member eligibility ───────────────────────────────────────────────────

  canMemberJoin(meritScore: number): boolean {
    return meritScore >= this.config.min_merit_to_join
  }

  isQuorumMet(memberCount: number): boolean {
    // The CLAUDE.md min_members is set on the cell itself, not the strategy.
    // This method checks the strategy's own minimum (min_submissions_required acts
    // as a lower bound — you need at least that many writers).
    return memberCount >= this.config.min_submissions_required
  }

  // ── Editor election ──────────────────────────────────────────────────────

  electEditor(candidates: EditorCandidate[]): string {
    if (candidates.length === 0) throw new Error('Cannot elect editor from empty candidate list')

    switch (this.config.editor_election_method) {
      case 'merit_weighted':
        return this._meritWeightedElection(candidates)
      case 'vote':
        // Voting is handled externally; fall back to merit-weighted as a tiebreaker
        return this._meritWeightedElection(candidates)
      case 'random':
      default:
        return this._uniformRandomElection(candidates)
    }
  }

  private _uniformRandomElection(candidates: EditorCandidate[]): string {
    const idx = Math.floor(Math.random() * candidates.length)
    return candidates[idx].userId
  }

  private _meritWeightedElection(candidates: EditorCandidate[]): string {
    const total = candidates.reduce((sum, c) => sum + Math.max(c.meritScore, 1), 0)
    let cursor = Math.random() * total
    for (const candidate of candidates) {
      cursor -= Math.max(candidate.meritScore, 1)
      if (cursor <= 0) return candidate.userId
    }
    // Fallback — should never reach here due to floating point
    return candidates[candidates.length - 1].userId
  }

  // ── Deadline penalties ───────────────────────────────────────────────────

  getDeadlinePenalty(stage: CellStage): DeadlinePenalty | null {
    const rules = this.config.penalty_rules
    switch (stage) {
      case 'BRIEFING':
        return {
          rule: rules.missed_brief,
          targetRole: 'EDITOR',
          reason: 'Missed brief publication deadline',
        }
      case 'SUBMISSION':
        return {
          rule: rules.missed_submission,
          targetRole: 'WRITER',
          reason: 'Missed submission deadline',
        }
      case 'EDITING':
        // Editor missed the editing/publication deadline
        return {
          rule: rules.missed_brief,
          targetRole: 'EDITOR',
          reason: 'Missed publication deadline',
        }
      case 'PROMOTION':
        return {
          rule: rules.missed_promotion,
          targetRole: 'MEMBER',
          reason: 'Missed promotion deadline',
        }
      case 'FORMING':
      case 'COMPLETE':
        return null
      default:
        return null
    }
  }

  shouldKickForMerit(currentMeritScore: number): boolean {
    return currentMeritScore <= this.config.penalty_rules.merit_kick_threshold
  }

  // ── Submission rules ─────────────────────────────────────────────────────

  validateWordCount(wordCount: number): ValidationResult {
    const { word_count_min, word_count_max } = this.config
    if (wordCount < word_count_min) {
      return {
        valid: false,
        reason: `Submission is ${wordCount} words — minimum is ${word_count_min}.`,
      }
    }
    if (wordCount > word_count_max) {
      return {
        valid: false,
        reason: `Submission is ${wordCount} words — maximum is ${word_count_max}.`,
      }
    }
    return { valid: true }
  }

  maxSubmissionsPerWriter(): number {
    return this.config.max_submissions_per_writer
  }

  minSubmissionsRequired(): number {
    return this.config.min_submissions_required
  }

  // ── Merit gains ──────────────────────────────────────────────────────────

  meritGainForEvent(event: MeritEvent): number {
    return MERIT_GAINS[event] ?? 0
  }

  // ── Cycle behaviour ──────────────────────────────────────────────────────

  shouldRecurOnCompletion(): boolean {
    return this.config.recur_on_completion
  }

  // ── Config access (for Edge Functions that need raw values) ──────────────

  getConfig(): EzineStrategyConfig {
    return this.config
  }
}

/**
 * Parse and validate a raw JSON config blob from the DB into a typed EzineStrategyConfig.
 * Throws a ZodError with field-level messages if validation fails.
 */
export function parseEzineConfig(raw: unknown): EzineStrategyConfig {
  return EzineStrategyConfigSchema.parse(raw)
}
