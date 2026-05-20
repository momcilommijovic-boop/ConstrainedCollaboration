// Shared DB operations used by multiple Edge Functions.
// All functions receive a supabase service-role client as their first argument.

// deno-lint-ignore-file no-explicit-any
import { deadlineForStage, electEditor, MERIT_GAINS, shouldKickForMerit } from './ezine.ts'
import type { EzineConfig, Stage, PenaltyRule } from './ezine.ts'

type SupabaseClient = any // avoid importing @supabase/supabase-js types here

// ── Logging ───────────────────────────────────────────────────────────────────

export async function logSystem(
  sb: SupabaseClient,
  eventType: string,
  payload: Record<string, unknown>,
  error?: string,
) {
  await sb.from('system_log').insert({
    event_type: eventType,
    cell_id: payload.cell_id ?? null,
    user_id: payload.user_id ?? null,
    payload,
    error: error ?? null,
  })
}

// ── Email ─────────────────────────────────────────────────────────────────────

const SITE = Deno.env.get('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
}): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(opts),
    })
  } catch {
    // non-blocking — email failure should not break state transitions
  }
}

function emailHtml(title: string, body: string, ctaLabel?: string, ctaUrl?: string): string {
  const cta = ctaLabel && ctaUrl
    ? `<p style="margin:28px 0 0;"><a href="${ctaUrl}" style="font-family:monospace;font-size:13px;background:#1A1A18;color:#F5F2EC;padding:10px 20px;text-decoration:none;display:inline-block;">${ctaLabel} →</a></p>`
    : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background:#F5F2EC;margin:0;padding:40px 24px;font-family:Georgia,serif;"><div style="max-width:520px;margin:0 auto;border:1px solid rgba(26,26,24,0.2);padding:40px;background:#F5F2EC;"><p style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#7A7A5A;margin:0 0 24px;">Quorum</p><h1 style="font-size:24px;margin:0 0 20px;color:#1A1A18;font-weight:normal;">${title}</h1><div style="font-size:15px;line-height:1.7;color:#1A1A18;">${body}</div>${cta}<p style="margin:40px 0 0;font-family:monospace;font-size:11px;color:#7A7A5A;border-top:1px solid rgba(26,26,24,0.1);padding-top:20px;">This is an automated message from Quorum. Deadlines are enforced automatically.</p></div></body></html>`
}

export async function notifyEditorElectedAuto(opts: {
  sb: SupabaseClient
  editorId: string
  cellTitle: string
  cellSlug: string
  deadline: string | null
}): Promise<void> {
  const { sb, editorId, cellTitle, cellSlug, deadline } = opts
  const { data: user } = await sb.auth.admin.getUserById(editorId)
  const email = user?.user?.email
  if (!email) return

  const deadlineStr = deadline
    ? new Date(deadline).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : 'soon'

  await sendEmail({
    to: email,
    subject: `You've been elected Editor — ${cellTitle}`,
    html: emailHtml(
      `You've been elected Editor`,
      `<p>You have been randomly elected as Editor for <strong>${cellTitle}</strong>.</p><p>You must publish a Brief by <strong>${deadlineStr}</strong>. The Brief sets the theme, editorial guidance, word count limits, and invites writers.</p><p>If you miss the deadline, a penalty will be applied and a new Editor will be elected.</p>`,
      'Publish Brief',
      `${SITE}/cells/${cellSlug}/brief`,
    ),
  })
}

// ── Penalty ───────────────────────────────────────────────────────────────────

export interface ApplyPenaltyParams {
  cellId: string
  userId: string
  reason: string
  rule: PenaltyRule
  stage: Stage
  cycle: number
  config: EzineConfig
}

/**
 * Applies a merit penalty to a user:
 * - Checks for prior offenses this cycle (escalates to second_offense if any)
 * - Deducts merit (floor 0)
 * - Appends to merit_history
 * - Inserts penalty_log row
 * - Kicks member if action demands it or merit falls below threshold
 *
 * Returns the final merit score.
 */
