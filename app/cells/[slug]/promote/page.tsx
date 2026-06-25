import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PromotionEvidenceForm } from '@/components/promotion/PromotionEvidenceForm'
import { DeadlineCounter } from '@/components/cell/DeadlineCounter'

export default async function PromotePage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/cells/${params.slug}/promote`)

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
    owner_id: string
  }
  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title, current_stage, stage_deadline, current_cycle, owner_id')
    .eq('slug', params.slug)
    .single() as { data: CellRow | null; error: unknown }

  if (!cell) redirect('/cells')
  if (cell.current_stage !== 'PROMOTION') redirect(`/cells/${params.slug}`)

  const { data: membership } = await supabase
    .from('cell_members')
    .select('status')
    .eq('cell_id', cell.id)
    .eq('user_id', user.id)
    .maybeSingle() as { data: { status: string } | null; error: unknown }

  if (!membership) redirect(`/cells/${params.slug}`)

  // Load publication for this cycle
  type PublicationRow = {
    id: string
    brief_id: string
    cover_image_url: string | null
    published_at: string | null
    promotion_deadline: string | null
  }
  const { data: publication } = await supabase
    .from('publications')
    .select('id, brief_id, cover_image_url, published_at, promotion_deadline')
    .eq('cell_id', cell.id)
    .eq('cycle', cell.current_cycle)
    .maybeSingle() as { data: PublicationRow | null; error: unknown }

  // Load brief title
  const { data: brief } = publication
    ? await (supabase
        .from('briefs')
        .select('title')
        .eq('id', publication.brief_id)
        .single() as unknown as Promise<{ data: { title: string } | null; error: unknown }>)
    : { data: null }

  // Load active members with their promotion status
  type MemberRow = {
    user_id: string
    profiles: { username: string; display_name: string | null } | null
  }
  const membersQuery = supabase
    .from('cell_members')
    .select('user_id, profiles(username, display_name)')
    .eq('cell_id', cell.id)
    .eq('status', 'ACTIVE') as unknown as Promise<{ data: MemberRow[] | null; error: unknown }>
  const { data: rawMembers } = await membersQuery

  // Load promotion records
  type PromoRecord = {
    user_id: string
    evidence_url: string
    status: string
    submitted_at: string | null
  }
  let promoRecords: PromoRecord[] = []
  if (publication) {
    const promoQuery = supabase
      .from('promotion_records')
      .select('user_id, evidence_url, status, submitted_at')
      .eq('publication_id', publication.id) as unknown as Promise<{
      data: PromoRecord[] | null
      error: unknown
    }>
    const { data: rawRecords } = await promoQuery
    promoRecords = rawRecords ?? []
  }

  const promoMap = new Map(promoRecords.map((r) => [r.user_id, r]))

  const members = (rawMembers ?? []).map((m: MemberRow) => ({
    user_id: m.user_id,
    username: m.profiles?.username ?? m.user_id,
    display_name: m.profiles?.display_name ?? null,
    record: promoMap.get(m.user_id) ?? null,
    isSelf: m.user_id === user.id,
  }))

  const myRecord = promoMap.get(user.id) ?? null
  const submittedCount = promoRecords.length
  const totalMembers = members.length

  return (
    <div className="px-10 py-8">
        <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
          Cycle {cell.current_cycle} — Promotion
        </p>

        <div className="flex items-baseline justify-between mb-6">
          <h1 className="font-serif-display text-4xl">Promote the Issue</h1>
          {cell.stage_deadline && <DeadlineCounter deadline={cell.stage_deadline} />}
        </div>

        {/* Publication summary */}
        {publication && (
          <div className="border border-near-black/20 px-5 py-4 mb-8 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs text-olive mb-0.5">Published Issue</p>
              <p className="font-serif-display text-lg">{brief?.title ?? `Issue ${cell.current_cycle}`}</p>
              {publication.published_at && (
                <p className="font-mono text-xs text-olive">
                  {new Date(publication.published_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>
            <Link
              href={`/cells/${params.slug}/publication/${cell.current_cycle}`}
              className="font-mono text-xs border border-near-black px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors shrink-0"
            >
              Read →
            </Link>
          </div>
        )}

        <p className="font-body text-base text-near-black/70 leading-relaxed mb-8">
          Share the publication on your social channels and submit the link below. All active
          members are required to promote this issue before the deadline.
        </p>

        {/* My submission */}
        {myRecord ? (
          <div className="border border-near-black/20 px-6 py-5 mb-8">
            <p className="font-mono text-xs uppercase tracking-widest text-olive mb-2">
              Your Evidence
            </p>
            <a
              href={myRecord.evidence_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-near-black underline hover:text-accent-red transition-colors break-all"
            >
              {myRecord.evidence_url}
            </a>
            <p className="font-mono text-xs text-olive mt-2">
              Submitted{' '}
              {myRecord.submitted_at
                ? new Date(myRecord.submitted_at).toLocaleDateString()
                : ''}
              {' · '}
              <span
                className={
                  myRecord.status === 'VERIFIED'
                    ? 'text-near-black'
                    : myRecord.status === 'MISSED'
                      ? 'text-accent-red'
                      : 'text-olive'
                }
              >
                {myRecord.status}
              </span>
            </p>
          </div>
        ) : (
          <div className="border border-near-black/20 px-6 py-6 mb-8">
            <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
              Submit Your Evidence
            </p>
            {publication ? (
              <PromotionEvidenceForm publicationId={publication.id} />
            ) : (
              <p className="font-mono text-xs text-olive">
                No publication found for this cycle.
              </p>
            )}
          </div>
        )}

        {/* Member promotion status */}
        <div className="border border-near-black/20">
          <div className="px-5 py-3 border-b border-near-black/20 flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-widest text-olive">
              Member Status
            </p>
            <span className="font-mono text-xs text-olive">
              {submittedCount}/{totalMembers} submitted
            </span>
          </div>
          <table className="w-full">
            <tbody>
              {members.map((m, i) => {
                const isLast = i === members.length - 1
                return (
                  <tr
                    key={m.user_id}
                    className={!isLast ? 'border-b border-near-black/10' : ''}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-body text-sm">
                          {m.display_name ?? m.username}
                        </span>
                        {m.isSelf && (
                          <span className="font-mono text-xs text-olive">(you)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {m.record ? (
                        <a
                          href={m.record.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-near-black underline hover:text-accent-red transition-colors"
                        >
                          {m.record.status === 'VERIFIED' ? 'Verified ↗' : 'Submitted ↗'}
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-accent-red">Pending</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
    </div>
  )
}
