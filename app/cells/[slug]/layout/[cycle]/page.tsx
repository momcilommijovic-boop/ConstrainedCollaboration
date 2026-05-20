import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { LayoutEditor } from '@/components/layout/LayoutEditor'
import { DEFAULT_TOKENS } from '@/lib/layout/defaults'
import type { DesignTokens, LayoutRow, MediaItem, SubmissionForRender } from '@/lib/layout/types'

export const dynamic = 'force-dynamic'

export default async function LayoutEditorPage({
  params,
}: {
  params: { slug: string; cycle: string }
}) {
  const cycle = parseInt(params.cycle, 10)
  if (isNaN(cycle)) notFound()

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/cells/${params.slug}/layout/${cycle}`)

  const admin = createAdminClient()

  type CellRow = {
    id: string
    slug: string
    title: string
    owner_id: string
    current_stage: string
    current_cycle: number
  }
  const { data: cell } = await admin
    .from('cells')
    .select('id, slug, title, owner_id, current_stage, current_cycle')
    .eq('slug', params.slug)
    .single() as { data: CellRow | null; error: unknown }

  if (!cell) notFound()

  // Must be EDITOR
  const { data: membership } = await admin
    .from('cell_members')
    .select('role')
    .eq('cell_id', cell.id)
    .eq('user_id', user.id)
    .single() as { data: { role: string } | null; error: unknown }

  const { data: adminProfile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single() as { data: { is_admin: boolean } | null; error: unknown }

  const isOwner = cell.owner_id === user.id
  const isEditor = membership?.role === 'EDITOR'
  const isAdmin = adminProfile?.is_admin ?? false
  if (!isOwner && !isEditor && !isAdmin) redirect(`/cells/${params.slug}`)

  // Load publication
  type PubRow = { id: string; status: string; selected_submission_ids: string[] | null }
  const { data: publication } = await admin
    .from('publications')
    .select('id, status, selected_submission_ids')
    .eq('cell_id', cell.id)
    .eq('cycle', cycle)
    .maybeSingle() as { data: PubRow | null; error: unknown }

  if (!publication) {
    return (
      <div className="min-h-screen bg-off-white flex flex-col">
        <header className="border-b border-near-black/20 px-8 py-4">
          <Link href={`/cells/${params.slug}`} className="font-mono text-xs text-olive hover:text-near-black">← Cell</Link>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="font-mono text-xs text-olive">No publication exists for cycle {cycle} yet.</p>
        </main>
      </div>
    )
  }

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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-off-white">
      {/* Top bar */}
      <header className="border-b border-near-black/20 px-6 py-3 flex items-center justify-between shrink-0 bg-off-white z-10">
        <div className="flex items-center gap-4">
          <Link href={`/cells/${params.slug}`} className="font-mono text-xs text-olive hover:text-near-black transition-colors">
            ← {cell.title}
          </Link>
          <span className="font-mono text-xs text-near-black/20">|</span>
          <span className="font-mono text-xs text-olive">Layout Editor — Cycle {cycle}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/cells/${params.slug}/publication/${cycle}`}
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            Preview →
          </Link>
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="flex-1 overflow-hidden">
        <LayoutEditor
          publicationId={publication.id}
          cellId={cell.id}
          cellSlug={params.slug}
          cycle={cycle}
          initialPages={layoutRow?.pages ?? []}
          tokens={tokens}
          submissions={submissions}
          media={media}
        />
      </div>
    </div>
  )
}
