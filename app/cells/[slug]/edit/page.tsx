import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EditorReviewPanel } from '@/components/submission/EditorReviewPanel'
import { PublicationAssembly } from '@/components/publication/PublicationAssembly'
import { DeadlineCounter } from '@/components/cell/DeadlineCounter'

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  REWORK_REQUESTED: 'Rework',
  DRAFT: 'Draft',
}

const STATUS_COLOR: Record<string, string> = {
  SUBMITTED: 'text-accent-red',
  ACCEPTED: 'text-near-black',
  REJECTED: 'text-olive',
  REWORK_REQUESTED: 'text-accent-red',
  DRAFT: 'text-olive',
}

export default async function EditPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/cells/${params.slug}/edit`)

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
    current_cycle: number
    strategy_config: { min_submissions_required: number }
  }
  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title, current_stage, stage_deadline, current_cycle, strategy_config')
    .eq('slug', params.slug)
    .single() as { data: CellRow | null; error: unknown }

  if (!cell) redirect('/cells')

  // Editor only
  const { data: membership } = await supabase
    .from('cell_members')
    .select('role')
    .eq('cell_id', cell.id)
    .eq('user_id', user.id)
    .single() as { data: { role: string } | null; error: unknown }

  if (!membership || membership.role !== 'EDITOR') redirect(`/cells/${params.slug}`)
  if (cell.current_stage !== 'EDITING') redirect(`/cells/${params.slug}`)

  // Load brief
  type BriefRow = {
    id: string
    title: string
    theme: string
    word_count_min: number
    word_count_max: number
    slots: number
    deadline: string
  }
  const { data: brief } = await supabase
    .from('briefs')
    .select('id, title, theme, word_count_min, word_count_max, slots, deadline')
    .eq('cell_id', cell.id)
    .eq('cycle', cell.current_cycle)
    .maybeSingle() as { data: BriefRow | null; error: unknown }

  // Load submissions with author profiles
  type SubmissionRow = {
    id: string
    title: string | null
    body: string | null
    word_count: number | null
    status: string
    editor_note: string | null
    submitted_at: string | null
    author_id: string
    profiles: { username: string; display_name: string | null } | null
  }
  let submissions: (SubmissionRow & { username: string; display_name: string | null })[] = []

  if (brief) {
    const subQuery = supabase
      .from('submissions')
      .select(
        'id, title, body, word_count, status, editor_note, submitted_at, author_id, profiles(username, display_name)'
      )
      .eq('brief_id', brief.id)
      .order('submitted_at', { ascending: true }) as unknown as Promise<{
      data: SubmissionRow[] | null
      error: unknown
    }>
    const { data: rawSubs } = await subQuery
    submissions = (rawSubs ?? []).map((s: SubmissionRow) => ({
      ...s,
      username: s.profiles?.username ?? s.author_id,
      display_name: s.profiles?.display_name ?? null,
    }))
  }

  const minRequired = cell.strategy_config.min_submissions_required

  const pending = submissions.filter((s) => s.status === 'SUBMITTED')
  const accepted = submissions.filter((s) => s.status === 'ACCEPTED')
  const rejected = submissions.filter((s) => s.status === 'REJECTED')
  const rework = submissions.filter((s) => s.status === 'REWORK_REQUESTED')

  const shortfall = accepted.length < minRequired

  // Load existing publication for this cycle
  const { data: publication } = await supabase
    .from('publications')
    .select('id, status')
    .eq('cell_id', cell.id)
    .eq('cycle', cell.current_cycle)
    .maybeSingle() as { data: { id: string; status: string } | null; error: unknown }

  const assemblySubmissions = accepted.map((s) => ({
    id: s.id,
    title: s.title,
    author: s.display_name ?? s.username,
    word_count: s.word_count,
  }))

  return (
    <div className="px-10 py-8">
        <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
          Cycle {cell.current_cycle} — Editorial Workspace
        </p>

        <div className="flex items-baseline justify-between mb-8">
          <h1 className="font-serif-display text-4xl">Review Submissions</h1>
          {cell.stage_deadline && <DeadlineCounter deadline={cell.stage_deadline} />}
        </div>

        {brief && (
          <div className="border border-near-black/20 px-5 py-4 mb-8 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-olive mb-0.5">Brief</p>
              <p className="font-serif-display text-lg">{brief.title}</p>
            </div>
            <Link
              href={`/cells/${params.slug}/brief`}
              className="font-mono text-xs text-olive hover:text-near-black transition-colors shrink-0"
            >
              View →
            </Link>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-4 gap-0 border border-near-black/20 mb-8">
          {[
            { label: 'Pending', value: pending.length + rework.length },
            { label: 'Accepted', value: accepted.length },
            { label: 'Rejected', value: rejected.length },
            { label: 'Required', value: minRequired },
          ].map((item, i) => (
            <div
              key={item.label}
              className={`px-4 py-3 ${i < 3 ? 'border-r border-near-black/20' : ''}`}
            >
              <p className="font-mono text-xs text-olive mb-1">{item.label}</p>
              <p className="font-serif-display text-xl">{item.value}</p>
            </div>
          ))}
        </div>

        {shortfall && submissions.length > 0 && (
          <div className="border border-accent-red/40 px-5 py-3 mb-8">
            <p className="font-mono text-xs text-accent-red">
              Warning: Only {accepted.length} article{accepted.length !== 1 ? 's' : ''} accepted.
              Minimum required: {minRequired}.
            </p>
          </div>
        )}

        {/* Publication Assembly */}
        <div className="border border-near-black/20 px-6 py-6 mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
            Publication Assembly
          </p>
          {publication ? (
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-near-black">
                Issue published.
              </p>
              <Link
                href={`/cells/${params.slug}/publication/${cell.current_cycle}`}
                className="font-mono text-xs border border-near-black px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors"
              >
                View Publication →
              </Link>
            </div>
          ) : (
            <PublicationAssembly
              cellId={cell.id}
              briefId={brief?.id ?? ''}
              acceptedSubmissions={assemblySubmissions}
            />
          )}
        </div>

        {/* Submissions list */}
        {submissions.length === 0 ? (
          <div className="border border-near-black/20 px-6 py-6">
            <p className="font-mono text-xs text-olive">No submissions received for this brief.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0 border border-near-black/20">
            {submissions.map((sub, i) => {
              const isLast = i === submissions.length - 1
              const excerpt = sub.body
                ? sub.body.slice(0, 400) + (sub.body.length > 400 ? '…' : '')
                : null

              return (
                <div
                  key={sub.id}
                  className={`px-6 py-6 ${!isLast ? 'border-b border-near-black/20' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="font-serif-display text-lg mb-0.5">
                        {sub.title ?? '(untitled)'}
                      </p>
                      <p className="font-mono text-xs text-olive">
                        {sub.display_name ?? sub.username} ·{' '}
                        {sub.word_count ? `${sub.word_count} words` : '—'} ·{' '}
                        {sub.submitted_at
                          ? new Date(sub.submitted_at).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-xs shrink-0 ${STATUS_COLOR[sub.status] ?? 'text-olive'}`}
                    >
                      {STATUS_LABEL[sub.status] ?? sub.status}
                    </span>
                  </div>

                  {excerpt && (
                    <p className="font-body text-sm text-near-black/70 leading-relaxed mb-3 whitespace-pre-wrap">
                      {excerpt}
                    </p>
                  )}

                  {sub.editor_note && sub.status !== 'SUBMITTED' && (
                    <div className="border-l-2 border-near-black/20 pl-4 mb-3">
                      <p className="font-mono text-xs text-olive mb-1">Your note</p>
                      <p className="font-mono text-xs text-near-black/70 whitespace-pre-wrap">
                        {sub.editor_note}
                      </p>
                    </div>
                  )}

                  <EditorReviewPanel
                    submissionId={sub.id}
                    currentStatus={sub.status}
                  />
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}
