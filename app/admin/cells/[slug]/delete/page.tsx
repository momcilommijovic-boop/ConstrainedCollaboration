import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { DeleteCellForm } from '@/components/admin/DeleteCellForm'

export default async function DeleteCellPage({
  params,
}: {
  params: { slug: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/cells')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single() as { data: { is_admin: boolean } | null; error: unknown }

  if (!profile?.is_admin) notFound()

  const admin = createAdminClient()

  type CellRow = {
    id: string
    slug: string
    title: string
    current_stage: string
    current_cycle: number
  }
  const { data: cell } = await admin
    .from('cells')
    .select('id, slug, title, current_stage, current_cycle')
    .eq('slug', params.slug)
    .single() as { data: CellRow | null; error: unknown }

  if (!cell) notFound()

  // Get member count
  const { count: memberCount } = await admin
    .from('cell_members')
    .select('id', { count: 'exact', head: true })
    .eq('cell_id', cell.id) as { count: number | null; error: unknown }

  // Get submission count
  const { count: submissionCount } = await admin
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('cell_id', cell.id) as { count: number | null; error: unknown }

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <Link
          href="/admin/cells"
          className="font-mono text-xs text-olive hover:text-near-black transition-colors"
        >
          ← Back to cells
        </Link>
      </header>

      <main className="flex-1 px-8 py-12 max-w-xl">
        <p className="font-mono text-xs text-accent-red uppercase tracking-widest mb-6">
          Destructive action
        </p>
        <h1 className="font-serif-display text-3xl mb-2">Delete Cell</h1>
        <p className="font-body text-base text-near-black/70 mb-8">
          This permanently deletes the Cell and all associated data. This cannot be undone.
        </p>

        {/* Cell summary */}
        <div className="border border-near-black/20 p-5 mb-8 space-y-2">
          <p className="font-serif-display text-xl">{cell.title}</p>
          <p className="font-mono text-xs text-olive">{cell.slug}</p>
          <div className="flex gap-6 mt-3">
            <div>
              <p className="font-mono text-xs text-olive">Stage</p>
              <p className="font-mono text-xs">{cell.current_stage}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-olive">Cycle</p>
              <p className="font-mono text-xs">{cell.current_cycle}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-olive">Members</p>
              <p className="font-mono text-xs">{memberCount ?? 0}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-olive">Submissions</p>
              <p className="font-mono text-xs">{submissionCount ?? 0}</p>
            </div>
          </div>
        </div>

        <DeleteCellForm cellId={cell.id} slug={cell.slug} />
      </main>
    </div>
  )
}
