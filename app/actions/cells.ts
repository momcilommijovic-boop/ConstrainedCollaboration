'use server'

import { createClient } from '@/lib/supabase/server'
import { getStrategy } from '@/lib/strategies'
import { EzineStrategy } from '@/lib/strategies/ezine'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { EzineStrategyConfig } from '@/lib/strategies/ezine'
import { notifyEditorElected } from '@/lib/notifications'

export type CellActionState = { error: string | null }

// ── Defaults ──────────────────────────────────────────────────────────────────

const EZINE_DEFAULTS: EzineStrategyConfig = {
  forming_timeout_days: 14,
  briefing_window_days: 3,
  submission_window_days: 7,
  editing_window_days: 4,
  promotion_window_days: 5,
  min_submissions_required: 3,
  max_submissions_per_writer: 1,
  editor_election_method: 'random',
  illustrator_required: false,
  illustrator_dedicated: false,
  word_count_min: 400,
  word_count_max: 1200,
  penalty_rules: {
    missed_brief: { action: 'warn', merit_delta: -5 },
    missed_submission: { action: 'kick', merit_delta: -10 },
    missed_promotion: { action: 'warn', merit_delta: -15 },
    second_offense: { action: 'kick', merit_delta: -20 },
    merit_kick_threshold: 60,
  },
  promotion_requirement: 'social_link',
  min_merit_to_join: 50,
  recur_on_completion: true,
}

// ── createCell ────────────────────────────────────────────────────────────────

const createCellSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(80, 'Title must be at most 80 characters'),
    description: z.string().max(500, 'Description too long').optional(),
    member_cap: z.coerce.number().int().min(2, 'Min 2').max(20, 'Max 20'),
    min_members: z.coerce.number().int().min(2, 'Min 2').max(20, 'Max 20'),
    min_merit_to_join: z.coerce.number().int().min(0).max(100),
    word_count_min: z.coerce.number().int().min(50).max(5000),
    word_count_max: z.coerce.number().int().min(100).max(10000),
    forming_timeout_days: z.coerce.number().int().min(1).max(60),
  })
  .refine((d) => d.min_members <= d.member_cap, {
    message: 'Min members to start cannot exceed member cap',
    path: ['min_members'],
  })
  .refine((d) => d.word_count_min < d.word_count_max, {
    message: 'Min word count must be less than max word count',
    path: ['word_count_min'],
  })

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '')
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`
}

export async function createCell(
  prevState: CellActionState,
  formData: FormData
): Promise<CellActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in to create a Cell.' }

  const parsed = createCellSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    member_cap: formData.get('member_cap'),
    min_members: formData.get('min_members'),
    min_merit_to_join: formData.get('min_merit_to_join'),
    word_count_min: formData.get('word_count_min'),
    word_count_max: formData.get('word_count_max'),
    forming_timeout_days: formData.get('forming_timeout_days'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const {
    title,
    description,
    member_cap,
    min_members,
    min_merit_to_join,
    word_count_min,
    word_count_max,
    forming_timeout_days,
  } = parsed.data

  const strategy_config: EzineStrategyConfig = {
    ...EZINE_DEFAULTS,
    min_merit_to_join,
    word_count_min,
    word_count_max,
    forming_timeout_days,
  }

  const slug = generateSlug(title)

  const stage_deadline = new Date(
    Date.now() + forming_timeout_days * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data: cell, error: cellError } = await supabase
    .from('cells')
    .insert({
      slug,
      title,
      description: description || null,
      strategy_id: 'EZINE_V1',
      strategy_config: strategy_config as unknown as import('@/lib/supabase/types').Json,
      status: 'FORMING',
      owner_id: user.id,
      current_stage: 'FORMING',
      stage_deadline,
      member_cap,
      min_members,
      current_cycle: 1,
      is_recurring: strategy_config.recur_on_completion,
    })
    .select('id, slug')
    .single()

  if (cellError || !cell) {
    return { error: cellError?.message ?? 'Failed to create Cell.' }
  }

  // Auto-join creator as first member
  await supabase.from('cell_members').insert({
    cell_id: cell.id,
    user_id: user.id,
    role: 'MEMBER',
    status: 'ACTIVE',
  })

  redirect(`/cells/${cell.slug}`)
}

// ── joinCell ──────────────────────────────────────────────────────────────────

export async function joinCell(
  prevState: CellActionState,
  formData: FormData
): Promise<CellActionState> {
  const cellId = formData.get('cell_id') as string
  if (!cellId) return { error: 'Invalid request.' }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in to join a Cell.' }

  // Load cell
  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, status, member_cap, strategy_id, strategy_config')
    .eq('id', cellId)
    .single()

  if (!cell) return { error: 'Cell not found.' }
  if (cell.status !== 'FORMING') return { error: 'This Cell is no longer accepting members.' }

  // Check strategy eligibility
  let strategy
  try {
    strategy = getStrategy(cell.strategy_id, cell.strategy_config)
  } catch {
    return { error: 'Cell has an invalid configuration.' }
  }

  // Get user merit
  const { data: profile } = await supabase
    .from('profiles')
    .select('merit_score')
    .eq('id', user.id)
    .single()

  const merit = profile?.merit_score ?? 100
  const minMerit = strategy instanceof EzineStrategy
    ? strategy.getConfig().min_merit_to_join
    : 0

  if (!strategy.canMemberJoin(merit)) {
    return {
      error: `Your merit score (${merit}) is too low to join this Cell. Minimum required: ${minMerit}.`,
    }
  }

  // Check already a member
  const { data: existing } = await supabase
    .from('cell_members')
    .select('id')
    .eq('cell_id', cell.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return { error: 'You are already a member of this Cell.' }

  // Check cap
  const { count } = await supabase
    .from('cell_members')
    .select('id', { count: 'exact', head: true })
    .eq('cell_id', cell.id)
    .eq('status', 'ACTIVE')

  if ((count ?? 0) >= cell.member_cap) {
    return { error: 'This Cell is full.' }
  }

  const { error: joinError } = await supabase.from('cell_members').insert({
    cell_id: cell.id,
    user_id: user.id,
    role: 'MEMBER',
    status: 'ACTIVE',
  })

  if (joinError) return { error: joinError.message }

  redirect(`/cells/${cell.slug}`)
}

// ── triggerBriefing ───────────────────────────────────────────────────────────

export async function triggerBriefing(
  prevState: CellActionState,
  formData: FormData
): Promise<CellActionState> {
  const cellId = formData.get('cell_id') as string
  if (!cellId) return { error: 'Invalid request.' }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title, owner_id, status, current_stage, strategy_config, min_members, current_cycle')
    .eq('id', cellId)
    .single()

  if (!cell) return { error: 'Cell not found.' }
  if (cell.owner_id !== user.id) return { error: 'Only the Cell owner can start Briefing.' }
  if (cell.current_stage !== 'FORMING') return { error: 'Cell is not in the Forming stage.' }

  // Verify quorum
  const { count } = await supabase
    .from('cell_members')
    .select('id', { count: 'exact', head: true })
    .eq('cell_id', cell.id)
    .eq('status', 'ACTIVE')

  if ((count ?? 0) < cell.min_members) {
    return { error: `Need at least ${cell.min_members} members to start Briefing.` }
  }

  const config = cell.strategy_config as EzineStrategyConfig
  const strategy = getStrategy('EZINE_V1', config)
  const durationDays = strategy.getStageDurationDays('BRIEFING')
  const deadline = durationDays
    ? new Date(Date.now() + durationDays * 864e5).toISOString()
    : null

  // Advance stage
  const { error: stageError } = await supabase
    .from('cells')
    .update({ current_stage: 'BRIEFING', status: 'ACTIVE', stage_deadline: deadline })
    .eq('id', cell.id)

  if (stageError) return { error: stageError.message }

  // Load members for election
  type MemberRow = { user_id: string; profiles: { merit_score: number } | null }
  const membersQuery = supabase
    .from('cell_members')
    .select('user_id, profiles(merit_score)')
    .eq('cell_id', cell.id)
    .eq('status', 'ACTIVE') as unknown as Promise<{ data: MemberRow[] | null; error: unknown }>
  const { data: rawMembers } = await membersQuery

  const candidates = (rawMembers ?? []).map((m: MemberRow) => ({
    userId: m.user_id,
    meritScore: m.profiles?.merit_score ?? 100,
  }))

  if (candidates.length > 0) {
    const electedEditorId = strategy.electEditor(candidates)

    // Clear any previous EDITOR / ILLUSTRATOR role assignments
    await supabase
      .from('cell_members')
      .update({ role: 'MEMBER' })
      .eq('cell_id', cell.id)
      .in('role', ['EDITOR', 'ILLUSTRATOR'])

    const { error: editorError } = await supabase
      .from('cell_members')
      .update({ role: 'EDITOR' })
      .eq('cell_id', cell.id)
      .eq('user_id', electedEditorId)

    if (editorError) return { error: editorError.message }

    void notifyEditorElected({
      editorId: electedEditorId,
      cellTitle: cell.title as string,
      cellSlug: cell.slug,
      deadline,
    })

    // Elect illustrator if strategy requires one
    if (config.illustrator_required && config.illustrator_dedicated) {
      const remaining = candidates.filter((c: { userId: string }) => c.userId !== electedEditorId)
      if (remaining.length > 0) {
        const electedIllustratorId = strategy.electEditor(remaining)
        await supabase
          .from('cell_members')
          .update({ role: 'ILLUSTRATOR' })
          .eq('cell_id', cell.id)
          .eq('user_id', electedIllustratorId)
      }
    }
  }

  redirect(`/cells/${cell.slug}`)
}

// ── updateCellSettings ────────────────────────────────────────────────────────

const updateSettingsSchema = z
  .object({
    cell_id: z.string().uuid(),
    title: z.string().min(3, 'Title must be at least 3 characters').max(80, 'Title too long'),
    description: z.string().max(500, 'Description too long').optional(),
    member_cap: z.coerce.number().int().min(2).max(20),
    min_members: z.coerce.number().int().min(2).max(20),
    min_merit_to_join: z.coerce.number().int().min(0).max(100),
    word_count_min: z.coerce.number().int().min(50).max(5000),
    word_count_max: z.coerce.number().int().min(100).max(10000),
    forming_timeout_days: z.coerce.number().int().min(1).max(60),
    briefing_window_days: z.coerce.number().int().min(1).max(30),
    submission_window_days: z.coerce.number().int().min(1).max(30),
    editing_window_days: z.coerce.number().int().min(1).max(30),
    promotion_window_days: z.coerce.number().int().min(1).max(30),
  })
  .refine((d) => d.min_members <= d.member_cap, {
    message: 'Min members to start cannot exceed member cap',
    path: ['min_members'],
  })
  .refine((d) => d.word_count_min < d.word_count_max, {
    message: 'Min word count must be less than max word count',
    path: ['word_count_min'],
  })

export async function updateCellSettings(
  prevState: CellActionState,
  formData: FormData
): Promise<CellActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const parsed = updateSettingsSchema.safeParse({
    cell_id: formData.get('cell_id'),
    title: formData.get('title'),
    description: formData.get('description'),
    member_cap: formData.get('member_cap'),
    min_members: formData.get('min_members'),
    min_merit_to_join: formData.get('min_merit_to_join'),
    word_count_min: formData.get('word_count_min'),
    word_count_max: formData.get('word_count_max'),
    forming_timeout_days: formData.get('forming_timeout_days'),
    briefing_window_days: formData.get('briefing_window_days'),
    submission_window_days: formData.get('submission_window_days'),
    editing_window_days: formData.get('editing_window_days'),
    promotion_window_days: formData.get('promotion_window_days'),
  })

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const {
    cell_id,
    title,
    description,
    member_cap,
    min_members,
    min_merit_to_join,
    word_count_min,
    word_count_max,
    forming_timeout_days,
    briefing_window_days,
    submission_window_days,
    editing_window_days,
    promotion_window_days,
  } = parsed.data

  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, owner_id, current_stage, strategy_config')
    .eq('id', cell_id)
    .single() as { data: { id: string; slug: string; owner_id: string; current_stage: string; strategy_config: EzineStrategyConfig } | null; error: unknown }

  if (!cell) return { error: 'Cell not found.' }
  if (cell.owner_id !== user.id) return { error: 'Only the Cell owner can edit settings.' }
  if (cell.current_stage !== 'FORMING') return { error: 'Settings can only be changed during the Forming stage.' }

  const { count } = await supabase
    .from('cell_members')
    .select('id', { count: 'exact', head: true })
    .eq('cell_id', cell_id)
    .eq('status', 'ACTIVE')

  if ((count ?? 0) > member_cap) {
    return { error: `Cannot set cap below current member count (${count}).` }
  }

  const updatedConfig: EzineStrategyConfig = {
    ...cell.strategy_config,
    min_merit_to_join,
    word_count_min,
    word_count_max,
    forming_timeout_days,
    briefing_window_days,
    submission_window_days,
    editing_window_days,
    promotion_window_days,
  }

  const newDeadline = new Date(
    Date.now() + forming_timeout_days * 24 * 60 * 60 * 1000
  ).toISOString()

  const { error: updateError } = await supabase
    .from('cells')
    .update({
      title,
      description: description || null,
      member_cap,
      min_members,
      strategy_config: updatedConfig as unknown as import('@/lib/supabase/types').Json,
      stage_deadline: newDeadline,
    })
    .eq('id', cell_id)

  if (updateError) return { error: updateError.message }

  redirect(`/cells/${cell.slug}`)
}
