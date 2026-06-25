import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TriggerBriefingForm } from '@/components/cell/TriggerBriefingForm'
import { AdvanceToEditingForm } from '@/components/submission/AdvanceToEditingForm'
import { AdvanceToCompleteForm } from '@/components/promotion/AdvanceToCompleteForm'
import { DeadlineCounter } from '@/components/cell/DeadlineCounter'
import { JoinCellButton } from '@/components/cell/JoinCellButton'
import { GenerateRetrospectiveButton } from '@/components/retrospective/GenerateRetrospectiveButton'
import type { EzineStrategyConfig } from '@/lib/strategies/ezine'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data } = await supabase
    .from('cells')
    .select('title')
    .eq('slug', params.slug)
    .single() as { data: { title: string } | null; error: unknown }
  return { title: data ? `${data.title} — Quorum` : 'Cell — Quorum' }
}

type RawCell = {
  id: string
  slug: string
  title: string
  description: string | null
  strategy_id: string
  strategy_config: unknown
  status: string
  current_stage: string
  stage_deadline: string | null
  member_cap: number
  min_members: number
  current_cycle: number
  is_recurring: boolean
  owner_id: string
  created_at: string
}

type RawMember = {
  id: string
  user_id: string
  role: string
  status: string
  joined_at: string
  profiles: { username: string; display_name: string | null; merit_score: number } | null
}

const STAGE_LABELS: Record<string, string> = {
  FORMING: 'Forming',
  BRIEFING: 'Briefing',
  SUBMISSION: 'Submission',
  EDITING: 'Editing',
  PROMOTION: 'Promotion',
  COMPLETE: 'Complete',
}

const STAGE_ORDER = ['FORMING', 'BRIEFING', 'SUBMISSION', 'EDITING', 'PROMOTION', 'COMPLETE']

