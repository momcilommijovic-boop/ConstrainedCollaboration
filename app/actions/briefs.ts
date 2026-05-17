'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { EzineStrategyConfig } from '@/lib/strategies/ezine'
import { notifyWritersInvited } from '@/lib/notifications'

export type BriefActionState = { error: string | null }

const publishBriefSchema = z.object({
  cell_id: z.string().uuid(),
  title: z.string().min(3, 'Title must be at least 3 characters').max(120, 'Title too long'),
  theme: z.string().min(10, 'Theme must be at least 10 characters').max(300, 'Theme too long'),
  guidance: z.string().min(20, 'Guidance must be at least 20 characters').max(3000, 'Guidance too long'),
  slots: z.coerce.number().int().min(1, 'At least 1 slot required').max(20, 'Maximum 20 slots'),
  invitee_ids: z.array(z.string().uuid()).min(1, 'Must invite at least one member'),
})

export async function publishBrief(
  prevState: BriefActionState,
  formData: FormData
): Promise<BriefActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const inviteeIds = formData.getAll('invitee_ids') as string[]

  const parsed = publishBriefSchema.safeParse({
    cell_id: formData.get('cell_id'),
    title: formData.get('title'),
    theme: formData.get('theme'),
    guidance: formData.get('guidance'),
    slots: formData.get('slots'),
    invitee_ids: inviteeIds,
  })

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { cell_id, title, theme, guidance, slots, invitee_ids } = parsed.data

  type CellRow = {
    id: string
    slug: string
    title: string
    current_stage: string
    strategy_config: EzineStrategyConfig
    current_cycle: number
  }
  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title, current_stage, strategy_config, current_cycle')
    .eq('id', cell_id)
    .single() as { data: CellRow | null; error: unknown }

  if (!cell) return { error: 'Cell not found.' }
  if (cell.current_stage !== 'BRIEFING') return { error: 'Cell is not in the Briefing stage.' }

  const { data: membership } = await supabase
    .from('cell_members')
    .select('role')
    .eq('cell_id', cell_id)
    .eq('user_id', user.id)
    .single() as { data: { role: string } | null; error: unknown }

  if (!membership || membership.role !== 'EDITOR') {
    return { error: 'Only the elected Editor can publish a Brief.' }
  }

  const config = cell.strategy_config

  if (invitee_ids.length < config.min_submissions_required) {
    return {
      error: `Must invite at least ${config.min_submissions_required} members (minimum submissions required).`,
    }
  }
  if (slots < config.min_submissions_required) {
    return { error: `Slots must be at least ${config.min_submissions_required}.` }
  }

  const deadline = new Date(Date.now() + config.submission_window_days * 864e5).toISOString()

  const { data: brief, error: briefError } = await supabase
    .from('briefs')
    .insert({
      cell_id,
      cycle: cell.current_cycle,
      editor_id: user.id,
      title,
      theme,
      guidance,
      word_count_min: config.word_count_min,
      word_count_max: config.word_count_max,
      slots,
      deadline,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: unknown }

  if (briefError || !brief) return { error: 'Failed to create brief.' }

  const invitations = invitee_ids.map((invitee_id) => ({
    brief_id: brief.id,
    cell_id,
    invitee_id,
    status: 'PENDING',
  }))

  const { error: inviteError } = await supabase.from('invitations').insert(invitations)
  if (inviteError) return { error: 'Failed to create invitations.' }

  await supabase
    .from('cells')
    .update({ current_stage: 'SUBMISSION', stage_deadline: deadline })
    .eq('id', cell_id)

  const { data: editorProfile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', user.id)
    .single() as { data: { display_name: string | null; username: string } | null; error: unknown }

  void notifyWritersInvited({
    inviteeIds: invitee_ids,
    editorName: editorProfile?.display_name ?? editorProfile?.username ?? 'Editor',
    cellTitle: cell.title,
    cellSlug: cell.slug,
    briefTitle: title,
    deadline,
  })

  redirect(`/cells/${cell.slug}/brief`)
}

export async function inviteMember(
  prevState: BriefActionState,
  formData: FormData
): Promise<BriefActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const briefId = formData.get('brief_id') as string
  const inviteeId = formData.get('invitee_id') as string
  if (!briefId || !inviteeId) return { error: 'Invalid request.' }

  const { data: brief } = await supabase
    .from('briefs')
    .select('id, cell_id, slots')
    .eq('id', briefId)
    .single() as { data: { id: string; cell_id: string; slots: number } | null; error: unknown }

  if (!brief) return { error: 'Brief not found.' }

  const { data: membership } = await supabase
    .from('cell_members')
    .select('role')
    .eq('cell_id', brief.cell_id)
    .eq('user_id', user.id)
    .single() as { data: { role: string } | null; error: unknown }

  if (!membership || membership.role !== 'EDITOR') {
    return { error: 'Only the Editor can send additional invitations.' }
  }

  const { data: cell } = await supabase
    .from('cells')
    .select('current_stage')
    .eq('id', brief.cell_id)
    .single() as { data: { current_stage: string } | null; error: unknown }

  if (!cell || cell.current_stage !== 'SUBMISSION') {
    return { error: 'Invitations can only be sent during the Submission stage.' }
  }

  const { count: existingCount } = await supabase
    .from('invitations')
    .select('id', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .neq('status', 'DECLINED')

  if ((existingCount ?? 0) >= brief.slots) return { error: 'All slots are filled.' }

  const { data: existing } = await supabase
    .from('invitations')
    .select('id')
    .eq('brief_id', briefId)
    .eq('invitee_id', inviteeId)
    .maybeSingle()

  if (existing) return { error: 'This member has already been invited.' }

  const { error: inviteError } = await supabase.from('invitations').insert({
    brief_id: briefId,
    cell_id: brief.cell_id,
    invitee_id: inviteeId,
    status: 'PENDING',
  })

  if (inviteError) return { error: inviteError.message }
  return { error: null }
}

export async function respondToInvitation(
  prevState: BriefActionState,
  formData: FormData
): Promise<BriefActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const invitationId = formData.get('invitation_id') as string
  const response = formData.get('response') as string
  if (!invitationId || !['ACCEPTED', 'DECLINED'].includes(response)) {
    return { error: 'Invalid request.' }
  }

  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, invitee_id, status, cell_id')
    .eq('id', invitationId)
    .single() as { data: { id: string; invitee_id: string; status: string; cell_id: string } | null; error: unknown }

  if (!invitation) return { error: 'Invitation not found.' }
  if (invitation.invitee_id !== user.id) return { error: 'Not your invitation.' }
  if (invitation.status !== 'PENDING') return { error: 'This invitation has already been responded to.' }

  const { error: updateError } = await supabase
    .from('invitations')
    .update({ status: response, responded_at: new Date().toISOString() })
    .eq('id', invitationId)

  if (updateError) return { error: updateError.message }

  if (response === 'ACCEPTED') {
    // Promote member role to WRITER so they can access the submission flow
    await supabase
      .from('cell_members')
      .update({ role: 'WRITER' })
      .eq('cell_id', invitation.cell_id)
      .eq('user_id', user.id)

    const { data: cell } = await supabase
      .from('cells')
      .select('slug')
      .eq('id', invitation.cell_id)
      .single() as { data: { slug: string } | null; error: unknown }

    if (cell) redirect(`/cells/${cell.slug}/submit`)
  }

  return { error: null }
}
