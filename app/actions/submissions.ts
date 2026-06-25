'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { notifySubmissionAccepted, notifyReworkRequested, notifySubmissionsOpen } from '@/lib/notifications'

export type SubmissionActionState = { error: string | null }

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ── submitArticle ─────────────────────────────────────────────────────────────

const submitSchema = z.object({
  brief_id: z.string().uuid(),
  cell_id: z.string().uuid(),
  title: z.string().max(200, 'Title too long').optional(),
  body: z.string().min(1, 'Article body is required'),
})

export async function submitArticle(
  prevState: SubmissionActionState,
  formData: FormData
): Promise<SubmissionActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const parsed = submitSchema.safeParse({
    brief_id: formData.get('brief_id'),
    cell_id: formData.get('cell_id'),
    title: formData.get('title') || undefined,
    body: formData.get('body'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { brief_id, cell_id, title, body } = parsed.data

  // Verify cell is in SUBMISSION stage
  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, current_stage, current_cycle')
    .eq('id', cell_id)
    .single() as { data: { id: string; slug: string; current_stage: string; current_cycle: number } | null; error: unknown }

  if (!cell) return { error: 'Cell not found.' }
  if (cell.current_stage !== 'SUBMISSION') return { error: 'Submissions are not open.' }

  // Must be an active member
  const { data: membership } = await supabase
    .from('cell_members')
    .select('status')
    .eq('cell_id', cell_id)
    .eq('user_id', user.id)
    .single() as { data: { status: string } | null; error: unknown }

  if (!membership || membership.status !== 'ACTIVE') {
    return { error: 'You are not an active member of this Cell.' }
  }

  // Must have an ACCEPTED invitation for this brief
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, status')
    .eq('brief_id', brief_id)
    .eq('invitee_id', user.id)
    .maybeSingle() as { data: { id: string; status: string } | null; error: unknown }

  if (!invitation) return { error: 'You have not been invited to submit for this brief.' }
  if (invitation.status !== 'ACCEPTED') {
    return { error: 'You must accept the invitation before submitting.' }
  }

  // No duplicate submissions
  const { data: existing } = await supabase
    .from('submissions')
    .select('id, status')
    .eq('brief_id', brief_id)
    .eq('author_id', user.id)
    .maybeSingle() as { data: { id: string; status: string } | null; error: unknown }

  if (existing && ['SUBMITTED', 'ACCEPTED'].includes(existing.status)) {
    return { error: 'You have already submitted for this brief.' }
  }

  // Load brief for word count limits
  const { data: brief } = await supabase
    .from('briefs')
    .select('word_count_min, word_count_max')
    .eq('id', brief_id)
    .single() as { data: { word_count_min: number; word_count_max: number } | null; error: unknown }

  if (!brief) return { error: 'Brief not found.' }

  const words = countWords(body)
  if (words < brief.word_count_min) {
    return { error: `Too short: ${words} words (minimum ${brief.word_count_min}).` }
  }
  if (words > brief.word_count_max) {
    return { error: `Too long: ${words} words (maximum ${brief.word_count_max}).` }
  }

  const { error: insertError } = await supabase.from('submissions').insert({
    brief_id,
    cell_id,
    author_id: user.id,
    title: title ?? null,
    body,
    word_count: words,
    status: 'SUBMITTED',
    submitted_at: new Date().toISOString(),
    cycle: cell.current_cycle,
  })

  if (insertError) return { error: insertError.message }

  redirect(`/cells/${cell.slug}/submit`)
}

// ── resubmitArticle ───────────────────────────────────────────────────────────

const resubmitSchema = z.object({
  submission_id: z.string().uuid(),
  title: z.string().max(200).optional(),
  body: z.string().min(1, 'Article body is required'),
})

export async function resubmitArticle(
  prevState: SubmissionActionState,
  formData: FormData
): Promise<SubmissionActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const parsed = resubmitSchema.safeParse({
    submission_id: formData.get('submission_id'),
    title: formData.get('title') || undefined,
    body: formData.get('body'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { submission_id, title, body } = parsed.data

  const { data: submission } = await supabase
    .from('submissions')
    .select('id, author_id, status, brief_id, cell_id')
    .eq('id', submission_id)
    .single() as { data: { id: string; author_id: string; status: string; brief_id: string; cell_id: string } | null; error: unknown }

  if (!submission) return { error: 'Submission not found.' }
  if (submission.author_id !== user.id) return { error: 'Not your submission.' }
  if (submission.status !== 'REWORK_REQUESTED') {
    return { error: 'This submission is not awaiting rework.' }
  }

  // Cell must be in EDITING
  const { data: cell } = await supabase
    .from('cells')
    .select('current_stage, slug')
    .eq('id', submission.cell_id)
    .single() as { data: { current_stage: string; slug: string } | null; error: unknown }

  if (!cell || cell.current_stage !== 'EDITING') {
    return { error: 'Rework submissions are only accepted during the Editing stage.' }
  }

  const { data: brief } = await supabase
    .from('briefs')
    .select('word_count_min, word_count_max')
    .eq('id', submission.brief_id)
    .single() as { data: { word_count_min: number; word_count_max: number } | null; error: unknown }

  if (!brief) return { error: 'Brief not found.' }

  const words = countWords(body)
  if (words < brief.word_count_min) {
    return { error: `Too short: ${words} words (minimum ${brief.word_count_min}).` }
  }
  if (words > brief.word_count_max) {
    return { error: `Too long: ${words} words (maximum ${brief.word_count_max}).` }
  }

  const { error: updateError } = await supabase
    .from('submissions')
    .update({
      title: title ?? null,
      body,
      word_count: words,
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', submission_id)

  if (updateError) return { error: updateError.message }

  redirect(`/cells/${cell.slug}/edit`)
}

// ── updateSubmissionStatus ────────────────────────────────────────────────────

const reviewSchema = z.object({
  submission_id: z.string().uuid(),
  status: z.enum(['ACCEPTED', 'REJECTED', 'REWORK_REQUESTED']),
  editor_note: z.string().max(1000).optional(),
})

export async function updateSubmissionStatus(
  prevState: SubmissionActionState,
  formData: FormData
): Promise<SubmissionActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const parsed = reviewSchema.safeParse({
    submission_id: formData.get('submission_id'),
    status: formData.get('status'),
    editor_note: formData.get('editor_note') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { submission_id, status, editor_note } = parsed.data

  if ((status === 'REJECTED' || status === 'REWORK_REQUESTED') && !editor_note?.trim()) {
    return { error: 'An editor note is required when rejecting or requesting rework.' }
  }

  const { data: submission } = await supabase
    .from('submissions')
    .select('id, cell_id, author_id, title, status')
    .eq('id', submission_id)
    .single() as { data: { id: string; cell_id: string; author_id: string; title: string | null; status: string } | null; error: unknown }

  if (!submission) return { error: 'Submission not found.' }
  if (!['SUBMITTED'].includes(submission.status)) {
    return { error: 'This submission has already been reviewed.' }
  }

  // Verify editor role in this cell
  const { data: membership } = await supabase
    .from('cell_members')
    .select('role')
    .eq('cell_id', submission.cell_id)
    .eq('user_id', user.id)
    .single() as { data: { role: string } | null; error: unknown }

  if (!membership || membership.role !== 'EDITOR') {
    return { error: 'Only the Editor can review submissions.' }
  }

  // Cell must be in EDITING
  const { data: cell } = await supabase
    .from('cells')
    .select('current_stage, title, slug')
    .eq('id', submission.cell_id)
    .single() as { data: { current_stage: string; title: string; slug: string } | null; error: unknown }

  if (!cell || cell.current_stage !== 'EDITING') {
    return { error: 'Submissions can only be reviewed during the Editing stage.' }
  }

  const { error: updateError } = await supabase
    .from('submissions')
    .update({
      status,
      editor_note: editor_note ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', submission_id)

  if (updateError) return { error: updateError.message }

  if (status === 'ACCEPTED') {
    void notifySubmissionAccepted({
      authorId: submission.author_id,
      cellTitle: cell.title,
      cellSlug: cell.slug,
      articleTitle: submission.title,
    })
  } else if (status === 'REWORK_REQUESTED') {
    void notifyReworkRequested({
      authorId: submission.author_id,
      cellTitle: cell.title,
      cellSlug: cell.slug,
      editorNote: editor_note ?? '',
    })
  }

  redirect(`/cells/${cell.slug}/edit`)
}

// ── advanceToEditing ──────────────────────────────────────────────────────────

export async function advanceToEditing(
  prevState: SubmissionActionState,
  formData: FormData
): Promise<SubmissionActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const cellId = formData.get('cell_id') as string
  if (!cellId) return { error: 'Invalid request.' }

  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title, current_stage, current_cycle, owner_id, strategy_config')
    .eq('id', cellId)
    .single() as { data: { id: string; slug: string; title: string; current_stage: string; current_cycle: number; owner_id: string; strategy_config: { editing_window_days: number } } | null; error: unknown }

  if (!cell) return { error: 'Cell not found.' }
  if (cell.current_stage !== 'SUBMISSION') return { error: 'Cell is not in the Submission stage.' }

  const { data: membership } = await supabase
    .from('cell_members')
    .select('role')
    .eq('cell_id', cellId)
    .eq('user_id', user.id)
    .single() as { data: { role: string } | null; error: unknown }

  if (membership?.role !== 'EDITOR') {
    return { error: 'Unauthorised.' }
  }

  // Require at least one submission before allowing early close
  const { data: currentBrief } = await supabase
    .from('briefs')
    .select('id')
    .eq('cell_id', cellId)
    .eq('cycle', cell.current_cycle)
    .maybeSingle() as { data: { id: string } | null; error: unknown }

  if (currentBrief) {
    const { count: subCount } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('brief_id', currentBrief.id)
      .in('status', ['SUBMITTED', 'ACCEPTED', 'REWORK_REQUESTED'])
    if ((subCount ?? 0) === 0) {
      return { error: 'No submissions received yet. Submissions will close automatically at the deadline.' }
    }
  }

  const deadline = new Date(
    Date.now() + cell.strategy_config.editing_window_days * 864e5
  ).toISOString()

  await supabase
    .from('cells')
    .update({ current_stage: 'EDITING', stage_deadline: deadline })
    .eq('id', cellId)

  const editorQuery = supabase
    .from('cell_members')
    .select('user_id')
    .eq('cell_id', cellId)
    .eq('role', 'EDITOR')
    .single() as unknown as Promise<{ data: { user_id: string } | null; error: unknown }>
  const { data: editorMember } = await editorQuery

  if (editorMember) {
    void notifySubmissionsOpen({
      editorId: editorMember.user_id,
      cellTitle: cell.title,
      cellSlug: cell.slug,
      deadline,
    })
  }

  redirect(`/cells/${cell.slug}/edit`)
}