export default async function CellPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: cell } = await supabase
    .from('cells')
    .select('*')
    .eq('slug', params.slug)
    .single() as { data: RawCell | null; error: unknown }

  if (!cell) notFound()

  const { data: members } = await supabase
    .from('cell_members')
    .select('id, user_id, role, status, joined_at, profiles(username, display_name, merit_score)')
    .eq('cell_id', cell.id)
    .order('joined_at', { ascending: true }) as { data: RawMember[] | null; error: unknown }

  // Current user's display name and admin status
  let userDisplayName: string | null = null
  let isAdmin = false
  if (user) {
    const { data: p } = await supabase
      .from('profiles')
      .select('display_name, username, is_admin')
      .eq('id', user.id)
      .single() as { data: { display_name: string | null; username: string; is_admin: boolean } | null; error: unknown }
    userDisplayName = p?.display_name ?? p?.username ?? null
    isAdmin = p?.is_admin ?? false
  }

  const config = cell.strategy_config as EzineStrategyConfig
  const activeMembers = (members ?? []).filter((m) => m.status === 'ACTIVE')
  const memberCount = activeMembers.length
  const isOwner = user?.id === cell.owner_id
  const currentUserMember = members?.find((m) => m.user_id === user?.id && m.status === 'ACTIVE')
  const isMember = !!currentUserMember
  const isEditor = currentUserMember?.role === 'EDITOR'
  const isIllustrator = currentUserMember?.role === 'ILLUSTRATOR'

  // Find the elected editor and illustrator
  const editorMember = members?.find((m) => m.role === 'EDITOR' && m.status === 'ACTIVE')
  const illustratorMember = members?.find((m) => m.role === 'ILLUSTRATOR' && m.status === 'ACTIVE')

  // Quorum state (FORMING)
  const quorumMet = memberCount >= cell.min_members
  const capReached = memberCount >= cell.member_cap
  const quorumPct = Math.min(100, Math.round((memberCount / cell.min_members) * 100))

  // Retrospective availability (COMPLETE stage)
  let retroStatus: 'GENERATING' | 'READY' | 'FAILED' | null = null
  if (cell.current_stage === 'COMPLETE') {
    const { data: retro } = await supabase
      .from('retrospectives')
      .select('status')
      .eq('cell_id', cell.id)
      .eq('cycle', cell.current_cycle)
      .maybeSingle() as { data: { status: 'GENERATING' | 'READY' | 'FAILED' } | null; error: unknown }
    retroStatus = retro?.status ?? null
  }

  return (
    <div className="px-10 py-8">

        {/* Title */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-1">
            <h1 className="font-serif-display text-4xl">{cell.title}</h1>
            <div className="flex items-center gap-3 mt-2 shrink-0">
              <span className="font-mono text-xs text-olive">EZINE_V1</span>
              {isOwner && cell.current_stage === 'FORMING' && (
                <Link
                  href={`/cells/${cell.slug}/settings`}
                  className="font-mono text-xs border border-near-black/30 px-3 py-1 hover:border-near-black transition-colors"
                >
                  Settings
                </Link>
              )}
            </div>
          </div>
          {cell.description && (
            <p className="font-body text-base text-near-black/70 mt-2 leading-relaxed max-w-2xl">
              {cell.description}
            </p>
          )}
        </div>

        {/* ── FORMING stage panel ───────────────────────────── */}
        {cell.current_stage === 'FORMING' && (
          <div className="border border-near-black/20 px-6 py-6 mb-6">
            <p className="font-mono text-xs uppercase tracking-widest text-olive mb-5">
              Forming
            </p>

            {/* Quorum bar */}
            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-mono text-xs text-olive">
                  Members: <span className="text-near-black">{memberCount}</span> of {cell.min_members} needed
                  <span className="text-olive/50"> (cap: {cell.member_cap})</span>
                </span>
                {quorumMet && (
                  <span className="font-mono text-xs text-near-black">Quorum met</span>
                )}
              </div>
              <div className="w-full h-1.5 bg-near-black/10 relative">
                <div
                  className={`absolute left-0 top-0 h-1.5 transition-all ${quorumMet ? 'bg-near-black' : 'bg-olive/50'}`}
                  style={{ width: `${quorumPct}%` }}
                />
                {/* Quorum marker */}
                <div className="absolute top-0 h-1.5 w-px bg-near-black/40" style={{ left: '100%' }} />
              </div>
            </div>

            {/* Merit requirement */}
            <p className="font-mono text-xs text-olive mb-5">
              Merit required to join: <span className="text-near-black">{config.min_merit_to_join}</span>
              {cell.stage_deadline && (
                <>
                  {' · '}
                  <DeadlineCounter deadline={cell.stage_deadline} />
                </>
              )}
            </p>

            {/* Non-member: join prompt */}
            {!isMember && !capReached && user && (
              <div className="border-t border-near-black/10 pt-5">
                <JoinCellButton cellId={cell.id} />
              </div>
            )}
            {!isMember && !capReached && !user && (
              <div className="border-t border-near-black/10 pt-5">
                <Link
                  href={`/login?next=/cells/${cell.slug}`}
                  className="font-mono text-xs border border-near-black px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors"
                >
                  Sign in to join →
                </Link>
              </div>
            )}

            {/* Owner trigger */}
            {isOwner && quorumMet && (
              <div className="border-t border-near-black/10 pt-5">
                <p className="font-mono text-xs text-olive mb-3">
                  Quorum is met. You can start Briefing now, or wait for more members.
                </p>
                <TriggerBriefingForm cellId={cell.id} />
              </div>
            )}
            {isOwner && !quorumMet && (
              <p className="font-mono text-xs text-olive">
                Briefing starts automatically when {cell.min_members} members join, or when the forming deadline passes (if quorum has been met).
              </p>
            )}
            {!isOwner && !quorumMet && isMember && (
              <p className="font-mono text-xs text-olive">
                Waiting for {cell.min_members - memberCount} more member{cell.min_members - memberCount !== 1 ? 's' : ''} before Briefing begins.
              </p>
            )}
            {capReached && (
              <p className="font-mono text-xs text-near-black mt-2">
                Member cap reached. Briefing will start automatically.
              </p>
            )}
          </div>
        )}

        {/* ── BRIEFING stage panel ──────────────────────────── */}
        {cell.current_stage === 'BRIEFING' && (
          <div className={`border px-6 py-6 mb-6 ${isEditor ? 'border-accent-red' : 'border-near-black/20'}`}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <p className="font-mono text-xs uppercase tracking-widest text-olive">Briefing</p>
              {cell.stage_deadline && <DeadlineCounter deadline={cell.stage_deadline} />}
            </div>

            {/* Editor identity */}
            {editorMember ? (
              <div className="mb-4">
                <p className="font-mono text-xs text-olive mb-1">Elected Editor</p>
                <div className="flex items-center gap-3">
                  <span className="font-serif-display text-lg">
                    {editorMember.profiles?.display_name ?? editorMember.profiles?.username ?? 'Unknown'}
                  </span>
                  <span className="font-mono text-xs text-olive">
                    merit {editorMember.profiles?.merit_score ?? '—'}
                  </span>
                  {isEditor && (
                    <span className="font-mono text-xs text-accent-red border border-accent-red px-2 py-0.5">
                      you
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="font-mono text-xs text-olive mb-4">Editor election pending…</p>
            )}

            {illustratorMember && (
              <div className="mb-4">
                <p className="font-mono text-xs text-olive mb-1">Elected Illustrator</p>
                <div className="flex items-center gap-3">
                  <span className="font-serif-display text-base">
                    {illustratorMember.profiles?.display_name ?? illustratorMember.profiles?.username ?? 'Unknown'}
                  </span>
                  {isIllustrator && (
                    <span className="font-mono text-xs text-accent-red border border-accent-red px-2 py-0.5">
                      you
                    </span>
                  )}
                </div>
              </div>
            )}

            <p className="font-mono text-xs text-olive mb-1">
              Word count: {config.word_count_min}–{config.word_count_max} words ·{' '}
              {config.briefing_window_days}-day window
            </p>

            {/* Editor CTA */}
            {isEditor && (
              <div className="mt-5 border-t border-accent-red/20 pt-5">
                <p className="font-mono text-xs text-near-black mb-3">
                  You are the Editor for this cycle. Publish a Brief to open submissions.
                </p>
                <Link
                  href={`/cells/${cell.slug}/brief`}
                  className="font-mono text-xs bg-accent-red text-off-white border border-accent-red px-5 py-2.5 hover:bg-near-black hover:border-near-black transition-colors"
                >
                  Publish Brief →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Active stage panels (non-FORMING/BRIEFING) ───── */}
        {!['FORMING', 'BRIEFING'].includes(cell.current_stage) && (
          <div className="border border-near-black/20 px-6 py-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-xs uppercase tracking-widest text-olive">
                {STAGE_LABELS[cell.current_stage]}
              </p>
              {cell.stage_deadline && <DeadlineCounter deadline={cell.stage_deadline} />}
            </div>
            <div className="flex gap-3 flex-wrap">
              {cell.current_stage === 'SUBMISSION' && isMember && !isEditor && (
                <Link href={`/cells/${cell.slug}/submit`} className="font-mono text-xs border border-near-black px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors">
                  Submit Article →
                </Link>
              )}
              {cell.current_stage === 'SUBMISSION' && isMember && (
                <Link href={`/cells/${cell.slug}/brief`} className="font-mono text-xs border border-near-black/30 px-4 py-2 hover:border-near-black transition-colors">
                  View Brief →
                </Link>
              )}
              {cell.current_stage === 'SUBMISSION' && isEditor && (
                <AdvanceToEditingForm cellId={cell.id} />
              )}
              {cell.current_stage === 'EDITING' && isEditor && (
                <Link href={`/cells/${cell.slug}/edit`} className="font-mono text-xs bg-near-black text-off-white border border-near-black px-4 py-2 hover:bg-accent-red hover:border-accent-red transition-colors">
                  Editorial Workspace →
                </Link>
              )}
              {cell.current_stage === 'EDITING' && (isEditor || isOwner || isAdmin) && (
                <Link href={`/cells/${cell.slug}/layout/${cell.current_cycle}`} className="font-mono text-xs border border-near-black px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors">
                  Layout Editor →
                </Link>
              )}
              {cell.current_stage === 'PROMOTION' && isMember && (
                <Link href={`/cells/${cell.slug}/promote`} className="font-mono text-xs border border-near-black px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors">
                  Submit Promotion Evidence →
                </Link>
              )}
              {(cell.current_stage === 'PROMOTION' || cell.current_stage === 'COMPLETE') && (
                <>
                  <Link href={`/cells/${cell.slug}/publication/${cell.current_cycle}`} className="font-mono text-xs border border-near-black/30 px-4 py-2 hover:border-near-black transition-colors">
                    View Publication →
                  </Link>
                  {(isEditor || isOwner || isAdmin) && (
                    <Link href={`/cells/${cell.slug}/layout/${cell.current_cycle}`} className="font-mono text-xs border border-near-black/30 px-4 py-2 hover:border-near-black text-olive hover:text-near-black transition-colors">
                      Layout Editor
                    </Link>
                  )}
                </>
              )}
              {cell.current_stage === 'PROMOTION' && isOwner && (
                <AdvanceToCompleteForm cellId={cell.id} />
              )}
              {cell.current_stage === 'COMPLETE' && (isOwner || isAdmin) && (
                <GenerateRetrospectiveButton
                  cellId={cell.id}
                  cellSlug={cell.slug}
                  cycle={cell.current_cycle}
                  existingStatus={retroStatus}
                />
              )}
              {(isEditor || isOwner || isAdmin) && ['EDITING', 'PROMOTION', 'COMPLETE'].includes(cell.current_stage) && (
                <Link href={`/cells/${cell.slug}/settings/design`} className="font-mono text-xs border border-near-black/30 px-4 py-2 hover:border-near-black text-olive hover:text-near-black transition-colors">
                  House Style
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Status summary ────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-0 border border-near-black/20 mb-6">
          {[
            { label: 'Stage', value: STAGE_LABELS[cell.current_stage] ?? cell.current_stage },
            { label: 'Members', value: `${memberCount}/${cell.member_cap}` },
            { label: 'Cycle', value: String(cell.current_cycle) },
          ].map((item, i) => (
            <div key={item.label} className={`px-4 py-3 ${i < 2 ? 'border-r border-near-black/20' : ''}`}>
              <p className="font-mono text-xs text-olive mb-1">{item.label}</p>
              <p className="font-serif-display text-lg">{item.value}</p>
            </div>
          ))}
        </div>

        {/* ── Member table ──────────────────────────────────── */}
        <div className="border border-near-black/20 mb-10" data-demo-highlight="member-list">
          <div className="px-5 py-3 border-b border-near-black/20 flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-widest text-olive">Members</p>
            <span className="font-mono text-xs text-olive">{memberCount}/{cell.member_cap}</span>
          </div>
          {(members ?? []).length === 0 ? (
            <p className="font-mono text-xs text-olive px-5 py-4">No members yet.</p>
          ) : (
            <table className="w-full">
              <tbody>
                {(members ?? []).map((m, i) => {
                  const isLast = i === (members?.length ?? 0) - 1
                  const roleStyle =
                    m.role === 'EDITOR' ? 'text-accent-red' :
                    m.role === 'ILLUSTRATOR' ? 'text-near-black' :
                    'text-olive'
                  return (
                    <tr key={m.id} className={!isLast ? 'border-b border-near-black/10' : ''}>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/profile/${m.profiles?.username ?? m.user_id}`}
                            className="font-body text-sm hover:text-accent-red transition-colors"
                          >
                            {m.profiles?.display_name ?? m.profiles?.username ?? 'Unknown'}
                          </Link>
                          {m.user_id === user?.id && (
                            <span className="font-mono text-xs text-olive">(you)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className={`font-mono text-xs ${roleStyle}`}>{m.role}</span>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {m.status !== 'ACTIVE' && (
                          <span className="font-mono text-xs text-accent-red">{m.status}</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span className="font-mono text-xs text-olive">
                          {m.profiles?.merit_score ?? '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

    </div>
  )
}