export async function applyPenalty(
  sb: SupabaseClient,
  params: ApplyPenaltyParams,
): Promise<number> {
  const { cellId, userId, reason, stage, cycle, config } = params
  let { rule } = params

  // Check for prior penalty this cycle — escalate if so
  const { count: priorCount } = await sb
    .from('penalty_log')
    .select('id', { count: 'exact', head: true })
    .eq('cell_id', cellId)
    .eq('user_id', userId)
    .eq('cycle', cycle)

  if ((priorCount ?? 0) > 0) {
    rule = config.penalty_rules.second_offense
  }

  // Load current merit
  const { data: profile } = await sb
    .from('profiles')
    .select('merit_score, merit_history')
    .eq('id', userId)
    .single()

  const currentMerit: number = profile?.merit_score ?? 100
  const newMerit = Math.max(0, currentMerit + rule.merit_delta)
  const historyEntry = { event: reason, delta: rule.merit_delta, ts: new Date().toISOString() }
  const history = Array.isArray(profile?.merit_history) ? profile.merit_history : []

  // Update merit
  await sb
    .from('profiles')
    .update({
      merit_score: newMerit,
      merit_history: [...history, historyEntry],
    })
    .eq('id', userId)

  // Log penalty
  await sb.from('penalty_log').insert({
    cell_id: cellId,
    user_id: userId,
    reason,
    merit_delta: rule.merit_delta,
    stage,
    cycle,
    auto: true,
  })

  // Kick if action requires it or merit crosses threshold
  const shouldKick =
    rule.action === 'kick' ||
    shouldKickForMerit(newMerit, config) ||
    (rule.action === 'warn_then_kick' && (priorCount ?? 0) > 0)

  if (shouldKick) {
    await sb
      .from('cell_members')
      .update({ status: 'KICKED' })
      .eq('cell_id', cellId)
      .eq('user_id', userId)
  } else if (rule.action === 'warn') {
    await sb
      .from('cell_members')
      .update({ status: 'WARNED' })
      .eq('cell_id', cellId)
      .eq('user_id', userId)
      .eq('status', 'ACTIVE') // don't un-warn someone already worse
  }

  await logSystem(sb, 'penalty_applied', {
    cell_id: cellId,
    user_id: userId,
    merit_delta: rule.merit_delta,
    new_merit: newMerit,
    kicked: shouldKick,
  })

  return newMerit
}

// ── Editor election ───────────────────────────────────────────────────────────

/**
 * Elects a new editor from active, non-kicked members.
 * Strips EDITOR role from all current editors first, then assigns to the new one.
 * Returns the elected userId, or null if no eligible candidates.
 */
export async function electNewEditor(
  sb: SupabaseClient,
  cellId: string,
  config: EzineConfig,
  excludeUserId?: string,
): Promise<string | null> {
  // Load eligible candidates
  const { data: members } = await sb
    .from('cell_members')
    .select('user_id, profiles(merit_score)')
    .eq('cell_id', cellId)
    .eq('status', 'ACTIVE')

  const candidates = (members ?? [])
    .filter((m: any) => m.user_id !== excludeUserId)
    .map((m: any) => ({
      userId: m.user_id,
      meritScore: m.profiles?.merit_score ?? 100,
    }))

  if (candidates.length === 0) return null

  const electedId = electEditor(candidates, config.editor_election_method)

  // Clear previous editor and illustrator role assignments
  await sb
    .from('cell_members')
    .update({ role: 'MEMBER' })
    .eq('cell_id', cellId)
    .in('role', ['EDITOR', 'ILLUSTRATOR'])

  // Assign new editor
  await sb
    .from('cell_members')
    .update({ role: 'EDITOR' })
    .eq('cell_id', cellId)
    .eq('user_id', electedId)

  // Elect illustrator if the strategy requires a dedicated one
  if (config.illustrator_required && config.illustrator_dedicated) {
    const illustratorCandidates = candidates.filter((c) => c.userId !== electedId)
    if (illustratorCandidates.length > 0) {
      const illustratorId = electEditor(illustratorCandidates, config.editor_election_method)
      await sb
        .from('cell_members')
        .update({ role: 'ILLUSTRATOR' })
        .eq('cell_id', cellId)
        .eq('user_id', illustratorId)
      await logSystem(sb, 'illustrator_elected', { cell_id: cellId, user_id: illustratorId })
    }
  }

  await logSystem(sb, 'editor_elected', { cell_id: cellId, user_id: electedId })

  // Notify elected editor (non-blocking)
  const { data: cellRow } = await sb.from('cells').select('title, slug, stage_deadline').eq('id', cellId).single()
  if (cellRow) {
    void notifyEditorElectedAuto({
      sb,
      editorId: electedId,
      cellTitle: cellRow.title,
      cellSlug: cellRow.slug,
      deadline: cellRow.stage_deadline,
    })
  }

  return electedId
}

// ── Stage advance ─────────────────────────────────────────────────────────────

