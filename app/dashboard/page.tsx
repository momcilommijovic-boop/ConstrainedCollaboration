import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import Link from 'next/link'
import { MeritBadge } from '@/components/ui/MeritBadge'

export const metadata = { title: 'Dashboard — Quorum' }

type RawCell = {
  id: string
  slug: string
  title: string
  current_stage: string
  status: string
  stage_deadline: string | null
  member_cap: number
}

const STAGE_LABELS: Record<string, string> = {
  FORMING: 'Forming',
  BRIEFING: 'Briefing',
  SUBMISSION: 'Submission',
  EDITING: 'Editing',
  PROMOTION: 'Promotion',
  COMPLETE: 'Complete',
}

function formatDeadline(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  if (diffMs <= 0) return 'Expired'
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffH < 24) return `${diffH}h left`
  return `${Math.ceil(diffMs / (1000 * 60 * 60 * 24))}d left`
}

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, display_name, merit_score, merit_history')
      .eq('id', user.id)
      .single() as unknown as Promise<{
        data: { username: string; display_name: string | null; merit_score: number; merit_history: unknown } | null
        error: unknown
      }>,
    supabase
      .from('cell_members')
      .select('cell_id, role, cells(id, slug, title, current_stage, status, stage_deadline, member_cap)')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE') as unknown as Promise<{
        data: { cell_id: string; role: string; cells: RawCell | null }[] | null
        error: unknown
      }>,
  ])

  const profile = profileResult.data
  const memberships = (membershipResult.data ?? []).filter((m) => m.cells !== null)

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <div className="flex items-center gap-6">
          {profile?.username && (
            <Link
              href={`/profile/${profile.username}`}
              className="hover:opacity-70 transition-opacity"
            >
              <MeritBadge
                score={profile.merit_score ?? 100}
                history={Array.isArray(profile.merit_history) ? profile.merit_history as { delta: number }[] : []}
              />
            </Link>
          )}
          <Link
            href="/cells"
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            Browse
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="font-mono text-xs text-olive hover:text-near-black transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-8 py-12 max-w-4xl">
        <h1 className="font-serif-display text-4xl mb-1">
          {profile?.display_name ?? profile?.username}
        </h1>
        <p className="font-mono text-xs text-olive mb-10">@{profile?.username}</p>

        {/* Active cells */}
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-4">
            <p className="font-mono text-xs uppercase tracking-widest text-olive">Your Cells</p>
            <Link
              href="/cells/new"
              className="font-mono text-xs bg-near-black text-off-white border border-near-black px-3 py-1 hover:bg-accent-red hover:border-accent-red transition-colors"
            >
              + New Cell
            </Link>
          </div>

          {memberships.length === 0 ? (
            <div className="border border-near-black/20 px-6 py-8">
              <p className="font-body text-sm text-olive mb-4">
                You are not a member of any Cell yet.
              </p>
              <div className="flex gap-3">
                <Link
                  href="/cells"
                  className="font-mono text-xs border border-near-black px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors"
                >
                  Browse open Cells
                </Link>
                <Link
                  href="/cells/new"
                  className="font-mono text-xs bg-near-black text-off-white border border-near-black px-4 py-2 hover:bg-accent-red hover:border-accent-red transition-colors"
                >
                  Start one →
                </Link>
              </div>
            </div>
          ) : (
            <table className="w-full border border-near-black/20">
              <thead>
                <tr className="border-b border-near-black/20 bg-near-black/[0.02]">
                  <th className="text-left font-mono text-xs text-olive uppercase tracking-widest px-4 py-2">
                    Cell
                  </th>
                  <th className="text-left font-mono text-xs text-olive uppercase tracking-widest px-4 py-2">
                    Stage
                  </th>
                  <th className="text-left font-mono text-xs text-olive uppercase tracking-widest px-4 py-2">
                    Role
                  </th>
                  <th className="text-left font-mono text-xs text-olive uppercase tracking-widest px-4 py-2">
                    Deadline
                  </th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m, i) => {
                  const cell = m.cells!
                  const isLast = i === memberships.length - 1
                  const deadlineUrgent =
                    cell.stage_deadline &&
                    new Date(cell.stage_deadline).getTime() - Date.now() <
                      24 * 60 * 60 * 1000
                  return (
                    <tr
                      key={m.cell_id}
                      className={!isLast ? 'border-b border-near-black/10' : ''}
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
                        <span className="font-mono text-xs text-olive">
                          {STAGE_LABELS[cell.current_stage] ?? cell.current_stage}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-olive">{m.role}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {cell.stage_deadline ? (
                          <span
                            className={`font-mono text-xs ${
                              deadlineUrgent ? 'text-accent-red' : 'text-olive'
                            }`}
                          >
                            {formatDeadline(cell.stage_deadline)}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-olive/40">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  )
}
