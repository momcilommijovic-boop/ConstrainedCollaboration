// apply-penalty — applies a merit penalty to a user within a cell.
// Called by process-deadlines (inline) and available as a standalone endpoint
// for other automated triggers.
//
// POST body: {
//   cell_id, user_id, reason, merit_delta (negative int),
//   stage, cycle, action?: 'warn'|'kick'
// }

import { createClient } from 'npm:@supabase/supabase-js@2'
import { applyPenalty, logSystem } from '../_shared/operations.ts'
import type { PenaltyRule, Stage, EzineConfig } from '../_shared/ezine.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

Deno.serve(async (req: Request) => {
  const auth = req.headers.get('Authorization') ?? ''
  if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: {
    cell_id?: string
    user_id?: string
    reason?: string
    merit_delta?: number
    stage?: string
    cycle?: number
    action?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { cell_id, user_id, reason, merit_delta, stage, cycle, action } = body

  if (!cell_id || !user_id || !reason || merit_delta === undefined || !stage || !cycle) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
  }

  if (merit_delta > 0) {
    return new Response(JSON.stringify({ error: 'merit_delta must be negative' }), { status: 400 })
  }

  // Load cell to get config
  const { data: cell } = await supabase
    .from('cells')
    .select('strategy_config')
    .eq('id', cell_id)
    .single()

  if (!cell) {
    return new Response(JSON.stringify({ error: 'Cell not found' }), { status: 404 })
  }

  const config = cell.strategy_config as EzineConfig
  const rule: PenaltyRule = {
    action: (action as PenaltyRule['action']) ?? 'warn',
    merit_delta,
  }

  try {
    const newMerit = await applyPenalty(supabase, {
      cellId: cell_id,
      userId: user_id,
      reason,
      rule,
      stage: stage as Stage,
      cycle,
      config,
    })

    return new Response(
      JSON.stringify({ ok: true, user_id, new_merit: newMerit }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logSystem(supabase, 'apply_penalty_error', { cell_id, user_id }, msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
