// StrategyEngine interface — all constraint strategies implement this.
// The Cell lifecycle runner (Edge Functions + Server Actions) calls only these methods,
// so adding a new strategy never requires changing the runner.

export type CellStage =
  | 'FORMING'
  | 'BRIEFING'
  | 'SUBMISSION'
  | 'EDITING'
  | 'PROMOTION'
  | 'COMPLETE'

// Events that can award merit
export type MeritEvent =
  | 'submission_accepted'
  | 'promotion_on_time'
  | 'cycle_completed_as_editor'
  | 'cycle_completed_as_member'

// Automated actions taken when a penalty fires
export type PenaltyAction = 'warn' | 'warn_then_kick' | 'kick'

export interface PenaltyRule {
  action: PenaltyAction
  merit_delta: number // negative integer
}

// What the lifecycle runner does after applying a penalty
export interface DeadlinePenalty {
  rule: PenaltyRule
  // who gets penalised — the strategy knows which roles are responsible per stage
  targetRole: 'EDITOR' | 'WRITER' | 'MEMBER'
  reason: string
}

export interface EditorCandidate {
  userId: string
  meritScore: number
}

export interface ValidationResult {
  valid: boolean
  reason?: string
}

export interface StrategyEngine {
  readonly strategyId: string

  // ── Stage machine ──────────────────────────────────────────────────────────

  /** Returns the stage that follows `currentStage` in normal progression. */
  getNextStage(currentStage: CellStage): CellStage

  /**
   * How many days the stage deadline should be set for.
   * Returns null for stages that have no automated deadline (e.g. COMPLETE).
   */
  getStageDurationDays(stage: CellStage): number | null

  // ── Member eligibility ─────────────────────────────────────────────────────

  /** True if a user with `meritScore` is allowed to join. */
  canMemberJoin(meritScore: number): boolean

  /** True once `memberCount` reaches the minimum needed to start BRIEFING. */
  isQuorumMet(memberCount: number): boolean

  // ── Editor election ────────────────────────────────────────────────────────

  /**
   * Elects one editor from the candidate list.
   * Returns the userId of the elected member.
   * Pure function — caller supplies all entropy needed (candidates + meritScores).
   */
  electEditor(candidates: EditorCandidate[]): string

  // ── Deadline penalties ─────────────────────────────────────────────────────

  /**
   * Returns the penalty that fires when the given stage deadline is missed.
   * Returns null for stages that have no automated penalty (e.g. FORMING).
   */
  getDeadlinePenalty(stage: CellStage): DeadlinePenalty | null

  /**
   * True if a member's merit score has fallen to or below the kick threshold.
   * The lifecycle runner calls this after applying any merit delta.
   */
  shouldKickForMerit(currentMeritScore: number): boolean

  // ── Submission rules ───────────────────────────────────────────────────────

  validateWordCount(wordCount: number): ValidationResult
  maxSubmissionsPerWriter(): number
  minSubmissionsRequired(): number

  // ── Merit gains ────────────────────────────────────────────────────────────

  meritGainForEvent(event: MeritEvent): number

  // ── Cycle behaviour ────────────────────────────────────────────────────────

  shouldRecurOnCompletion(): boolean
}
