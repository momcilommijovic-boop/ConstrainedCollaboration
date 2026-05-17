'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notifyPublicationPublished } from '@/lib/notifications'

export type PublicationActionState = { error: string | null }

export async function publishPublication(
  prevState: PublicationActionState,
  formData: FormData
): Promise<PublicationActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const cellId = formData.get('cell_id') as string
  const briefId = formData.get('brief_id') as string
  const coverImageUrl = (formData.get('cover_image_url') as string)?.trim() || null
  const submissionIds = formData.getAll('submission_ids') as string[]
  const orderValues = formData.getAll('order').map((v) => parseInt(v as string, 10))

  if (!cellId || !briefId) return { error: 'Invalid request.' }
  if (submissionIds.length === 0) return { error: 'No articles selected for publication.' }

  const orderedIds = submissionIds
    .map((id, i) => ({ id, order: isNaN(orderValues[i]) ? i + 1 : orderValues[i] }))
    .sort((a, b) => a.order - b.order)
    .map((item) => item.id)

  type CellRow = {
    id: string
    slug: string
    title: string
    current_stage: string
    current_cycle: number
    strategy_config: { promotion_window_days: number }
  }
  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title, current_stage, current_cycle, strategy_config')
    .eq('id', cellId)
    .single() as { data: CellRow | null; error: unknown }

  if (!cell) return { error: 'Cell not found.' }
  if (cell.current_stage !== 'EDITING') return { error: 'Cell is not in the Editing stage.' }

  const { data: membership } = await supabase
    .from('cell_members')
    .select('role')
    .eq('cell_id', cellId)
    .eq('user_id', user.id)
    .single() as { data: { role: string } | null; error: unknown }

  if (!membership || membership.role !== 'EDITOR') {
    return { error: 'Only the Editor can publish the issue.' }
  }

  // Verify all selected IDs are ACCEPTED submissions for this brief
  const { data: acceptedSubs } = await supabase
    .from('submissions')
    .select('id')
    .eq('brief_id', briefId)
    .eq('status', 'ACCEPTED') as { data: { id: string }[] | null; error: unknown }

  const acceptedIdSet = new Set((acceptedSubs ?? []).map((s) => s.id))
  const invalid = orderedIds.filter((id) => !acceptedIdSet.has(id))
  if (invalid.length > 0) return { error: 'Some selected articles have not been accepted.' }

  // Check no publication already exists for this cycle
  const { data: existing } = await supabase
    .from('publications')
    .select('id')
    .eq('cell_id', cellId)
    .eq('cycle', cell.current_cycle)
    .maybeSingle() as { data: { id: string } | null; error: unknown }

  if (existing) return { error: 'A publication already exists for this cycle.' }

  const now = new Date()
  const promotionDeadline = new Date(
    now.getTime() + cell.strategy_config.promotion_window_days * 864e5
  ).toISOString()

  const insertPayload = {
    cell_id: cellId,
    cycle: cell.current_cycle,
    brief_id: briefId,
    cover_image_url: coverImageUrl,
    selected_submission_ids: orderedIds,
    assembled_by: user.id,
    published_at: now.toISOString(),
    promotion_deadline: promotionDeadline,
    status: 'PUBLISHED',
  }
  const { error: pubError } = await (supabase.from('publications').insert(insertPayload as never) as unknown as Promise<{ error: { message: string } | null }>)

  if (pubError) return { error: pubError.message }

  await supabase
    .from('cells')
    .update({ current_stage: 'PROMOTION', stage_deadline: promotionDeadline })
    .eq('id', cellId)

  const membersQuery = supabase
    .from('cell_members')
    .select('user_id')
    .eq('cell_id', cellId)
    .eq('status', 'ACTIVE') as unknown as Promise<{ data: { user_id: string }[] | null; error: unknown }>
  const { data: activeMembers } = await membersQuery
  const memberIds = (activeMembers ?? []).map((m) => m.user_id)

  void notifyPublicationPublished({
    memberIds,
    cellTitle: cell.title,
    cellSlug: cell.slug,
    cycle: cell.current_cycle,
    promotionDeadline,
  })

  redirect(`/cells/${cell.slug}/promote`)
}
