import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

export default async function AdminCellsPage({
  searchParams,
}: {
  searchParams: { q?: string; stage?: string }
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
    status: string
    current_cycle: number
    created_at: string
    profiles: { username: string; display_name: string | null } | null
  }

  let query = admin
    .from('cells')
    .select('id, slug, title, current_stage, status, current_cycle, created_at, profiles(username, display_name)')
    .order('created_at', { ascending: false })

  if (searchParams.stage) {
    query = query.eq('current_stage', searchParams.stage) as typeof query
  }

  const { data: cells } = await (query as unknown as Promise<{ data: CellRow[] | null; error: unknown }>)

  const filtered = (cells ?? []).filter((c) => {
    if (!searchParams.q) return true
    const q = searchParams.q.toLowerCase()
    return c.title.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
  })

  const STAGES = ['FORMING', 'BRIEFING', 'SUBMISSION', 'EDITING', 'PROMOTION', 'COMPLETE']

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/admin/test-users" className="font-mono text-xs text-olive hover:text-near-black transition-colors">
            Test Users
          </Link>
          <Link href="/admin/users" className="font-mono text-xs text-olive hover:text-near-black transition-colors">
            Users
          </Link>
          <Link href="/admin/cells" className="font-mono text-xs text-near-black">
            Cells
          </Link>
        </nav>
      </header>

      <main className="flex-1 px-8 py-12">
        <div className="max-w-5xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-serif-display text-3xl">All Cells</h1>
            <span className="font-mono text-xs text-olive">{filtered.length} cells</span>
          </div>

          {/* Filters */}
          <form method="get" className="flex items-center gap-3 mb-6">
            <input
              type="text"
              name="q"
              defaultValue={searchParams.q}
              placeholder="Search title or slug…"
              className="border border-near-black/20 bg-transparent px-3 py-2 font-mono text-xs focus:outline-none focus:border-near-black w-56"
            />
            <select
              name="stage"
              defaultValue={searchParams.stage ?? ''}
              className="border border-near-black/20 bg-off-white px-3 py-2 font-mono text-xs focus:outline-none focus:border-near-black"
            >
              <option value="">All stages</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              type="submit"
              className="border border-near-black/20 px-3 py-2 font-mono text-xs hover:bg-near-black hover:text-off-white transition-colors"
            >
              Filter
            </button>
            {(searchParams.q || searchParams.stage) && (
              <Link href="/admin/cells" className="font-mono text-xs text-olive hover:text-near-black transition-colors">
                Clear
              </Link>
            )}
          </form>

          {filtered.length === 0 ? (
            <p className="font-mono text-xs text-olive">No cells found.</p>
          ) : (
            <table className="w-full border border-near-black/20">
              <thead>
                <tr className="border-b border-near-black/20">
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Title</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Slug</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Stage</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Cycle</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Owner</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Created</th>
                  <th className="px-4 py-2 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cell, i) => (
                  <tr
                    key={cell.id}
                    className={i < filtered.length - 1 ? 'border-b border-near-black/10' : ''}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/cells/${cell.slug}`}
                        className="font-body text-sm hover:text-accent-red transition-colors"
                      >
                        {cell.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-olive">{cell.slug}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono text-xs ${cell.current_stage === 'COMPLETE' ? 'text-olive' : 'text-near-black'}`}>
                        {cell.current_stage}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-olive">{cell.current_cycle}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {cell.profiles ? (
                        <Link
                          href={`/profile/${cell.profiles.username}`}
                          className="font-mono text-xs text-olive hover:text-near-black transition-colors"
                        >
                          {cell.profiles.display_name ?? cell.profiles.username}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-olive/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-olive">
                        {new Date(cell.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/cells/${cell.slug}/delete`}
                        className="font-mono text-xs text-accent-red hover:text-near-black transition-colors"
                      >
                        Delete
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
