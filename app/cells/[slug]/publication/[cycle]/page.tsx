import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { renderPublication } from '@/lib/layout/renderer'
import { DEFAULT_TOKENS } from '@/lib/layout/defaults'
import { PrintButton } from '@/components/publication/PrintButton'
import { SetYouTubeUrlForm } from '@/components/publication/SetYouTubeUrlForm'
import type { DesignTokens, LayoutRow, MediaItem, SubmissionForRender } from '@/lib/layout/types'

// Always render fresh — layout data changes whenever the editor saves
export const dynamic = 'force-dynamic'

export default async function PublicationPage({
  params,
}: {
  params: { slug: string; cycle: string }
}) {
  const cycle = parseInt(params.cycle, 10)
  if (isNaN(cycle)) notFound()

  const admin = createAdminClient()

  type CellRow = { id: string; slug: string; title: string }
  const { data: cell } = await (admin
    .from('cells')
    .select('id, slug, title')
    .eq('slug', params.slug)
    .single() as unknown as Promise<{ data: CellRow | null; error: unknown }>)

  if (!cell) notFound()

  type PubRow = { id: string; cycle: number; status: string; selected_submission_ids: string[] | null; published_at: string | null; youtube_url: string | null }
  const { data: publication } = await (admin
    .from('publications')
    .select('id, cycle, status, selected_submission_ids, published_at, youtube_url')
    .eq('cell_id', cell.id)
    .eq('cycle', cycle)
    .maybeSingle() as unknown as Promise<{ data: PubRow | null; error: unknown }>)

  // Check if the current viewer is the editor (for YouTube URL management)
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isEditor = false
  if (user) {
    const { data: membership } = await supabase
      .from('cell_members')
      .select('role')
      .eq('cell_id', cell.id)
      .eq('user_id', user.id)
      .maybeSingle() as { data: { role: string } | null; error: unknown }
    isEditor = membership?.role === 'EDITOR'
  }

  if (!publication) notFound()

  // Load layout
  const { data: layoutRow } = await (admin
    .from('publication_layouts' as never)
    .select('*')
    .eq('publication_id' as never, publication.id)
    .maybeSingle() as unknown as Promise<{ data: LayoutRow | null; error: unknown }>)

  // Load design tokens
  const { data: tokenRow } = await (admin
    .from('cell_design_tokens' as never)
    .select('tokens')
    .eq('cell_id' as never, cell.id)
    .maybeSingle() as unknown as Promise<{ data: { tokens: DesignTokens } | null; error: unknown }>)

  const tokens = tokenRow?.tokens ?? DEFAULT_TOKENS

  // Load accepted submissions
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
    .eq('cell_id', cell.id)
    .eq('cycle', cycle)
    .eq('status', 'ACCEPTED') as unknown as Promise<{ data: SubRow[] | null; error: unknown }>)

  const submissions: SubmissionForRender[] = (rawSubs ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    body: s.body,
    author_name: s.profiles?.display_name ?? s.profiles?.username ?? 'Unknown',
  }))

  // Load media
  const { data: rawMedia } = await (admin
    .from('publication_media' as never)
    .select('*')
    .eq('cell_id' as never, cell.id)
    .eq('cycle' as never, cycle)
    .order('uploaded_at' as never, { ascending: false }) as unknown as Promise<{
    data: MediaItem[] | null; error: unknown
  }>)

  const media: MediaItem[] = rawMedia ?? []
  const pages = layoutRow?.pages ?? []

  // If no layout has been built yet, show a placeholder
  if (pages.length === 0) {
    return <NoLayoutFallback cellTitle={cell.title} cellSlug={params.slug} cycle={cycle} />
  }

  const publicationHtml = renderPublication(pages, tokens, media, submissions, { shell: false })

  const publishedDate = publication.published_at
    ? new Date(publication.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      })
    : null

  const youtubeEmbedId = publication.youtube_url
    ? extractYouTubeId(publication.youtube_url)
    : null

  return (
    <>
      {/* Inject the publication CSS + content directly into body */}
      {/* eslint-disable-next-line react/no-danger */}
      <div dangerouslySetInnerHTML={{ __html: publicationHtml }} />

      {/* YouTube video — shown if a URL has been linked */}
      {youtubeEmbedId && (
        <div
          className="pub-no-print px-8 py-8"
          style={{ background: tokens.colours.background, borderTop: `1px solid ${tokens.colours.border}` }}
        >
          <p
            style={{ fontFamily: `'${tokens.fonts.ui.family}', ${tokens.fonts.ui.fallback}`, color: tokens.colours.text_muted }}
            className="text-xs uppercase tracking-widest mb-4"
          >
            Video
          </p>
          <div className="w-full max-w-2xl aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeEmbedId}`}
              title="Publication video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* Editor: set / update YouTube URL */}
      {isEditor && publication && (
        <div
          className="pub-no-print px-8 py-6"
          style={{ background: tokens.colours.background, borderTop: `1px solid ${tokens.colours.border}` }}
        >
          <SetYouTubeUrlForm
            publicationId={publication.id}
            currentUrl={publication.youtube_url}
          />
        </div>
      )}

      {/* Quorum footer — hidden on print */}
      <footer
        style={{ background: tokens.colours.background, borderTop: `1px solid ${tokens.colours.border}` }}
        className="pub-no-print px-8 py-6 flex items-center justify-between"
      >
        <p
          style={{ fontFamily: `'${tokens.fonts.ui.family}', ${tokens.fonts.ui.fallback}`, color: tokens.colours.text_muted }}
          className="text-xs uppercase tracking-widest"
        >
          {cell.title}
          {publishedDate ? ` · ${publishedDate}` : ''}
          {` · Cycle ${cycle}`}
        </p>
        <div className="flex items-center gap-6">
          <PrintButton
            className="text-xs uppercase tracking-widest hover:opacity-70 transition-opacity"
            style={{ fontFamily: `'${tokens.fonts.ui.family}', ${tokens.fonts.ui.fallback}`, color: tokens.colours.text_muted }}
          />
          <a
            href="/"
            style={{ fontFamily: `'${tokens.fonts.ui.family}', ${tokens.fonts.ui.fallback}`, color: tokens.colours.text_muted }}
            className="text-xs uppercase tracking-widest hover:opacity-70 transition-opacity"
          >
            Published by Quorum
          </a>
        </div>
      </footer>
    </>
  )
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    return u.searchParams.get('v')
  } catch {
    return null
  }
}

function NoLayoutFallback({
  cellTitle,
  cellSlug,
  cycle,
}: {
  cellTitle: string
  cellSlug: string
  cycle: number
}) {
  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <span className="font-serif-display text-xl tracking-tight">Quorum</span>
        <a
          href={`/cells/${cellSlug}`}
          className="font-mono text-xs text-olive hover:text-near-black transition-colors"
        >
          ← {cellTitle}
        </a>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="font-mono text-xs text-olive uppercase tracking-widest">
            {cellTitle} · Cycle {cycle}
          </p>
          <p className="font-mono text-xs text-near-black/40">
            No layout has been built for this publication yet.
          </p>
          <a
            href={`/cells/${cellSlug}/layout/${cycle}`}
            className="inline-block font-mono text-xs border border-near-black px-5 py-2.5 hover:bg-near-black hover:text-off-white transition-colors"
          >
            Open Layout Editor →
          </a>
        </div>
      </main>
      <footer className="border-t border-near-black/20 px-8 py-4 flex justify-end">
        <a href="/" className="font-mono text-xs text-olive hover:text-near-black transition-colors">
          Published by Quorum
        </a>
      </footer>
    </div>
  )
}
