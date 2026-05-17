import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SubmissionForm } from '@/components/submission/SubmissionForm'
import { ResubmitForm } from '@/components/submission/ResubmitForm'
import { StageTimeline } from '@/components/cell/StageTimeline'
import { DeadlineCounter } from '@/components/cell/DeadlineCounter'

export default async function SubmitPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/cells/${params.slug}/submit`)

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
  }
  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title, current_stage, stage_deadline, current_cycle')
    .eq('slug', params.slug)
    .single() as { data: CellRow | null; error: unknown }

  if (!cell) redirect('/cells')

  // Must be an active member
  const { data: membership } = await supabase
    .from('cell_members')
    .select('role, status')
    .eq('cell_id', cell.id)
    .eq('user_id', user.id)
    .maybeSingle() as { data: { role: string; status: string } | null; error: unknown }

  if (!membership || membership.status !== 'ACTIVE') redirect(`/cells/${params.slug}`)

  // Load current brief
  type BriefRow = {
    id: string
    title: string
    theme: string
    word_count_min: number
    word_count_max: number
    deadline: string
  }
  const { data: brief } = await supabase
    .from('briefs')
    .select('id, title, theme, word_count_min, word_count_max, deadline')
    .eq('cell_id', cell.id)
    .eq('cycle', cell.current_cycle)
    .maybeSingle() as { data: BriefRow | null; error: unknown }

  // Load invitation
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, status')
    .eq('brief_id', brief?.id ?? '')
    .eq('invitee_id', user.id)
    .maybeSingle() as { data: { id: string; status: string } | null; error: unknown }

  // Load existing submission
  type SubmissionRow = {
    id: string
    title: string | null
    body: string | null
    word_count: number | null
    status: string
    editor_note: string | null
    submitted_at: string | null
  }
  const { data: submission } = brief
    ? await (supabase
        .from('submissions')
        .select('id, title, body, word_count, status, editor_note, submitted_at')
        .eq('brief_id', brief.id)
        .eq('author_id', user.id)
        .maybeSingle() as unknown as Promise<{ data: SubmissionRow | null; error: unknown }>)
    : { data: null }

  const stage = cell.current_stage

  // Determine what to show
  const hasInvitation = !!invitation
  const invitationAccepted = invitation?.status === 'ACCEPTED'
  const canSubmit =
    stage === 'SUBMISSION' && hasInvitation && invitationAccepted && !submission
  const canResubmit =
    stage === 'EDITING' && submission?.status === 'REWORK_REQUESTED'

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
          Cycle {cell.current_cycle} — Submit
        </p>

        {/* Not in a submittable stage */}
        {!['SUBMISSION', 'EDITING'].includes(stage) && (
          <div className="border border-near-black/20 px-6 py-6">
            <p className="font-mono text-xs text-olive">
              Submissions are not currently open (stage: {stage}).
            </p>
          </div>
        )}

        {/* No brief yet */}
        {['SUBMISSION', 'EDITING'].includes(stage) && !brief && (
          <div className="border border-near-black/20 px-6 py-6">
            <p className="font-mono text-xs text-olive">No brief has been published for this cycle.</p>
          </div>
        )}

        {brief && (
          <>
            <h1 className="font-serif-display text-4xl mb-1">{brief.title}</h1>
            <p className="font-mono text-xs text-olive mb-1">{brief.theme}</p>
            {cell.stage_deadline && stage === 'SUBMISSION' && (
              <p className="font-mono text-xs mb-8">
                <DeadlineCounter deadline={cell.stage_deadline} prefix="Deadline:" />
              </p>
            )}
            {stage === 'EDITING' && (
              <p className="font-mono text-xs text-olive mb-8">Submission window has closed.</p>
            )}

            {/* Not invited */}
            {stage === 'SUBMISSION' && !hasInvitation && (
              <div className="border border-near-black/20 px-6 py-5">
                <p className="font-mono text-xs text-olive">
                  You have not been invited to submit this cycle.
                </p>
              </div>
            )}

            {/* Invitation pending */}
            {stage === 'SUBMISSION' && invitation?.status === 'PENDING' && (
              <div className="border border-near-black/20 px-6 py-5">
                <p className="font-mono text-xs text-near-black mb-1">
                  You have a pending invitation.
                </p>
                <p className="font-mono text-xs text-olive">
                  Accept it from the{' '}
                  <Link
                    href={`/cells/${params.slug}/brief`}
                    className="underline hover:text-near-black"
                  >
                    Brief page
                  </Link>{' '}
                  before submitting.
                </p>
              </div>
            )}

            {/* Invitation declined */}
            {stage === 'SUBMISSION' && invitation?.status === 'DECLINED' && (
              <div className="border border-near-black/20 px-6 py-5">
                <p className="font-mono text-xs text-olive">You declined your invitation this cycle.</p>
              </div>
            )}

            {/* Already submitted */}
            {submission && submission.status === 'SUBMITTED' && (
              <div className="border border-near-black/20 px-6 py-6">
                <p className="font-mono text-xs uppercase tracking-widest text-olive mb-3">
                  Submission Received
                </p>
                <p className="font-serif-display text-xl mb-2">
                  {submission.title ?? brief.title}
                </p>
                <p className="font-mono text-xs text-olive mb-4">
                  {submission.word_count} words · submitted{' '}
                  {submission.submitted_at
                    ? new Date(submission.submitted_at).toLocaleDateString()
                    : ''}
                </p>
                <p className="font-mono text-xs text-near-black/60">
                  Your submission is under review.
                </p>
              </div>
            )}

            {/* Accepted */}
            {submission && submission.status === 'ACCEPTED' && (
              <div className="border border-near-black/20 px-6 py-6">
                <p className="font-mono text-xs uppercase tracking-widest text-olive mb-2">
                  Accepted
                </p>
                <p className="font-serif-display text-xl mb-2">
                  {submission.title ?? brief.title}
                </p>
                <p className="font-mono text-xs text-near-black/60">
                  Your article has been accepted for this issue.
                </p>
              </div>
            )}

            {/* Rejected */}
            {submission && submission.status === 'REJECTED' && (
              <div className="border border-near-black/20 px-6 py-6">
                <p className="font-mono text-xs uppercase tracking-widest text-accent-red mb-2">
                  Rejected
                </p>
                {submission.editor_note && (
                  <>
                    <p className="font-mono text-xs uppercase tracking-widest text-olive mb-1 mt-3">
                      Editor Note
                    </p>
                    <p className="font-mono text-sm text-near-black/80 whitespace-pre-wrap">
                      {submission.editor_note}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Rework requested */}
            {submission && submission.status === 'REWORK_REQUESTED' && (
              <div className="mb-8">
                <div className="border border-near-black/20 px-6 py-5 mb-8">
                  <p className="font-mono text-xs uppercase tracking-widest text-accent-red mb-2">
                    Rework Requested
                  </p>
                  {submission.editor_note && (
                    <>
                      <p className="font-mono text-xs uppercase tracking-widest text-olive mb-1 mt-3">
                        Editor Guidance
                      </p>
                      <p className="font-mono text-sm text-near-black/80 whitespace-pre-wrap">
                        {submission.editor_note}
                      </p>
                    </>
                  )}
                </div>
                <h2 className="font-serif-display text-2xl mb-6">Revise &amp; Resubmit</h2>
                <ResubmitForm
                  submissionId={submission.id}
                  initialBody={submission.body ?? ''}
                  initialTitle={submission.title}
                  wordCountMin={brief.word_count_min}
                  wordCountMax={brief.word_count_max}
                />
              </div>
            )}

            {/* Fresh submission form */}
            {canSubmit && (
              <>
                <h2 className="font-serif-display text-2xl mb-6">Your Submission</h2>
                <SubmissionForm
                  briefId={brief.id}
                  cellId={cell.id}
                  wordCountMin={brief.word_count_min}
                  wordCountMax={brief.word_count_max}
                />
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
