import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { DesignExtractionForm } from '@/components/layout/DesignExtractionForm'
import { DesignPreview } from '@/components/layout/DesignPreview'
import type { DesignTokens, DesignTokenRow } from '@/lib/layout/types'

export default async function CellDesignPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/cells/${params.slug}/settings/design`)

  const admin = createAdminClient()

  type CellRow = { id: string; slug: string; title: string; owner_id: string; current_stage: string; current_cycle: number }
  const { data: cell } = await admin
    .from('cells')
    .select('id, slug, title, owner_id, current_stage, current_cycle')
    .eq('slug', params.slug)
    .single() as { data: CellRow | null; error: unknown }

  if (!cell) notFound()

  const { data: membership } = await admin
    .from('cell_members')
    .select('role')
    .eq('cell_id', cell.id)
    .eq('user_id', user.id)
    .single() as { data: { role: string } | null; error: unknown }

  const isOwner = cell.owner_id === user.id
  const isEditor = membership?.role === 'EDITOR'
  if (!isOwner && !isEditor) redirect(`/cells/${params.slug}`)

  const { data: tokenRow } = await (admin
    .from('cell_design_tokens' as never)
    .select('*')
    .eq('cell_id' as never, cell.id)
    .maybeSingle() as unknown as Promise<{ data: DesignTokenRow | null; error: unknown }>)

  // Load current publication to know if layout editor / preview are available
  type PubRow = { id: string; status: string }
  const { data: publication } = await admin
    .from('publications')
    .select('id, status')
    .eq('cell_id', cell.id)
    .eq('cycle', cell.current_cycle)
    .maybeSingle() as { data: PubRow | null; error: unknown }

  const stage = cell.current_stage
  const cycle = cell.current_cycle
  const canAccessLayout = !!publication
  const canPreviewPublication = publication && ['PROMOTION', 'COMPLETE', 'PUBLISHED', 'ASSEMBLING'].includes(publication.status)

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">Quorum</Link>
        <nav className="flex items-center gap-6">
          <Link href={`/cells/${params.slug}`} className="font-mono text-xs text-olive hover:text-near-black transition-colors">
            ← {cell.title}
          </Link>
        </nav>
      </header>

      <main className="flex-1 px-8 py-12 max-w-5xl">
        <div className="mb-8">
          <p className="font-mono text-xs text-olive uppercase tracking-widest mb-2">
            {cell.title} / Design
          </p>
          <h1 className="font-serif-display text-3xl mb-2">House Style</h1>
          <p className="font-body text-sm text-near-black/60 max-w-xl">
            Extract a visual design system from reference publications. The resulting tokens govern typography, colour, and layout for all issues published by this Cell.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Left: extraction form */}
          <div>
            <DesignExtractionForm cellId={cell.id} cellSlug={cell.slug} existingTokens={tokenRow?.tokens ?? null} />
          </div>

          {/* Right: preview (if tokens exist) */}
          <div className="space-y-6">
            {tokenRow?.tokens ? (
              <DesignPreview tokens={tokenRow.tokens} />
            ) : (
              <div className="border border-near-black/20 p-8 flex items-center justify-center min-h-64">
                <p className="font-mono text-xs text-olive text-center">
                  No house style yet.<br />Run the extractor to generate one.
                </p>
              </div>
            )}

            {/* Next step guidance */}
            {tokenRow && (
              <div className="border border-near-black/20 p-5 space-y-3">
                <p className="font-mono text-xs uppercase tracking-widest text-olive">What this does</p>
                <p className="font-mono text-xs text-near-black/70 leading-relaxed">
                  These tokens set the typography, colours, and spacing for every issue this Cell publishes.
                  They are applied in the Layout Editor, where the editor arranges accepted articles into pages.
                </p>

                {canAccessLayout && (
                  <Link
                    href={`/cells/${cell.slug}/layout/${cycle}`}
                    className="block font-mono text-xs bg-near-black text-off-white px-4 py-2.5 text-center hover:opacity-80 transition-opacity"
                  >
                    Open Layout Editor — Cycle {cycle} →
                  </Link>
                )}

                {canPreviewPublication && (
                  <Link
                    href={`/cells/${cell.slug}/publication/${cycle}`}
                    className="block font-mono text-xs border border-near-black px-4 py-2.5 text-center hover:bg-near-black hover:text-off-white transition-colors"
                  >
                    View Publication — Cycle {cycle} →
                  </Link>
                )}

                {!canAccessLayout && (
                  <p className="font-mono text-xs text-olive/60">
                    No publication exists for cycle {cycle} yet. The Layout Editor becomes available once the cell reaches the Editing stage.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