/**
 * Transitions a cell to `toStage`, sets the new deadline, and handles
 * stage-specific side-effects:
 *   BRIEFING  → elects editor, sets status=ACTIVE
 *   COMPLETE  → applies merit gains, increments cycle, recurses to BRIEFING
 */
export async function advanceCellStage(
  sb: SupabaseClient,
  cell: {
    id: string
    current_stage: Stage
    current_cycle: number
    min_members: number
    owner_id: string
  },
  toStage: Stage,
  config: EzineConfig,
): Promise<void> {
  const newDeadline = deadlineForStage(toStage, config)

  const updates: Record<string, unknown> = {
    current_stage: toStage,
    stage_deadline: newDeadline,
  }

  if (toStage === 'BRIEFING' && cell.current_stage === 'FORMING') {
    updates.status = 'ACTIVE'
  }

  if (toStage === 'COMPLETE') {
    updates.stage_deadline = null
  }

  await sb.from('cells').update(updates).eq('id', cell.id)

  await logSystem(sb, 'stage_advanced', {
    cell_id: cell.id,
    from_stage: cell.current_stage,
    to_stage: toStage,
  })

  // Stage-specific side effects
  if (toStage === 'BRIEFING') {
    await electNewEditor(sb, cell.id, config)
  }

  if (toStage === 'COMPLETE') {
    await applyCompletionMerit(sb, cell, config)
    if (config.recur_on_completion) {
      await startNewCycle(sb, cell, config)
    }
  }
}

// ── Cycle merit gains ─────────────────────────────────────────────────────────

async function applyCompletionMerit(
  sb: SupabaseClient,
  cell: { id: string; current_cycle: number },
  _config: EzineConfig,
) {
  const cycle = cell.current_cycle

  async function creditMerit(userId: string, event: string, delta: number) {
    const { data: profile } = await sb
      .from('profiles')
      .select('merit_score, merit_history')
      .eq('id', userId)
      .single()

    const current: number = profile?.merit_score ?? 100
    const entry = { event, delta, ts: new Date().toISOString() }

    await sb
      .from('profiles')
      .update({
        merit_score: current + delta,
        merit_history: [...(Array.isArray(profile?.merit_history) ? profile.merit_history : []), entry],
      })
      .eq('id', userId)
  }

  // Cycle completion gains (+15 editor, +3 all active members)
  const { data: members } = await sb
    .from('cell_members')
    .select('user_id, role')
    .eq('cell_id', cell.id)
    .eq('status', 'ACTIVE')

  for (const m of members ?? []) {
    const isEditor = m.role === 'EDITOR'
    await creditMerit(
      m.user_id,
      isEditor ? 'cycle_completed_as_editor' : 'cycle_completed_as_member',
      isEditor ? MERIT_GAINS.cycle_completed_as_editor : MERIT_GAINS.cycle_completed_as_member,
    )
  }

  // Accepted submission gains (+10 per author with an accepted submission)
  const { data: acceptedSubs } = await sb
    .from('submissions')
    .select('author_id')
    .eq('cell_id', cell.id)
    .eq('cycle', cycle)
    .eq('status', 'ACCEPTED')

  for (const sub of acceptedSubs ?? []) {
    await creditMerit(sub.author_id, 'submission_accepted', MERIT_GAINS.submission_accepted)
  }

  // On-time promotion gains (+5 per member who submitted promotion evidence)
  const { data: pub } = await sb
    .from('publications')
    .select('id')
    .eq('cell_id', cell.id)
    .eq('cycle', cycle)
    .maybeSingle()

  if (pub) {
    const { data: promos } = await sb
      .from('promotion_records')
      .select('user_id')
      .eq('publication_id', pub.id)
      .neq('status', 'MISSED')

    for (const promo of promos ?? []) {
      await creditMerit(promo.user_id, 'promotion_on_time', MERIT_GAINS.promotion_on_time)
    }
  }

  await logSystem(sb, 'completion_merit_applied', { cell_id: cell.id, cycle })
}

// ── New cycle ─────────────────────────────────────────────────────────────────

async function startNewCycle(
  sb: SupabaseClient,
  cell: { id: string; current_cycle: number },
  config: EzineConfig,
) {
  const newCycle = cell.current_cycle + 1
  const deadline = deadlineForStage('BRIEFING', config)

  await sb.from('cells').update({
    current_stage: 'BRIEFING',
    current_cycle: newCycle,
    stage_deadline: deadline,
    status: 'ACTIVE',
  }).eq('id', cell.id)

  await electNewEditor(sb, cell.id, config)

  await logSystem(sb, 'new_cycle_started', { cell_id: cell.id, cycle: newCycle })
}
