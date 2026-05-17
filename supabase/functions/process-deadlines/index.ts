// process-deadlines — runs every 30 minutes via pg_cron.
// Finds all cells with an expired stage_deadline and drives the state machine forward.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getDeadlinePenalty, deadlineForStage } from '../_shared/ezine.ts'
import {
  applyPenalty,
  advanceCellStage,
  electNewEditor,
  logSystem,
} from '../_shared/operations.ts'
import type { EzineConfig, Stage } from '../_shared/ezine.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

function requireServiceRole(req: Request): boolean {
  const auth = req.headers.get('Authorization') ?? ''
  return auth === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
}

Deno.serve(async (req: Request) => {
  if (!requireServiceRole(req)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const results: Array<{ cell_id: string; action: string; error?: string }> = []

  // Find all cells with an expired deadline
  const { data: expiredCells, error: queryError } = await supabase
    .from('cells')
    .select('*')
    .lt('stage_deadline', new Date().toISOString())
    .in('status', ['FORMING', 'ACTIVE'])

  if (queryError) {
    await logSystem(supabase, 'process_deadlines_query_error', {}, queryError.message)
    return new Response(JSON.stringify({ error: queryError.message }), { status: 500 })
  }

  for (const cell of expiredCells ?? []) {
    try {
      const config = cell.strategy_config as EzineConfig
      const stage = cell.current_stage as Stage

      switch (stage) {
        case 'FORMING':
          await handleFormingTimeout(cell, config)
          results.push({ cell_id: cell.id, action: 'forming_timeout' })
          break

        case 'BRIEFING':
          await handleBriefingTimeout(cell, config)
          results.push({ cell_id: cell.id, action: 'briefing_timeout' })
          break

        case 'SUBMISSION':
          await handleSubmissionTimeout(cell, config)
          results.push({ cell_id: cell.id, action: 'submission_timeout' })
          break

        case 'EDITING':
          await handleEditingTimeout(cell, config)
          results.push({ cell_id: cell.id, action: 'editing_timeout' })
          break

        case 'PROMOTION':
          await handlePromotionTimeout(cell, config)
          results.push({ cell_id: cell.id, action: 'promotion_timeout' })
          break

        default:
          break
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await logSystem(supabase, 'process_deadlines_cell_error', { cell_id: cell.id }, msg)
      results.push({ cell_id: cell.id, action: 'error', error: msg })
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── Stage handlers ────────────────────────────────────────────────────────────

async function handleFormingTimeout(cell: Record<string, unknown>, config: EzineConfig) {
  const { count } = await supabase
    .from('cell_members')
    .select('id', { count: 'exact', head: true })
    .eq('cell_id', cell.id as string)
    .eq('status', 'ACTIVE')

  if ((count ?? 0) < (cell.min_members as number)) {
    // Not enough members — abandon
    await supabase.from('cells').update({ status: 'ABANDONED' }).eq('id', cell.id as string)
    await logSystem(supabase, 'cell_abandoned_forming', { cell_id: cell.id as string })
  } else {
    // Enough members — advance to BRIEFING
    await advanceCellStage(supabase, cell as never, 'BRIEFING', config)
  }
}

async function handleBriefingTimeout(cell: Record<string, unknown>, config: EzineConfig) {
  // Find the current editor
  const { data: editorRow } = await supabase
    .from('cell_members')
    .select('user_id')
    .eq('cell_id', cell.id as string)
    .eq('role', 'EDITOR')
    .eq('status', 'ACTIVE')
    .maybeSingle()

  let excludeUserId: string | undefined

  if (editorRow) {
    const newMerit = await applyPenalty(supabase, {
      cellId: cell.id as string,
      userId: editorRow.user_id as string,
      reason: 'Missed brief publication deadline',
      rule: config.penalty_rules.missed_brief,
      stage: 'BRIEFING',
      cycle: cell.current_cycle as number,
      config,
    })

    // If editor was kicked (merit check already done in applyPenalty),
    // exclude them from the new election
    if (newMerit <= config.penalty_rules.merit_kick_threshold) {
      excludeUserId = editorRow.user_id as string
    }
  }

  // Elect a new editor and reset the briefing deadline (stay in BRIEFING)
  await electNewEditor(supabase, cell.id as string, config, excludeUserId)

  const newDeadline = deadlineForStage('BRIEFING', config)
  await supabase
    .from('cells')
    .update({ stage_deadline: newDeadline })
    .eq('id', cell.id as string)

  await logSystem(supabase, 'briefing_timeout_reset', { cell_id: cell.id as string })
}

async function handleSubmissionTimeout(cell: Record<string, unknown>, config: EzineConfig) {
  const cellId = cell.id as string
  const cycle = cell.current_cycle as number

  // Find the current brief for this cycle
  const { data: brief } = await supabase
    .from('briefs')
    .select('id')
    .eq('cell_id', cellId)
    .eq('cycle', cycle)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (brief) {
    // Penalise invited writers who didn't submit
    const { data: invited } = await supabase
      .from('invitations')
      .select('invitee_id')
      .eq('brief_id', brief.id as string)
      .in('status', ['ACCEPTED', 'PENDING'])

    const { data: submitted } = await supabase
      .from('submissions')
      .select('author_id')
      .eq('brief_id', brief.id as string)
      .in('status', ['SUBMITTED', 'ACCEPTED'])

    const submittedIds = new Set((submitted ?? []).map((s: Record<string, unknown>) => s.author_id))
    const penalty = getDeadlinePenalty('SUBMISSION', config)!

    for (const inv of invited ?? []) {
      if (!submittedIds.has(inv.invitee_id as string)) {
        await applyPenalty(supabase, {
          cellId,
          userId: inv.invitee_id as string,
          reason: penalty.reason,
          rule: penalty.rule,
          stage: 'SUBMISSION',
          cycle,
          config,
        })
      }
    }

    // Flag cell if too few submissions
    if (submittedIds.size < config.min_submissions_required) {
      await logSystem(supabase, 'insufficient_submissions', {
        cell_id: cellId,
        cycle,
        submitted: submittedIds.size,
        required: config.min_submissions_required,
      })
    }
  }

  await advanceCellStage(supabase, cell as never, 'EDITING', config)
}

async function handleEditingTimeout(cell: Record<string, unknown>, config: EzineConfig) {
  const cellId = cell.id as string
  const cycle = cell.current_cycle as number

  // Check if a publication already exists and was published
  const { data: pub } = await supabase
    .from('publications')
    .select('id, status')
    .eq('cell_id', cellId)
    .eq('cycle', cycle)
    .maybeSingle()

  if (pub && pub.status === 'PUBLISHED') {
    // Editor published — advance to PROMOTION
    await advanceCellStage(supabase, cell as never, 'PROMOTION', config)
    return
  }

  // Editor missed the editing deadline
  const { data: editorRow } = await supabase
    .from('cell_members')
    .select('user_id')
    .eq('cell_id', cellId)
    .eq('role', 'EDITOR')
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (editorRow) {
    await applyPenalty(supabase, {
      cellId,
      userId: editorRow.user_id as string,
      reason: 'Missed publication deadline',
      rule: config.penalty_rules.missed_brief,
      stage: 'EDITING',
      cycle,
      config,
    })
  }

  // Abandon this cycle
  await logSystem(supabase, 'editing_timeout_cycle_abandoned', { cell_id: cellId, cycle })

  if (config.recur_on_completion) {
    // Start a fresh cycle
    const newCycle = cycle + 1
    const deadline = deadlineForStage('BRIEFING', config)
    await supabase.from('cells').update({
      current_stage: 'BRIEFING',
      current_cycle: newCycle,
      stage_deadline: deadline,
      status: 'ACTIVE',
    }).eq('id', cellId)
    await electNewEditor(supabase, cellId, config, editorRow?.user_id as string | undefined)
  } else {
    await supabase.from('cells').update({ status: 'ABANDONED' }).eq('id', cellId)
  }
}

async function handlePromotionTimeout(cell: Record<string, unknown>, config: EzineConfig) {
  const cellId = cell.id as string
  const cycle = cell.current_cycle as number

  // Find the publication for this cycle
  const { data: pub } = await supabase
    .from('publications')
    .select('id')
    .eq('cell_id', cellId)
    .eq('cycle', cycle)
    .maybeSingle()

  if (pub) {
    // Find members who didn't submit evidence
    const { data: activeMembers } = await supabase
      .from('cell_members')
      .select('user_id')
      .eq('cell_id', cellId)
      .eq('status', 'ACTIVE')

    const { data: evidence } = await supabase
      .from('promotion_records')
      .select('user_id')
      .eq('publication_id', pub.id as string)
      .in('status', ['PENDING', 'VERIFIED'])

    const submittedIds = new Set((evidence ?? []).map((e: Record<string, unknown>) => e.user_id))
    const penalty = getDeadlinePenalty('PROMOTION', config)!

    for (const m of activeMembers ?? []) {
      if (!submittedIds.has(m.user_id as string)) {
        // Mark as MISSED
        await supabase.from('promotion_records').upsert({
          publication_id: pub.id as string,
          user_id: m.user_id as string,
          status: 'MISSED',
        }, { onConflict: 'publication_id,user_id' })

        await applyPenalty(supabase, {
          cellId,
          userId: m.user_id as string,
          reason: penalty.reason,
          rule: penalty.rule,
          stage: 'PROMOTION',
          cycle,
          config,
        })
      } else {
        // Mark on-time promoters with +5 merit
        const { data: profile } = await supabase
          .from('profiles')
          .select('merit_score, merit_history')
          .eq('id', m.user_id as string)
          .single()
        const score = (profile?.merit_score ?? 100) + 5
        const entry = { event: 'promotion_on_time', delta: 5, ts: new Date().toISOString() }
        await supabase.from('profiles').update({
          merit_score: score,
          merit_history: [...(Array.isArray(profile?.merit_history) ? profile.merit_history : []), entry],
        }).eq('id', m.user_id as string)
      }
    }
  }

  await advanceCellStage(supabase, cell as never, 'COMPLETE', config)
}
