import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type MeritHistoryEntry = {
  event: string
  delta: number
  cell_id?: string
  cycle?: number
  ts: string
}

async function applyDelta(
  supabase: SupabaseClient<Database>,
  userId: string,
  delta: number,
  entries: MeritHistoryEntry[]
): Promise<void> {
  if (delta === 0) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('merit_score, merit_history')
    .eq('id', userId)
    .single() as { data: { merit_score: number; merit_history: unknown } | null; error: unknown }

  if (!profile) return

  const current = profile.merit_score ?? 100
  const newScore = Math.max(0, current + delta)
  const history = Array.isArray(profile.merit_history) ? profile.merit_history : []
  const newHistory = [...history, ...entries]

  await supabase
    .from('profiles')
    .update({
      merit_score: newScore,
      merit_history: newHistory as unknown as import('@/lib/supabase/types').Json,
    })
    .eq('id', userId)
}

// Called when a cell advances to COMPLETE.
// Awards: +3 all members, +10 accepted authors, +5 on-time promoters, +15 editor.
export async function applyCycleCompletionMerit(
  supabase: SupabaseClient<Database>,
  cellId: string,
  cycle: number
): Promise<void> {
  const ts = new Date().toISOString()
  const ctx = { cell_id: cellId, cycle, ts }

  // Gather who gets what
  const [membersResult, subsResult, editorResult, publicationResult] = await Promise.all([
    supabase
      .from('cell_members')
      .select('user_id')
      .eq('cell_id', cellId)
      .eq('status', 'ACTIVE') as unknown as Promise<{
      data: { user_id: string }[] | null
      error: unknown
    }>,
    supabase
      .from('submissions')
      .select('author_id')
      .eq('cell_id', cellId)
      .eq('cycle', cycle)
      .eq('status', 'ACCEPTED') as unknown as Promise<{
      data: { author_id: string }[] | null
      error: unknown
    }>,
    supabase
      .from('cell_members')
      .select('user_id')
      .eq('cell_id', cellId)
      .eq('role', 'EDITOR')
      .eq('status', 'ACTIVE')
      .maybeSingle() as unknown as Promise<{ data: { user_id: string } | null; error: unknown }>,
    supabase
      .from('publications')
      .select('id, assembled_by')
      .eq('cell_id', cellId)
      .eq('cycle', cycle)
      .maybeSingle() as unknown as Promise<{
      data: { id: string; assembled_by: string } | null
      error: unknown
    }>,
  ])

  const members = membersResult.data ?? []
  const acceptedAuthors = new Set((subsResult.data ?? []).map((s) => s.author_id))
  const editorId = editorResult.data?.user_id ?? publicationResult.data?.assembled_by

  // Who submitted promotion evidence
  const promoters = new Set<string>()
  if (publicationResult.data) {
    const promoQuery = supabase
      .from('promotion_records')
      .select('user_id')
      .eq('publication_id', publicationResult.data.id)
      .neq('status', 'MISSED') as unknown as Promise<{
      data: { user_id: string }[] | null
      error: unknown
    }>
    const { data: promoRecords } = await promoQuery
    for (const r of promoRecords ?? []) promoters.add(r.user_id)
  }

  await Promise.all(
    members.map(async (m) => {
      const entries: MeritHistoryEntry[] = []
      let total = 0

      entries.push({ event: 'cycle_complete', delta: 3, ...ctx })
      total += 3

      if (acceptedAuthors.has(m.user_id)) {
        entries.push({ event: 'submission_accepted', delta: 10, ...ctx })
        total += 10
      }

      if (promoters.has(m.user_id)) {
        entries.push({ event: 'promotion_submitted', delta: 5, ...ctx })
        total += 5
      }

      if (m.user_id === editorId) {
        entries.push({ event: 'editor_completed', delta: 15, ...ctx })
        total += 15
      }

      await applyDelta(supabase, m.user_id, total, entries)
    })
  )
}

// Called by the Edge Function / automated penalty system.
export async function applyPenaltyMerit(
  supabase: SupabaseClient<Database>,
  userId: string,
  delta: number,
  event: string,
  cellId: string,
  cycle: number
): Promise<void> {
  const entries: MeritHistoryEntry[] = [
    { event, delta, cell_id: cellId, cycle, ts: new Date().toISOString() },
  ]
  await applyDelta(supabase, userId, delta, entries)
}

export const MERIT_EVENT_LABELS: Record<string, string> = {
  cycle_complete: 'Cycle completed',
  submission_accepted: 'Submission accepted',
  promotion_submitted: 'Promotion submitted',
  editor_completed: 'Completed as Editor',
  missed_brief: 'Missed brief deadline',
  missed_submission: 'Missed submission deadline',
  missed_promotion: 'Missed promotion deadline',
  second_offense: 'Second offense',
}
