import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { StageTimeline } from '@/components/cell/StageTimeline'
import { RetrospectivePlayer } from '@/components/retrospective/RetrospectivePlayer'
import { GenerateRetrospectiveButton } from '@/components/retrospective/GenerateRetrospectiveButton'
import type { RetrospectiveRow, SegmentRow } from '@/lib/retrospective/types'

export async function generateMetadata({
  params,
}: {
  params: { slug: string; cycle: string }
}) {
  const supabase = createClient()
  const { data: cell } = await supabase
    .from('cells')
    .select('title')
    .eq('slug', params.slug)
    .single() as { data: { title: string } | null; error: unknown }
  return {
    title: cell ? `${cell.title} — Cycle ${params.cycle} Retrospective — Quorum` : 'Retrospective — Quorum',
  }
}

export default async function RetrospectivePage({
  params,
}: {
  params: { slug: string; cycle: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const cycleNum = parseInt(params.cycle, 10)
  if (isNaN(cycleNum)) notFound()

  // Load cell
  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title, current_stage, current_cycle, owner_id')
    .eq('slug', params.slug)
    .single() as { data: { id: string; slug: string; title: string; current_stage: string; current_cycle: number; owner_id: string } | null; error: unknown }

  if (!cell) notFound()

  // Load current user's display name and admin status
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

  const isOwner = user?.id === cell.owner_id
  const canGenerate = isOwner || isAdmin

  // Load retrospective
  const { data: retrospective } = await supabase
    .from('retrospectives')
    .select('id, cell_id, cycle, episode_title, episode_summary, status, generated_at, tts_provider')
    .eq('cell_id', cell.id)
    .eq('cycle', cycleNum)
    .maybeSingle() as { data: RetrospectiveRow | null; error: unknown }

  // Load segments if retrospective exists
  let segments: SegmentRow[] = []
  if (retrospective?.status === 'READY') {
    const { data: rawSegments } = await supabase
      .from('retrospective_segments')
      .select('id, retrospective_id, segment_index, speaker_name, speaker_role, speaker_status, voice_persona, text, duration_estimate_seconds, audio_url, created_at')
      .eq('retrospective_id', retrospective.id)
      .order('segment_index', { ascending: true }) as { data: SegmentRow[] | null; error: unknown }
    segments = rawSegments ?? []
  }

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
            href={`/cells/${cell.slug}`}
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

        {/* No retrospective yet — show generate or loading state */}
        {!retrospective && canGenerate && (
          <div className="border border-near-black/20 px-6 py-8">
            <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
              Retrospective — Cycle {cycleNum}
            </p>
            <p className="font-body text-sm text-near-black/70 mb-6 max-w-lg">
              Generate an audio documentary episode for this cycle. Claude writes first-person interview
              segments from each member's perspective, then voices them.
            </p>
            <GenerateRetrospectiveButton
              cellId={cell.id}
              cellSlug={cell.slug}
              cycle={cycleNum}
              existingStatus={null}
            />
          </div>
        )}

        {!retrospective && !canGenerate && (
          <div className="border border-near-black/20 px-6 py-8">
            <p className="font-mono text-xs text-olive">No retrospective has been generated for this cycle.</p>
          </div>
        )}

        {/* Generating */}
        {retrospective?.status === 'GENERATING' && (
          <div className="border border-near-black/20 px-6 py-8">
            <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
              Generating Episode…
            </p>
            <p className="font-body text-sm text-near-black/60 mb-6">
              Assembling cycle data, writing interview scripts, and generating audio. This takes 30–90 seconds.
              Refresh the page to check progress.
            </p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-olive animate-pulse">●●●</span>
            </div>
          </div>
        )}

        {/* Failed */}
        {retrospective?.status === 'FAILED' && canGenerate && (
          <div className="border border-accent-red/40 px-6 py-8">
            <p className="font-mono text-xs uppercase tracking-widest text-accent-red mb-3">Generation Failed</p>
            <p className="font-mono text-xs text-near-black/70 mb-5">
              The episode generation encountered an error. You can retry below.
            </p>
            <GenerateRetrospectiveButton
              cellId={cell.id}
              cellSlug={cell.slug}
              cycle={cycleNum}
              existingStatus="FAILED"
            />
          </div>
        )}

        {/* Ready — full player */}
        {retrospective?.status === 'READY' && segments.length > 0 && (
          <RetrospectivePlayer retrospective={retrospective} segments={segments} />
        )}

        {retrospective?.status === 'READY' && segments.length === 0 && (
          <div className="border border-near-black/20 px-6 py-6">
            <p className="font-mono text-xs text-olive">Episode ready but no segments were saved. Try regenerating.</p>
            {canGenerate && (
              <div className="mt-4">
                <GenerateRetrospectiveButton
                  cellId={cell.id}
                  cellSlug={cell.slug}
                  cycle={cycleNum}
                  existingStatus="FAILED"
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
