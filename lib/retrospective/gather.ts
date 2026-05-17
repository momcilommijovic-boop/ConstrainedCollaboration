import { createAdminClient } from '@/lib/supabase/admin'
import type { CycleContext, CycleMember } from './types'

type ProfileJoin = { display_name: string | null; username: string; merit_score: number; merit_history: unknown }

export async function gatherCycleContext(cellId: string, cycle: number): Promise<CycleContext> {
  const admin = createAdminClient()

  // ── Cell ──────────────────────────────────────────────────────────────────
  const { data: cell } = await admin
    .from('cells')
    .select('id, title, description, slug, current_cycle')
    .eq('id', cellId)
    .single() as { data: { id: string; title: string; description: string | null; slug: string; current_cycle: number } | null; error: unknown }

  if (!cell) throw new Error('Cell not found')

  // ── Members (all statuses — kicked members are still interesting) ─────────
  type MemberRow = {
    user_id: string
    role: string
    status: string
    profiles: ProfileJoin | null
  }
  const { data: rawMembers } = await admin
    .from('cell_members')
    .select('user_id, role, status, profiles(display_name, username, merit_score, merit_history)')
    .eq('cell_id', cellId) as { data: MemberRow[] | null; error: unknown }

  const members: CycleMember[] = (rawMembers ?? []).map((m) => ({
    user_id: m.user_id,
    display_name: m.profiles?.display_name ?? m.profiles?.username ?? m.user_id.slice(0, 8),
    role: m.role,
    status: m.status,
    merit_score: m.profiles?.merit_score ?? 100,
    merit_history: Array.isArray(m.profiles?.merit_history) ? m.profiles.merit_history as Array<{ event: string; delta: number; ts: string }> : [],
  }))

  // Build a lookup from user_id → display name for subsequent joins
  const nameMap = new Map(members.map((m) => [m.user_id, m.display_name]))

  // ── Brief ─────────────────────────────────────────────────────────────────
  type BriefRow = {
    id: string
    title: string
    theme: string
    guidance: string
    published_at: string
    deadline: string
  }
  const { data: brief } = await admin
    .from('briefs')
    .select('id, title, theme, guidance, published_at, deadline')
    .eq('cell_id', cellId)
    .eq('cycle', cycle)
    .maybeSingle() as { data: BriefRow | null; error: unknown }

  // ── Invitations (via brief) ───────────────────────────────────────────────
  type InvitationRow = { invitee_id: string; status: string }
  const { data: rawInvitations } = brief
    ? await admin
        .from('invitations')
        .select('invitee_id, status')
        .eq('brief_id', brief.id) as { data: InvitationRow[] | null; error: unknown }
    : { data: null }

  const invitations = (rawInvitations ?? []).map((inv) => ({
    invitee_name: nameMap.get(inv.invitee_id) ?? inv.invitee_id.slice(0, 8),
    status: inv.status,
  }))

  // ── Submissions ───────────────────────────────────────────────────────────
  type SubmissionRow = {
    author_id: string
    title: string | null
    status: string
    editor_note: string | null
    submitted_at: string | null
  }
  const { data: rawSubs } = await admin
    .from('submissions')
    .select('author_id, title, status, editor_note, submitted_at')
    .eq('cell_id', cellId)
    .eq('cycle', cycle) as { data: SubmissionRow[] | null; error: unknown }

  const submissions = (rawSubs ?? []).map((s) => ({
    author_name: nameMap.get(s.author_id) ?? s.author_id.slice(0, 8),
    title: s.title,
    status: s.status,
    editor_note: s.editor_note,
    submitted_at: s.submitted_at,
  }))

  // ── Publication ───────────────────────────────────────────────────────────
  type PublicationRow = {
    id: string
    published_at: string | null
    promotion_deadline: string | null
    status: string
    selected_submission_ids: string[]
  }
  const { data: publication } = await admin
    .from('publications')
    .select('id, published_at, promotion_deadline, status, selected_submission_ids')
    .eq('cell_id', cellId)
    .eq('cycle', cycle)
    .maybeSingle() as { data: PublicationRow | null; error: unknown }

  // ── Promotion records ─────────────────────────────────────────────────────
  type PromotionRow = { user_id: string; evidence_url: string | null; status: string }
  const { data: rawPromos } = publication
    ? await admin
        .from('promotion_records')
        .select('user_id, evidence_url, status')
        .eq('publication_id', publication.id) as { data: PromotionRow[] | null; error: unknown }
    : { data: null }

  const promotionRecords = (rawPromos ?? []).map((p) => ({
    member_name: nameMap.get(p.user_id) ?? p.user_id.slice(0, 8),
    status: p.status,
    evidence_url: p.evidence_url,
  }))

  // ── Penalty log ───────────────────────────────────────────────────────────
  type PenaltyRow = { user_id: string; reason: string; merit_delta: number; stage: string | null }
  const { data: rawPenalties } = await admin
    .from('penalty_log')
    .select('user_id, reason, merit_delta, stage')
    .eq('cell_id', cellId)
    .eq('cycle', cycle) as { data: PenaltyRow[] | null; error: unknown }

  const penalties = (rawPenalties ?? []).map((p) => ({
    member_name: nameMap.get(p.user_id) ?? p.user_id.slice(0, 8),
    reason: p.reason,
    merit_delta: p.merit_delta,
    stage: p.stage,
  }))

  return {
    cell: {
      id: cell.id,
      title: cell.title,
      description: cell.description,
      slug: cell.slug,
      cycle,
    },
    members,
    brief: brief
      ? {
          title: brief.title,
          theme: brief.theme,
          guidance: brief.guidance,
          published_at: brief.published_at,
          deadline: brief.deadline,
        }
      : null,
    invitations,
    submissions,
    publication: publication
      ? {
          published_at: publication.published_at,
          promotion_deadline: publication.promotion_deadline,
          status: publication.status,
          article_count: publication.selected_submission_ids?.length ?? 0,
        }
      : null,
    promotionRecords,
    penalties,
  }
}
