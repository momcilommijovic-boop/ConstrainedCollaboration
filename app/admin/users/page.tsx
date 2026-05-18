import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { MeritBadge } from '@/components/ui/MeritBadge'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/users')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single() as { data: { is_admin: boolean } | null; error: unknown }

  if (!profile?.is_admin) notFound()

  const admin = createAdminClient()

  type ProfileRow = {
    id: string
    username: string
    display_name: string | null
    merit_score: number
    merit_history: unknown
    is_admin: boolean
    suspended_at: string | null
    created_at: string
  }

  const sort = searchParams.sort ?? 'created_at'
  const validSorts = ['created_at', 'merit_score', 'username']
  const safeSort = validSorts.includes(sort) ? sort : 'created_at'

  const { data: profiles } = await (admin
    .from('profiles')
    .select('id, username, display_name, merit_score, merit_history, is_admin, suspended_at, created_at')
    .order(safeSort as never, { ascending: safeSort === 'username' }) as unknown as Promise<{
    data: ProfileRow[] | null
    error: unknown
  }>)

  const filtered = (profiles ?? []).filter((p) => {
    if (!searchParams.q) return true
    const q = searchParams.q.toLowerCase()
    return (
      p.username.toLowerCase().includes(q) ||
      (p.display_name?.toLowerCase() ?? '').includes(q)
    )
  })

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
          <Link href="/admin/users" className="font-mono text-xs text-near-black">
            Users
          </Link>
          <Link href="/admin/cells" className="font-mono text-xs text-olive hover:text-near-black transition-colors">
            Cells
          </Link>
        </nav>
      </header>

      <main className="flex-1 px-8 py-12">
        <div className="max-w-5xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-serif-display text-3xl">All Users</h1>
            <span className="font-mono text-xs text-olive">{filtered.length} profiles</span>
          </div>

          {/* Filters */}
          <form method="get" className="flex items-center gap-3 mb-6">
            <input
              type="text"
              name="q"
              defaultValue={searchParams.q}
              placeholder="Search username or name…"
              className="border border-near-black/20 bg-transparent px-3 py-2 font-mono text-xs focus:outline-none focus:border-near-black w-56"
            />
            <select
              name="sort"
              defaultValue={safeSort}
              className="border border-near-black/20 bg-off-white px-3 py-2 font-mono text-xs focus:outline-none focus:border-near-black"
            >
              <option value="created_at">Newest first</option>
              <option value="merit_score">Merit score</option>
              <option value="username">Username A–Z</option>
            </select>
            <button
              type="submit"
              className="border border-near-black/20 px-3 py-2 font-mono text-xs hover:bg-near-black hover:text-off-white transition-colors"
            >
              Filter
            </button>
            {(searchParams.q || searchParams.sort) && (
              <Link href="/admin/users" className="font-mono text-xs text-olive hover:text-near-black transition-colors">
                Clear
              </Link>
            )}
          </form>

          {filtered.length === 0 ? (
            <p className="font-mono text-xs text-olive">No users found.</p>
          ) : (
            <table className="w-full border border-near-black/20">
              <thead>
                <tr className="border-b border-near-black/20">
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">User</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Merit</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Role</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Status</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Joined</th>
                  <th className="px-4 py-2 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const history = Array.isArray(p.merit_history) ? p.merit_history as Array<{ delta: number }> : []
                  return (
                    <tr
                      key={p.id}
                      className={i < filtered.length - 1 ? 'border-b border-near-black/10' : ''}
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/users/${p.username}`}
                          className="font-body text-sm hover:text-accent-red transition-colors"
                        >
                          {p.display_name ?? p.username}
                        </Link>
                        <span className="font-mono text-xs text-olive ml-2">@{p.username}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <MeritBadge score={p.merit_score ?? 100} history={history} />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs">
                          {p.is_admin ? (
                            <span className="text-accent-red">Admin</span>
                          ) : (
                            <span className="text-olive">Member</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`font-mono text-xs ${p.suspended_at ? 'text-accent-red' : 'text-olive'}`}>
                          {p.suspended_at ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-olive">
                          {new Date(p.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/admin/users/${p.username}`}
                          className="font-mono text-xs text-olive hover:text-near-black transition-colors"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
