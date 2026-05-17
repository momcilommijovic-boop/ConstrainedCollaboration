// elect-editor — standalone HTTP endpoint for triggering an editor election.
// The core election logic lives in _shared/operations.ts (electNewEditor).
// Step 6 wires this up fully; for now it delegates to the shared helper.
//
// POST body: { cell_id: string, exclude_user_id?: string }

import { createClient } from 'npm:@supabase/supabase-js@2'
import { electNewEditor, logSystem } from '../_shared/operations.ts'
import type { EzineConfig } from '../_shared/ezine.ts'

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

  let body: { cell_id?: string; exclude_user_id?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { cell_id, exclude_user_id } = body
  if (!cell_id) {
    return new Response(JSON.stringify({ error: 'cell_id is required' }), { status: 400 })
  }

  const { data: cell } = await supabase
    .from('cells')
    .select('strategy_config')
    .eq('id', cell_id)
    .single()

  if (!cell) {
    return new Response(JSON.stringify({ error: 'Cell not found' }), { status: 404 })
  }

  try {
    const electedId = await electNewEditor(
      supabase,
      cell_id,
      cell.strategy_config as EzineConfig,
      exclude_user_id,
    )

    if (!electedId) {
      return new Response(JSON.stringify({ error: 'No eligible candidates' }), { status: 422 })
    }

    return new Response(
      JSON.stringify({ ok: true, elected_user_id: electedId }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logSystem(supabase, 'elect_editor_error', { cell_id }, msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
