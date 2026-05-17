import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BriefForm } from '@/components/brief/BriefForm'
import { InvitationResponse } from '@/components/brief/InvitationResponse'
import { InviteAdditionalMember } from '@/components/brief/InviteAdditionalMember'
import type { EzineStrategyConfig } from '@/lib/strategies/ezine'
import { StageTimeline } from '@/components/cell/StageTimeline'
import { DeadlineCounter } from '@/components/cell/DeadlineCounter'

const ARCHIVED_STAGES = ['EDITING', 'PROMOTION', 'COMPLETE', 'ABANDONED']

export default async function BriefPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/cells/${params.slug}/brief`)

  const { data: cp } = await supabase
    .from('profiles').select('display_name, username').eq('id', user.id).single() as
    { data: { display_name: string | null; username: string } | null; error: unknown }
  const userDisplayName = cp?.display_name ?? cp?.username ?? null

  type CellRow = {
    id: string
    slug: string
    title: string
    current_stage: string
    stage_deadline: string | null
    strategy_config: EzineStrategyConfig
    current_cycle: number
  }
  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title, current_stage, stage_deadline, strategy_config, current_cycle')
    .eq('slug', params.slug)
    .single() as { data: CellRow | null; error: unknown }

  if (!cell) redirect('/cells')

  const { data: membership } = await supabase
    .from('cell_members')
    .select('role, status')
    .eq('cell_id', cell.id)
    .eq('user_id', user.id)
    .maybeSingle() as { data: { role: string; status: string } | null; error: unknown }

  if (!membership) redirect(`/cells/${params.slug}`)

  const isEditor = membership.role === 'EDITOR'
  const config = cell.strategy_config
  const stage = cell.current_stage

  type MemberRow = {
    user_id: string
    role: string
    profiles: { username: string; display_name: string | null } | null
  }
  const membersQuery = supabase
    .from('cell_members')
    .select('user_id, role, profiles(username, display_name)')
    .eq('cell_id', cell.id)
    .eq('status', 'ACTIVE') as unknown as Promise<{ data: MemberRow[] | null; error: unknown }>
  const { data: rawMembers } = await membersQuery

  const members = (rawMembers ?? []).map((m: MemberRow) => ({
    user_id: m.user_id,
    role: m.role,
    username: m.profiles?.username ?? m.user_id,
    display_name: m.profiles?.display_name ?? null,
  }))

  type BriefRow = {
    id: string
    title: string
    theme: string
    guidance: string
    word_count_min: number
    word_count_max: number
    slots: number
    deadline: string
    editor_id: string
    published_at: string
    cycle: number
  }
  const { data: brief } = await supabase
    .from('briefs')
    .select(
      'id, title, theme, guidance, word_count_min, word_count_max, slots, deadline, editor_id, published_at, cycle'
    )
    .eq('cell_id', cell.id)
    .eq('cycle', cell.current_cycle)
    .maybeSingle() as { data: BriefRow | null; error: unknown }

  type InvitationRow = {
    id: string
    invitee_id: string
    status: string
    profiles: { username: string; display_name: string | null } | null
  }

  let invitations: (InvitationRow & { username: string; display_name: string | null })[] = []
  let myInvitation: (InvitationRow & { username: string; display_name: string | null }) | null =
    null

  if (brief) {
    const invQuery = supabase
      .from('invitations')
      .select('id, invitee_id, status, profiles(username, display_name)')
      .eq('brief_id', brief.id) as unknown as Promise<{ data: InvitationRow[] | null; error: unknown }>
    const { data: rawInvitations } = await invQuery

    invitations = (rawInvitations ?? []).map((inv: InvitationRow) => ({
      ...inv,
      username: inv.profiles?.username ?? inv.invitee_id,
      display_name: inv.profiles?.display_name ?? null,
    }))
    myInvitation = invitations.find((inv) => inv.invitee_id === user.id) ?? null
  }

  const invitedIds = new Set(invitations.map((inv) => inv.invitee_id))
  const uninvitedMembers = members.filter(
    (m) => !invitedIds.has(m.user_id) && m.user_id !== user.id
  )

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <div className="flex items-center gap-6">
          {userDisplayName && (
            <span className="font-mono text-xs text-olive">{userDisplayName}</span>
          )}
          <Link
            href={`/cells/${params.slug}`}
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            ← {cell.title}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-8 py-12 max-w-3xl">
        <div className="mb-8">
          <StageTimeline currentStage={cell.current_stage} />
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
          Cycle {cell.current_cycle} — Brief
        </p>

        {/* ── BRIEFING ─────────────────────────────────────────────────────── */}
        {stage === 'BRIEFING' && (
          <>
            {isEditor ? (
              <>
                <h1 className="font-serif-display text-4xl mb-2">Publish Brief</h1>
                <p className="font-mono text-xs text-near-black/60 mb-1">
                  You are the elected Editor for this cycle.
                </p>
                {cell.stage_deadline && (
                  <p className="font-mono text-xs mb-8">
                    <DeadlineCounter deadline={cell.stage_deadline} prefix="Deadline:" />
                  </p>
                )}
                <BriefForm
                  cellId={cell.id}
                  members={members.filter((m) => m.user_id !== user.id)}
                  minInvites={config.min_submissions_required}
                  wordCountMin={config.word_count_min}
                  wordCountMax={config.word_count_max}
                />
              </>
            ) : (
              <>
                <h1 className="font-serif-display text-4xl mb-4">Awaiting Brief</h1>
                <p className="font-mono text-sm text-near-black/60 mb-4">
                  The Editor is preparing the brief for this cycle.
                </p>
                {cell.stage_deadline && (
                  <DeadlineCounter deadline={cell.stage_deadline} prefix="Editor deadline:" />
                )}
              </>
            )}
          </>
        )}

        {/* ── SUBMISSION ───────────────────────────────────────────────────── */}
        {stage === 'SUBMISSION' && brief && (
          <>
            <h1 className="font-serif-display text-4xl mb-1">{brief.title}</h1>
            {cell.stage_deadline && (
              <p className="font-mono text-xs mb-8">
                <DeadlineCounter deadline={cell.stage_deadline} prefix="Submissions close:" />
              </p>
            )}

            <div className="border-t border-near-black/20 pt-6 mb-8">
              <p className="font-mono text-xs uppercase tracking-widest text-olive mb-1">Theme</p>
              <p className="font-body text-base mb-6">{brief.theme}</p>

              <p className="font-mono text-xs uppercase tracking-widest text-olive mb-1">
                Editorial Guidance
              </p>
              <p className="font-body text-base whitespace-pre-wrap mb-6">{brief.guidance}</p>

              <p className="font-mono text-xs text-olive">
                Word count: {brief.word_count_min}–{brief.word_count_max} words &middot;{' '}
                {brief.slots} slot{brief.slots !== 1 ? 's' : ''}
              </p>
            </div>

            {myInvitation && (
              <div className="border border-near-black/20 px-6 py-5 mb-8">
                <p className="font-mono text-xs uppercase tracking-widest text-olive mb-3">
                  Your Invitation
                </p>
                {myInvitation.status === 'PENDING' && (
                  <>
                    <p className="font-mono text-sm mb-4">
                      You have been invited to submit an article for this issue.
                    </p>
                    <InvitationResponse invitationId={myInvitation.id} />
                  </>
                )}
                {myInvitation.status === 'ACCEPTED' && (
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-sm">Accepted — your submission is expected.</p>
                    <Link
                      href={`/cells/${params.slug}/submit`}
                      className="font-mono text-xs border border-near-black px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors"
                    >
                      Submit Article →
                    </Link>
                  </div>
                )}
                {myInvitation.status === 'DECLINED' && (
                  <p className="font-mono text-sm text-olive">You declined this invitation.</p>
                )}
              </div>
            )}

            {!myInvitation && !isEditor && (
              <div className="border border-near-black/20 px-6 py-5 mb-8">
                <p className="font-mono text-xs text-olive">
                  You have not been invited to submit this cycle.
                </p>
              </div>
            )}

            {isEditor && (
              <div className="border border-near-black/20 px-6 py-6">
                <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
                  Invitations
                </p>

                {invitations.length > 0 ? (
                  <table className="w-full font-mono text-xs mb-6">
                    <thead>
                      <tr className="border-b border-near-black/20">
                        <th className="text-left py-2 font-normal text-olive">Member</th>
                        <th className="text-left py-2 font-normal text-olive">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitations.map((inv) => (
                        <tr key={inv.id} className="border-b border-near-black/10">
                          <td className="py-2">{inv.display_name ?? inv.username}</td>
                          <td
                            className={`py-2 ${
                              inv.status === 'ACCEPTED'
                                ? 'text-near-black'
                                : inv.status === 'DECLINED'
                                  ? 'text-olive'
                                  : 'text-accent-red'
                            }`}
                          >
                            {inv.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="font-mono text-xs text-olive mb-6">No invitations sent yet.</p>
                )}

                {invitations.length < brief.slots && uninvitedMembers.length > 0 && (
                  <InviteAdditionalMember briefId={brief.id} availableMembers={uninvitedMembers} />
                )}
                {invitations.filter((i) => i.status !== 'DECLINED').length >= brief.slots && (
                  <p className="font-mono text-xs text-olive">
                    All {brief.slots} slot{brief.slots !== 1 ? 's' : ''} filled.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ── ARCHIVED ─────────────────────────────────────────────────────── */}
        {ARCHIVED_STAGES.includes(stage) && brief && (
          <>
            <p className="font-mono text-xs text-olive mb-2">Archived — Cycle {brief.cycle}</p>
            <h1 className="font-serif-display text-4xl mb-6">{brief.title}</h1>

            <div className="border-t border-near-black/20 pt-6 mb-8">
              <p className="font-mono text-xs uppercase tracking-widest text-olive mb-1">Theme</p>
              <p className="font-body text-base mb-6">{brief.theme}</p>

              <p className="font-mono text-xs uppercase tracking-widest text-olive mb-1">
                Editorial Guidance
              </p>
              <p className="font-body text-base whitespace-pre-wrap mb-6">{brief.guidance}</p>

              <p className="font-mono text-xs text-olive">
                Word count: {brief.word_count_min}–{brief.word_count_max} words &middot;{' '}
                {brief.slots} slot{brief.slots !== 1 ? 's' : ''}
              </p>
            </div>

            {invitations.length > 0 && (
              <div className="border border-near-black/20 px-6 py-5">
                <p className="font-mono text-xs uppercase tracking-widest text-olive mb-3">
                  Invitations
                </p>
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-near-black/20">
                      <th className="text-left py-2 font-normal text-olive">Member</th>
                      <th className="text-left py-2 font-normal text-olive">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="border-b border-near-black/10">
                        <td className="py-2">{inv.display_name ?? inv.username}</td>
                        <td
                          className={`py-2 ${inv.status === 'ACCEPTED' ? 'text-near-black' : 'text-olive'}`}
                        >
                          {inv.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!brief && !['BRIEFING', 'FORMING'].includes(stage) && (
          <div className="border border-near-black/20 px-6 py-6">
            <p className="font-mono text-xs text-olive">No brief was published for this cycle.</p>
          </div>
        )}
      </main>
    </div>
  )
}
