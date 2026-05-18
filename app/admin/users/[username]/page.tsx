import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { MeritBadge } from '@/components/ui/MeritBadge'
import { MERIT_EVENT_LABELS } from '@/lib/merit'
import { AdminUserActions } from '@/components/admin/AdminUserActions'

type MeritEntry = {
  event: string
  delta: number
  cycle?: number
  reason?: string
  ts: string
}

function parseMeritHistory(raw: unknown): MeritEntry[] {
  if (!Array.isArray(raw)) return []
  return (raw as unknown[])
    .filter((e): e is MeritEntry =>
      typeof e === 'object' && e !== null && 'event' in e && 'delta' in e && 'ts' in e
    )
    .reverse()
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: { username: string }
}) {
  const supabase = createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) redirect('/login?next=/admin/users')

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', currentUser.id)
    .single() as { data: { is_admin: boolean } | null; error: unknown }

  if (!adminProfile?.is_admin) notFound()

  const admin = createAdminClient()

  type ProfileRow = {
    id: string
    username: string
    display_name: string | null
    bio: string | null
    avatar_url: string | null
    location: string | null
    merit_score: number
    merit_history: unknown
    is_admin: boolean
    suspended_at: string | null
    created_at: string
  }
  const { data: profile } = await (admin
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, location, merit_score, merit_history, is_admin, suspended_at, created_at')
    .eq('username', params.username)
    .single() as unknown as Promise<{ data: ProfileRow | null; error: unknown }>)

  if (!profile) notFound()

  const meritHistory = parseMeritHistory(profile.merit_history)
  const score = profile.merit_score ?? 100

  // Memberships
  type MemberRow = {
    role: string
    status: string
    joined_at: string
    cells: { slug: string; title: string; current_stage: string } | null
  }
  const { data: memberships } = await (admin
    .from('cell_members')
    .select('role, status, joined_at, cells(slug, title, current_stage)')
    .eq('user_id', profile.id)
    .order('joined_at', { ascending: false }) as unknown as Promise<{
    data: MemberRow[] | null
    error: unknown
  }>)

  // Submissions
  type SubmissionRow = {
    title: string | null
    status: string
    cycle: number
    submitted_at: string | null
    cells: { slug: string; title: string } | null
  }
  const { data: submissions } = await (admin
    .from('submissions')
    .select('title, status, cycle, submitted_at, cells(slug, title)')
    .eq('author_id', profile.id)
    .order('submitted_at', { ascending: false }) as unknown as Promise<{
    data: SubmissionRow[] | null
    error: unknown
  }>)

  // Retrospective appearances
  type RetroRow = {
    speaker_role: string
    voice_persona: string
    retrospectives: {
      cycle: number
      episode_title: string | null
      cells: { slug: string; title: string } | null
    } | null
  }
  const displayName = profile.display_name ?? profile.username
  const { data: retroAppearances } = await (admin
    .from('retrospective_segments' as never)
    .select('speaker_role, voice_persona, retrospectives(cycle, episode_title, cells(slug, title))')
    .eq('speaker_name' as never, displayName) as unknown as Promise<{
    data: RetroRow[] | null
    error: unknown
  }>)

  const isSelf = profile.id === currentUser.id

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/admin/users" className="font-mono text-xs text-olive hover:text-near-black transition-colors">
            ← All Users
          </Link>
          <Link href="/admin/cells" className="font-mono text-xs text-olive hover:text-near-black transition-colors">
            Cells
          </Link>
        </nav>
      </header>

      <main className="flex-1 px-8 py-12 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="font-serif-display text-3xl mb-1">
              {profile.display_name ?? profile.username}
            </h1>
            <p className="font-mono text-xs text-olive">@{profile.username}</p>
            {profile.location && (
              <p className="font-mono text-xs text-olive mt-1">{profile.location}</p>
            )}
            {profile.bio && (
              <p className="font-body text-sm text-near-black/70 mt-2 max-w-lg">{profile.bio}</p>
            )}
          </div>
          <Link
            href={`/profile/${profile.username}`}
            className="font-mono text-xs text-olive hover:text-near-black transition-colors shrink-0"
          >
            Public profile →
          </Link>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-4 mb-10">
          <div className="border border-near-black/20 inline-flex items-center gap-6 px-5 py-3">
            <div>
              <p className="font-mono text-xs text-olive mb-1">Merit</p>
              <MeritBadge score={score} history={meritHistory} size="lg" />
            </div>
          </div>
          {profile.is_admin && (
            <span className="font-mono text-xs border border-accent-red text-accent-red px-3 py-1.5">
              ADMIN
            </span>
          )}
          {profile.suspended_at && (
            <span className="font-mono text-xs border border-accent-red text-accent-red px-3 py-1.5">
              SUSPENDED {new Date(profile.suspended_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Admin actions */}
        {!isSelf && (
          <section className="mb-10 border border-near-black/20 p-5">
            <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Admin Actions</p>
            <AdminUserActions
              userId={profile.id}
              username={profile.username}
              isAdmin={profile.is_admin}
              isSuspended={!!profile.suspended_at}
            />
          </section>
        )}

        {/* Merit history */}
        <section className="mb-10">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Merit History</p>
          {meritHistory.length === 0 ? (
            <p className="font-mono text-xs text-olive">No merit events yet.</p>
          ) : (
            <table className="w-full border border-near-black/20">
              <thead>
                <tr className="border-b border-near-black/20">
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Event</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Note</th>
                  <th className="text-right font-mono text-xs text-olive px-4 py-2 font-normal">Delta</th>
                  <th className="text-right font-mono text-xs text-olive px-4 py-2 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {meritHistory.map((entry, i) => (
                  <tr key={i} className={i < meritHistory.length - 1 ? 'border-b border-near-black/10' : ''}>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs">
                        {MERIT_EVENT_LABELS[entry.event] ?? entry.event}
                      </span>
                      {entry.cycle != null && (
                        <span className="font-mono text-xs text-olive ml-2">cycle {entry.cycle}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {entry.reason && (
                        <span className="font-mono text-xs text-olive italic">{entry.reason}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-mono text-xs tabular-nums ${entry.delta > 0 ? 'text-near-black' : 'text-accent-red'}`}>
                        {entry.delta > 0 ? '+' : ''}{entry.delta}
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
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
            Cell Memberships ({(memberships ?? []).length})
          </p>
          {(memberships ?? []).length === 0 ? (
            <p className="font-mono text-xs text-olive">No memberships.</p>
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
                {(memberships ?? [])
                  .filter((m) => m.cells)
                  .map((m, i) => (
                    <tr key={i} className={i < (memberships ?? []).length - 1 ? 'border-b border-near-black/10' : ''}>
                      <td className="px-4 py-2.5">
                        <Link href={`/cells/${m.cells!.slug}`} className="font-body text-sm hover:text-accent-red transition-colors">
                          {m.cells!.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-olive">{m.role}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-olive">{m.cells!.current_stage}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`font-mono text-xs ${m.status !== 'ACTIVE' ? 'text-accent-red' : 'text-olive'}`}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Submissions */}
        <section className="mb-10">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
            Submissions ({(submissions ?? []).length})
          </p>
          {(submissions ?? []).length === 0 ? (
            <p className="font-mono text-xs text-olive">No submissions.</p>
          ) : (
            <table className="w-full border border-near-black/20">
              <thead>
                <tr className="border-b border-near-black/20">
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Title</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Cell</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Status</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Cycle</th>
                </tr>
              </thead>
              <tbody>
                {(submissions ?? []).map((s, i) => (
                  <tr key={i} className={i < (submissions ?? []).length - 1 ? 'border-b border-near-black/10' : ''}>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs">{s.title ?? '(untitled)'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.cells && (
                        <Link href={`/cells/${s.cells.slug}`} className="font-mono text-xs text-olive hover:text-near-black transition-colors">
                          {s.cells.title}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono text-xs ${s.status === 'ACCEPTED' ? 'text-near-black' : s.status === 'REJECTED' ? 'text-accent-red' : 'text-olive'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-olive">{s.cycle}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Retrospective appearances */}
        {(retroAppearances ?? []).length > 0 && (
          <section className="mb-10">
            <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
              Retrospective Appearances ({(retroAppearances ?? []).length})
            </p>
            <table className="w-full border border-near-black/20">
              <thead>
                <tr className="border-b border-near-black/20">
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Episode</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Cell</th>
                  <th className="text-left font-mono text-xs text-olive px-4 py-2 font-normal">Persona</th>
                </tr>
              </thead>
              <tbody>
                {(retroAppearances ?? [])
                  .filter((r) => r.retrospectives)
                  .map((r, i) => (
                    <tr key={i} className={i < (retroAppearances ?? []).length - 1 ? 'border-b border-near-black/10' : ''}>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs">
                          {r.retrospectives?.episode_title ?? `Cycle ${r.retrospectives?.cycle}`}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {r.retrospectives?.cells && (
                          <Link
                            href={`/cells/${r.retrospectives.cells.slug}/retrospective/${r.retrospectives.cycle}`}
                            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
                          >
                            {r.retrospectives.cells.title} →
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-olive italic">{r.voice_persona}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Danger zone */}
        {!isSelf && (
          <section className="border border-accent-red p-5">
            <p className="font-mono text-xs uppercase tracking-widest text-accent-red mb-4">Danger Zone</p>
            <AdminUserActions
              userId={profile.id}
              username={profile.username}
              isAdmin={profile.is_admin}
              isSuspended={!!profile.suspended_at}
              showDelete
            />
          </section>
        )}
      </main>
    </div>
  )
}
