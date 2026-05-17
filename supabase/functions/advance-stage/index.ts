// advance-stage — manually advance a cell to its next stage.
// Called by admins or as a fallback; process-deadlines handles automatic transitions.
//
// POST body: { cell_id: string, to_stage?: string }

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getNextStage } from '../_shared/ezine.ts'
import { advanceCellStage, logSystem } from '../_shared/operations.ts'
import type { EzineConfig, Stage } from '../_shared/ezine.ts'

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

  let body: { cell_id?: string; to_stage?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { cell_id, to_stage } = body
  if (!cell_id) {
    return new Response(JSON.stringify({ error: 'cell_id is required' }), { status: 400 })
  }

  // Load cell
  const { data: cell, error: cellError } = await supabase
    .from('cells')
    .select('*')
    .eq('id', cell_id)
    .single()

  if (cellError || !cell) {
    return new Response(JSON.stringify({ error: 'Cell not found' }), { status: 404 })
  }

  const config = cell.strategy_config as EzineConfig
  const currentStage = cell.current_stage as Stage

  const targetStage: Stage = (to_stage as Stage | undefined) ??
    getNextStage(currentStage, config.recur_on_completion)

  if (targetStage === currentStage) {
    return new Response(JSON.stringify({ error: 'Cell is already at this stage' }), { status: 400 })
  }

  try {
    await advanceCellStage(supabase, cell, targetStage, config)
    return new Response(
      JSON.stringify({ ok: true, cell_id, from: currentStage, to: targetStage }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logSystem(supabase, 'advance_stage_error', { cell_id }, msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
