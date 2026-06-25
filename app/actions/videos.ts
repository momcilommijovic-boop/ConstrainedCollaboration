'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

export type VideoActionState = {
  error: string | null
  uploadUrl?: string
  path?: string
}

// ── getVideoUploadUrl ─────────────────────────────────────────────────────────
// Returns a signed PUT URL so the client can upload directly to Supabase Storage.

export async function getVideoUploadUrl(
  _prevState: VideoActionState,
  formData: FormData
): Promise<VideoActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const cellId = formData.get('cell_id') as string
  const fileType = formData.get('file_type') as string

  if (!cellId) return { error: 'Invalid request.' }

  const allowed = ['video/mp4', 'video/quicktime', 'video/webm']
  if (!allowed.includes(fileType)) {
    return { error: 'Only MP4, MOV, and WebM files are allowed.' }
  }

  const { data: cell } = await supabase
    .from('cells')
    .select('current_stage, current_cycle')
    .eq('id', cellId)
    .single() as { data: { current_stage: string; current_cycle: number } | null; error: unknown }

  if (!cell) return { error: 'Cell not found.' }
  if (!['SUBMISSION', 'EDITING'].includes(cell.current_stage)) {
    return { error: 'Video uploads are only open during the Submission stage.' }
  }

  const { data: membership } = await supabase
    .from('cell_members')
    .select('status')
    .eq('cell_id', cellId)
    .eq('user_id', user.id)
    .single() as { data: { status: string } | null; error: unknown }

  if (!membership || membership.status !== 'ACTIVE') {
    return { error: 'You are not an active member of this Cell.' }
  }

  const ext = fileType === 'video/quicktime' ? 'mov' : fileType === 'video/webm' ? 'webm' : 'mp4'
  const path = `${cellId}/${user.id}/cycle-${cell.current_cycle}.${ext}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('video-clips').createSignedUploadUrl(path)
  if (error) return { error: error.message }

  return { error: null, uploadUrl: data.signedUrl, path }
}

// ── registerVideoClip ─────────────────────────────────────────────────────────
// Called by the client after a successful upload to record it in the DB.

export async function registerVideoClip(
  _prevState: VideoActionState,
  formData: FormData
): Promise<VideoActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const cellId = formData.get('cell_id') as string
  const briefId = (formData.get('brief_id') as string) || null
  const storagePath = formData.get('storage_path') as string
  const fileName = (formData.get('file_name') as string) || null
  const fileSizeBytes = parseInt(formData.get('file_size_bytes') as string, 10) || null

  if (!cellId || !storagePath) return { error: 'Invalid request.' }

  const { data: cell } = await supabase
    .from('cells')
    .select('current_stage, current_cycle, slug')
    .eq('id', cellId)
    .single() as { data: { current_stage: string; current_cycle: number; slug: string } | null; error: unknown }

  if (!cell) return { error: 'Cell not found.' }

  const { error: upsertError } = await (supabase
    .from('video_clips' as never)
    .upsert(
      {
        cell_id: cellId,
        brief_id: briefId,
        user_id: user.id,
        cycle: cell.current_cycle,
        storage_path: storagePath,
        file_name: fileName,
        file_size_bytes: fileSizeBytes,
        status: 'PENDING',
        uploaded_at: new Date().toISOString(),
        reviewed_at: null,
        editor_note: null,
      } as never,
      { onConflict: 'cell_id,user_id,cycle' }
    ) as unknown as Promise<{ error: { message: string } | null }>)

  if (upsertError) return { error: upsertError.message }

  revalidatePath(`/cells/${cell.slug}/submit`)
  revalidatePath(`/cells/${cell.slug}/edit`)
  return { error: null }
}

// ── reviewVideoClip ───────────────────────────────────────────────────────────

const reviewSchema = z.object({
  clip_id: z.string().uuid(),
  status: z.enum(['APPROVED', 'REJECTED']),
  editor_note: z.string().max(500).optional(),
})

export async function reviewVideoClip(
  _prevState: VideoActionState,
  formData: FormData
): Promise<VideoActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const parsed = reviewSchema.safeParse({
    clip_id: formData.get('clip_id'),
    status: formData.get('status'),
    editor_note: formData.get('editor_note') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { clip_id, status, editor_note } = parsed.data

  const { data: clip } = await (supabase
    .from('video_clips' as never)
    .select('cell_id')
    .eq('id' as never, clip_id)
    .single() as unknown as Promise<{ data: { cell_id: string } | null; error: unknown }>)

  if (!clip) return { error: 'Clip not found.' }

  const { data: membership } = await supabase
    .from('cell_members')
    .select('role')
    .eq('cell_id', clip.cell_id)
    .eq('user_id', user.id)
    .single() as { data: { role: string } | null; error: unknown }

  if (!membership || membership.role !== 'EDITOR') {
    return { error: 'Only the Editor can review clips.' }
  }

  const { error: updateError } = await (supabase
    .from('video_clips' as never)
    .update({
      status,
      editor_note: editor_note ?? null,
      reviewed_at: new Date().toISOString(),
    } as never)
    .eq('id' as never, clip_id) as unknown as Promise<{ error: { message: string } | null }>)

  if (updateError) return { error: updateError.message }

  const { data: cell } = await supabase
    .from('cells')
    .select('slug')
    .eq('id', clip.cell_id)
    .single() as { data: { slug: string } | null; error: unknown }

  if (cell) revalidatePath(`/cells/${cell.slug}/edit`)
  return { error: null }
}

// ── setPublicationYouTubeUrl ──────────────────────────────────────────────────

export async function setPublicationYouTubeUrl(
  _prevState: VideoActionState,
  formData: FormData
): Promise<VideoActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const publicationId = formData.get('publication_id') as string
  const youtubeUrl = ((formData.get('youtube_url') as string) ?? '').trim()

  if (!publicationId) return { error: 'Invalid request.' }

  if (youtubeUrl && !youtubeUrl.match(/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//)) {
    return { error: 'Please enter a valid YouTube URL (youtube.com or youtu.be).' }
  }

  const { data: pub } = await (supabase
    .from('publications')
    .select('id, cell_id, cycle')
    .eq('id', publicationId)
    .single() as unknown as Promise<{ data: { id: string; cell_id: string; cycle: number } | null; error: unknown }>)

  if (!pub) return { error: 'Publication not found.' }

  const { data: membership } = await supabase
    .from('cell_members')
    .select('role')
    .eq('cell_id', pub.cell_id)
    .eq('user_id', user.id)
    .single() as { data: { role: string } | null; error: unknown }

  if (!membership || membership.role !== 'EDITOR') {
    return { error: 'Only the Editor can set the YouTube URL.' }
  }

  const { error: updateError } = await (supabase
    .from('publications')
    .update({ youtube_url: youtubeUrl || null } as never)
    .eq('id', publicationId) as unknown as Promise<{ error: { message: string } | null }>)

  if (updateError) return { error: updateError.message }

  const { data: cell } = await supabase
    .from('cells')
    .select('slug')
    .eq('id', pub.cell_id)
    .single() as { data: { slug: string } | null; error: unknown }

  if (cell) revalidatePath(`/cells/${cell.slug}/publication/${pub.cycle}`)
  return { error: null }
}
