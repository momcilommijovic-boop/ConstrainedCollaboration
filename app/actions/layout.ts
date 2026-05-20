'use server'

import { createClient } from '@/lib/supabase/server'
import { callLLM, robustParseJSON } from '@/lib/llm'
import { nanoid } from 'nanoid'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_TOKENS } from '@/lib/layout/defaults'
import type { Page, DesignTokens } from '@/lib/layout/types'
import { revalidatePath } from 'next/cache'

export type LayoutActionState = { error: string | null }

// ── saveLayout ────────────────────────────────────────────────────────────────

export async function saveLayout(
  publicationId: string,
  pages: Page[],
  cellId: string,
  cycle: number
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()

  // Check if layout exists
  const { data: existing } = await (admin
    .from('publication_layouts' as never)
    .select('id')
    .eq('publication_id' as never, publicationId)
    .maybeSingle() as unknown as Promise<{ data: { id: string } | null; error: unknown }>)

  if (existing) {
    const { error: updateErr } = await (admin
      .from('publication_layouts' as never)
      .update({
        pages,
        last_edited_at: new Date().toISOString(),
        last_edited_by: user.id,
      } as never)
      .eq('id' as never, existing.id) as unknown as Promise<{ error: { message: string } | null }>)

    if (updateErr) return { error: `Save failed: ${updateErr.message}` }
  } else {
    // Fetch design token id for this cell
    const { data: tokenRow } = await (admin
      .from('cell_design_tokens' as never)
      .select('id')
      .eq('cell_id' as never, cellId)
      .maybeSingle() as unknown as Promise<{ data: { id: string } | null; error: unknown }>)

    const { error: insertErr } = await (admin
      .from('publication_layouts' as never)
      .insert({
        publication_id: publicationId,
        cell_id: cellId,
        cycle,
        pages,
        design_token_id: tokenRow?.id ?? null,
        status: 'DRAFT',
        last_edited_at: new Date().toISOString(),
        last_edited_by: user.id,
      } as never) as unknown as Promise<{ error: { message: string } | null }>)

    if (insertErr) return { error: `Save failed: ${insertErr.message}` }
  }

  // Revalidate publication preview so it picks up the new layout immediately
  const { data: cell } = await admin.from('cells').select('slug').eq('id', cellId).single() as { data: { slug: string } | null; error: unknown }
  if (cell) revalidatePath(`/cells/${cell.slug}/publication/${cycle}`)

  return { error: null }
}

// ── uploadMedia ───────────────────────────────────────────────────────────────

export async function uploadMedia(
  formData: FormData
): Promise<{ error: string | null; media?: { id: string; storage_url: string; filename: string } }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const cellId = formData.get('cell_id') as string
  const cycle = parseInt(formData.get('cycle') as string, 10)
  const file = formData.get('file') as File | null

  if (!file || file.size === 0) return { error: 'No file provided.' }
  if (file.size > 8 * 1024 * 1024) return { error: 'File must be under 8 MB.' }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { error: 'Only JPG, PNG, and WebP are supported.' }

  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const path = `${cellId}/${cycle}/${filename}`
  const bytes = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error: uploadErr } = await admin.storage
    .from('publications')
    .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: false })

  if (uploadErr) return { error: `Upload failed: ${uploadErr.message}` }

  const { data: urlData } = admin.storage.from('publications').getPublicUrl(path)
  const storageUrl = urlData.publicUrl

  const { data: mediaRow, error: insertErr } = await (admin
    .from('publication_media' as never)
    .insert({
      cell_id: cellId,
      cycle,
      uploader_id: user.id,
      filename,
      storage_url: storageUrl,
      focal_point_x: 0.5,
      focal_point_y: 0.5,
    } as never)
    .select('id, storage_url, filename')
    .single() as unknown as Promise<{ data: { id: string; storage_url: string; filename: string } | null; error: unknown }>)

  if (insertErr || !mediaRow) return { error: 'Failed to save media record.' }

  return { error: null, media: mediaRow }
}

// ── suggestLayout ─────────────────────────────────────────────────────────────

