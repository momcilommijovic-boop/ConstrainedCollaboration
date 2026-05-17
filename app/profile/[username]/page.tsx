import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MERIT_EVENT_LABELS } from '@/lib/merit'
import { MeritBadge } from '@/components/ui/MeritBadge'

type MeritEntry = {
  event: string
  delta: number
  cell_id?: string
  cycle?: number
  ts: string
}

function parseMeritHistory(raw: unknown): MeritEntry[] {
  if (!Array.isArray(raw)) return []
  return (raw as unknown[])
    .filter(
      (e): e is MeritEntry =>
        typeof e === 'object' && e !== null && 'event' in e && 'delta' in e && 'ts' in e
    )
    .reverse()
}


export default async function ProfilePage({
  params,
}: {
  params: { username: string }
}) {
  const supabase = createClient()

  type ProfileRow = {
    id: string
    username: string
    display_name: string | null
    bio: string | null
    avatar_url: string | null
    merit_score: number
    merit_history: unknown
    created_at: string
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, merit_score, merit_history, created_at')
    .eq('username', params.username)
    .single() as { data: ProfileRow | null; error: unknown }

  if (!profile) notFound()

  const meritHistory = parseMeritHistory(profile.merit_history)
  const score = profile.merit_score ?? 100

  // Load cells participated in
  type MembershipRow = {
    role: string
    status: string
    joined_at: string
    cells: { id: string; slug: string; title: string; current_stage: string; current_cycle: number } | null
  }
  const membershipsQuery = supabase
    .from('cell_members')
    .select('role, status, joined_at, cells(id, slug, title, current_stage, current_cycle)')
    .eq('user_id', profile.id)
    .order('joined_at', { ascending: false }) as unknown as Promise<{
    data: MembershipRow[] | null
    error: unknown
  }>
  const { data: rawMemberships } = await membershipsQuery
  const memberships = (rawMemberships ?? []).filter((m): m is MembershipRow & { cells: NonNullable<MembershipRow['cells']> } => m.cells !== null)

  // Load publications contributed to (accepted submissions)
  type ContribRow = {
    title: string | null
    cycle: number
    brief_id: string
    cells: { slug: string; title: string } | null
    briefs: { title: string } | null
  }
  const contribQuery = supabase
    .from('submissions')
    .select('title, cycle, brief_id, cells(slug, title), briefs(title)')
    .eq('author_id', profile.id)
    .eq('status', 'ACCEPTED')
    .order('submitted_at', { ascending: false }) as unknown as Promise<{
    data: ContribRow[] | null
    error: unknown
  }>
  const { data: contributions } = await contribQuery

  // Check if viewer is the profile owner
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isOwn = user?.id === profile.id

  const STAGE_LABELS: Record<string, string> = {
    FORMING: 'Forming',
    BRIEFING: 'Briefing',
    SUBMISSION: 'Submission',
    EDITING: 'Editing',
    PROMOTION: 'Promotion',
    COMPLETE: 'Complete',
  }

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <div className="flex items-center gap-6">
          {isOwn && (
            <Link
              href="/dashboard"
              className="font-mono text-xs text-olive hover:text-near-black transition-colors"
            >
              Dashboard
            </Link>
          )}
          <Link
            href="/cells"
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            Cells
          </Link>
        </div>
      </header>

      <main className="flex-1 px-8 py-12 max-w-3xl">
        {/* Profile header */}
        <div className="mb-10">
          <h1 className="font-serif-display text-4xl mb-1">
            {profile.display_name ?? profile.username}
          </h1>
          <p className="font-mono text-xs text-olive mb-4">@{profile.username}</p>
          {profile.bio && (
            <p className="font-body text-base text-near-black/70 leading-relaxed max-w-lg mb-4">
              {profile.bio}
            </p>
          )}

          {/* Merit score */}
          <div className="border border-near-black/20 inline-flex items-center gap-6 px-5 py-3">
            <div>
              <p className="font-mono text-xs text-olive mb-1">Merit Score</p>
              <MeritBadge score={score} history={meritHistory} size="lg" />
            </div>
            {score < 60 && (
              <p className="font-mono text-xs text-accent-red max-w-[180px]">
                Below 60 — cannot join new Cells
              </p>
            )}
          </div>
        </div>

        {/* Merit history */}
        <section className="mb-10">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
            Merit History
          </p>
          {meritHistory.length === 0 ? (
            <p className="font-mono text-xs text-olive">No merit events yet.</p>
          ) : (
            <table className="w-full border border-near-black/20">
              <thead>
                <tr className="border-b border-near-black/20">
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">
                    Event
                  </th>
                  <th className="text-right font-mono text-xs text-olive px-4 py-2 font-normal">
                    Delta
                  </th>
                  <th className="text-right font-mono text-xs text-olive px-4 py-2 font-normal">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {meritHistory.slice(0, 30).map((entry, i) => (
                  <tr
                    key={i}
                    className={i < meritHistory.slice(0, 30).length - 1 ? 'border-b border-near-black/10' : ''}
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs">
                        {MERIT_EVENT_LABELS[entry.event] ?? entry.event}
                      </span>
                      {entry.cycle != null && (
                        <span className="font-mono text-xs text-olive ml-2">
                          cycle {entry.cycle}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`font-mono text-xs tabular-nums ${
                          entry.delta > 0 ? 'text-near-black' : 'text-accent-red'
                        }`}
                      >
                        {entry.delta > 0 ? '+' : ''}
                        {entry.delta}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-mono text-xs text-olive">
                        {new Date(entry.ts).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Cells */}
        <section className="mb-10">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Cells</p>
          {memberships.length === 0 ? (
            <p className="font-mono text-xs text-olive">No Cell memberships.</p>
          ) : (
            <table className="w-full border border-near-black/20">
              <thead>
                <tr className="border-b border-near-black/20">
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Cell</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Role</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Stage</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m, i) => (
                  <tr
                    key={i}
                    className={i < memberships.length - 1 ? 'border-b border-near-black/10' : ''}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/cells/${m.cells.slug}`}
                        className="font-body text-sm hover:text-accent-red transition-colors"
                      >
                        {m.cells.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-olive">{m.role}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-olive">
                        {STAGE_LABELS[m.cells.current_stage] ?? m.cells.current_stage}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`font-mono text-xs ${
                          m.status === 'ACTIVE' ? 'text-near-black' : 'text-accent-red'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Publications contributed to */}
        {(contributions ?? []).length > 0 && (
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
              Publications
            </p>
            <div className="border border-near-black/20 divide-y divide-near-black/10">
              {(contributions ?? []).map((c, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm">{c.title ?? c.briefs?.title ?? '(untitled)'}</p>
                    <p className="font-mono text-xs text-olive">
                      {c.cells?.title} · Cycle {c.cycle}
                    </p>
                  </div>
                  {c.cells?.slug && (
                    <Link
                      href={`/cells/${c.cells.slug}/publication/${c.cycle}`}
                      className="font-mono text-xs text-olive hover:text-near-black transition-colors shrink-0"
                    >
                      Read →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
