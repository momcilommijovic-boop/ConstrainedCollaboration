'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { applyCycleCompletionMerit } from '@/lib/merit'
import { notifyCycleComplete } from '@/lib/notifications'

export type PromotionActionState = { error: string | null }

const submitEvidenceSchema = z.object({
  publication_id: z.string().uuid(),
  evidence_url: z.string().url('Must be a valid URL').max(500, 'URL too long'),
})

export async function submitPromotionEvidence(
  prevState: PromotionActionState,
  formData: FormData
): Promise<PromotionActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const parsed = submitEvidenceSchema.safeParse({
    publication_id: formData.get('publication_id'),
    evidence_url: formData.get('evidence_url'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { publication_id, evidence_url } = parsed.data

  const { data: publication } = await supabase
    .from('publications')
    .select('id, cell_id')
    .eq('id', publication_id)
    .single() as { data: { id: string; cell_id: string } | null; error: unknown }

  if (!publication) return { error: 'Publication not found.' }

  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, current_stage')
    .eq('id', publication.cell_id)
    .single() as { data: { id: string; slug: string; current_stage: string } | null; error: unknown }

  if (!cell || cell.current_stage !== 'PROMOTION') {
    return { error: 'Promotion is not currently active for this Cell.' }
  }

  const { data: membership } = await supabase
    .from('cell_members')
    .select('status')
    .eq('cell_id', publication.cell_id)
    .eq('user_id', user.id)
    .single() as { data: { status: string } | null; error: unknown }

  if (!membership || membership.status !== 'ACTIVE') {
    return { error: 'You are not an active member of this Cell.' }
  }

  const { data: existing } = await supabase
    .from('promotion_records')
    .select('id')
    .eq('publication_id', publication_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return { error: 'You have already submitted promotion evidence.' }

  const { error: insertError } = await supabase.from('promotion_records').insert({
    publication_id,
    user_id: user.id,
    evidence_url,
    submitted_at: new Date().toISOString(),
    status: 'PENDING',
  })

  if (insertError) return { error: insertError.message }

  redirect(`/cells/${cell.slug}/promote`)
}

export async function advanceToComplete(
  prevState: PromotionActionState,
  formData: FormData
): Promise<PromotionActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const cellId = formData.get('cell_id') as string
  if (!cellId) return { error: 'Invalid request.' }

  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title, current_stage, owner_id, current_cycle')
    .eq('id', cellId)
    .single() as { data: { id: string; slug: string; title: string; current_stage: string; owner_id: string; current_cycle: number } | null; error: unknown }

  if (!cell) return { error: 'Cell not found.' }
  if (cell.current_stage !== 'PROMOTION') return { error: 'Cell is not in the Promotion stage.' }
  if (cell.owner_id !== user.id) return { error: 'Only the Cell owner can close Promotion.' }

  await supabase
    .from('cells')
    .update({ current_stage: 'COMPLETE', stage_deadline: null })
    .eq('id', cellId)

  await applyCycleCompletionMerit(supabase, cellId, cell.current_cycle)

  const membersQuery = supabase
    .from('cell_members')
    .select('user_id')
    .eq('cell_id', cellId)
    .eq('status', 'ACTIVE') as unknown as Promise<{ data: { user_id: string }[] | null; error: unknown }>
  const { data: activeMembers } = await membersQuery
  const memberIds = (activeMembers ?? []).map((m) => m.user_id)

  void notifyCycleComplete({
    memberIds,
    cellTitle: cell.title,
    cellSlug: cell.slug,
    cycle: cell.current_cycle,
  })

  redirect(`/cells/${cell.slug}`)
}