export async function suggestLayout(
  publicationId: string
): Promise<{ error: string | null; pages?: Page[] }> {
  const admin = createAdminClient()

  type PubRow = { id: string; cell_id: string; cycle: number }
  const { data: pub } = await (admin
    .from('publications')
    .select('id, cell_id, cycle')
    .eq('id', publicationId)
    .single() as unknown as Promise<{ data: PubRow | null; error: unknown }>)

  if (!pub) return { error: 'Publication not found.' }

  type SubRow = {
    id: string
    title: string | null
    body: string | null
    word_count: number | null
    profiles: { display_name: string | null; username: string } | null
  }
  const { data: rawSubs } = await (admin
    .from('submissions')
    .select('id, title, body, word_count, profiles(display_name, username)')
    .eq('cell_id', pub.cell_id)
    .eq('cycle', pub.cycle)
    .eq('status', 'ACCEPTED') as unknown as Promise<{ data: SubRow[] | null; error: unknown }>)

  const subs = (rawSubs ?? []).map((s) => ({
    id: s.id,
    title: s.title ?? 'Untitled',
    author: s.profiles?.display_name ?? s.profiles?.username ?? 'Unknown',
    wc: s.word_count ?? Math.round((s.body?.split(' ').length ?? 500)),
  }))

  // ── Rotating article-page patterns for variety ──────────────────────────────
  // Each pattern is a function that produces blocks for a single article page.
  type SubInfo = { id: string; title: string; author: string; wc: number }

  const PATTERNS: Array<(s: SubInfo) => Page['blocks']> = [
    // 0 — Standard: heading → byline → standfirst → body
    (s) => [
      { id: nanoid(8), type: 'heading', props: { text: s.title, level: 'h2', align: 'left' } },
      { id: nanoid(8), type: 'byline', props: { submission_id: s.id, author_name: s.author, author_profile_url: null, date: new Date().toISOString().split('T')[0] } },
      { id: nanoid(8), type: 'standfirst', props: { text: 'An introduction to this piece.' } },
      { id: nanoid(8), type: 'article_body', props: { submission_id: s.id, show_drop_cap: true, column_width: 'standard', show_title: false, show_byline: false, inline_image_id: null, inline_image_position: 'left', inline_image_width: '40%' } },
    ],
    // 1 — Image-led: full image → heading → byline → body
    (s) => [
      { id: nanoid(8), type: 'image_full', props: { image_id: '', caption: '', alt: s.title, aspect: '16:9' } },
      { id: nanoid(8), type: 'heading', props: { text: s.title, level: 'h2', align: 'left' } },
      { id: nanoid(8), type: 'byline', props: { submission_id: s.id, author_name: s.author, author_profile_url: null, date: new Date().toISOString().split('T')[0] } },
      { id: nanoid(8), type: 'article_body', props: { submission_id: s.id, show_drop_cap: false, column_width: 'standard', show_title: false, show_byline: false, inline_image_id: null, inline_image_position: 'left', inline_image_width: '40%' } },
    ],
    // 2 — Pull-quote featured: heading → byline → pull_quote → divider → body
    (s) => [
      { id: nanoid(8), type: 'heading', props: { text: s.title, level: 'h2', align: 'centre' } },
      { id: nanoid(8), type: 'byline', props: { submission_id: s.id, author_name: s.author, author_profile_url: null, date: new Date().toISOString().split('T')[0] } },
      { id: nanoid(8), type: 'pull_quote', props: { text: 'A compelling line from this article.', attribution: s.author, style_override: null } },
      { id: nanoid(8), type: 'divider', props: { style: 'rule', weight: null } },
      { id: nanoid(8), type: 'article_body', props: { submission_id: s.id, show_drop_cap: true, column_width: 'narrow', show_title: false, show_byline: false, inline_image_id: null, inline_image_position: 'left', inline_image_width: '40%' } },
    ],
    // 3 — Wide + dividers: divider → heading → byline → body (wide col)
    (s) => [
      { id: nanoid(8), type: 'divider', props: { style: 'ornament', weight: null } },
      { id: nanoid(8), type: 'heading', props: { text: s.title, level: 'h2', align: 'right' } },
      { id: nanoid(8), type: 'byline', props: { submission_id: s.id, author_name: s.author, author_profile_url: null, date: new Date().toISOString().split('T')[0] } },
      { id: nanoid(8), type: 'article_body', props: { submission_id: s.id, show_drop_cap: true, column_width: 'wide', show_title: false, show_byline: false, inline_image_id: null, inline_image_position: 'left', inline_image_width: '40%' } },
    ],
  ]

  const pages: Page[] = []

  // Cover
  pages.push({
    id: nanoid(8),
    label: 'Cover',
    blocks: [
      { id: nanoid(8), type: 'cover', props: { title: 'Issue Title', subtitle: '', issue_number: `Issue ${pub.cycle}`, image_id: null, overlay_opacity: 40, title_position: 'bottom-left' } },
    ],
  })

  // Contents
  pages.push({
    id: nanoid(8),
    label: 'Contents',
    blocks: [
      {
        id: nanoid(8),
        type: 'contents',
        props: {
          show_page_numbers: true,
          entries: subs.map((s, i) => ({ title: s.title, author: s.author, page: i + 3 })),
        },
      },
    ],
  })

  // One page per article, rotating patterns
  subs.forEach((s, i) => {
    const pattern = PATTERNS[i % PATTERNS.length]
    pages.push({
      id: nanoid(8),
      label: s.title,
      blocks: pattern(s) as Page['blocks'],
    })
  })

  // Colophon
  pages.push({
    id: nanoid(8),
    label: 'Colophon',
    blocks: [
      { id: nanoid(8), type: 'colophon', props: { text: 'Published by Quorum.\nAll rights reserved.' } },
    ],
  })

  return { error: null, pages }
}

// ── suggestPullQuote ──────────────────────────────────────────────────────────

export async function suggestPullQuote(
  submissionId: string
): Promise<{ error: string | null; text?: string }> {
  const admin = createAdminClient()
  const { data: sub } = await (admin
    .from('submissions')
    .select('body, title')
    .eq('id', submissionId)
    .single() as unknown as Promise<{ data: { body: string | null; title: string | null } | null; error: unknown }>)

  if (!sub?.body) return { error: 'Submission body not found.' }

  // Simple heuristic first — find longest sentence containing em-dash or that is 15-30 words
  const sentences = sub.body
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30)

  const candidate = sentences.find((s) => s.includes('—') || s.includes('–'))
    ?? sentences.sort((a, b) => b.split(' ').length - a.split(' ').length)[0]

  if (candidate && candidate.split(' ').length <= 35) {
    return { error: null, text: candidate }
  }

  // Fall back to LLM
  try {
    const text = await callLLM(sub.body.slice(0, 3000), {
      system: 'You are an editorial assistant. Extract the single most compelling pull quote sentence from this article — under 30 words, no dependent clauses, suitable for large display. Return only the sentence, nothing else.',
      maxTokens: 100,
    })
    return { error: null, text: text.trim() }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Pull quote suggestion failed.' }
  }
}
