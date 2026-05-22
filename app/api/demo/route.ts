import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEMO_ACCOUNTS, DEMO_CELL_SLUG } from '@/lib/demo/constants'

function getAdmin() {
  return createAdminClient()
}

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return Response.json({ error: 'Demo mode not enabled' }, { status: 403 })
  }

  const body = await req.json() as { op: string; asUserId?: string; cellSlug?: string; [key: string]: unknown }
  const { op } = body
  const admin = getAdmin()

  try {
    switch (op) {
      case 'get-state': {
        // Look up all demo users by username
        const usernames = DEMO_ACCOUNTS.map((a) => a.username)
        const { data: profiles } = await admin
          .from('profiles')
          .select('id, username')
          .in('username', usernames)

        const users: Record<string, { id: string; email: string; username: string }> = {}
        if (profiles) {
          for (const p of profiles as Array<{ id: string; username: string }>) {
            const account = DEMO_ACCOUNTS.find((a) => a.username === p.username)
            if (account) {
              users[p.username] = { id: p.id, email: account.email, username: p.username }
            }
          }
        }

        // Current cell
        const { data: cell } = await admin
          .from('cells')
          .select('id')
          .eq('slug', DEMO_CELL_SLUG)
          .maybeSingle()

        const cellId = (cell as { id: string } | null)?.id ?? null

        // Current brief
        let briefId: string | null = null
        if (cellId) {
          const { data: brief } = await admin
            .from('briefs')
            .select('id')
            .eq('cell_id', cellId)
            .order('published_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          briefId = (brief as { id: string } | null)?.id ?? null
        }

        // Current publication
        let publicationId: string | null = null
        if (cellId) {
          const { data: pub } = await admin
            .from('publications')
            .select('id')
            .eq('cell_id', cellId)
            .order('published_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          publicationId = (pub as { id: string } | null)?.id ?? null
        }

        return Response.json({ users, cellId, briefId, publicationId })
      }

      case 'create-cell': {
        const { asUserId } = body
        if (!asUserId) return Response.json({ error: 'asUserId required' }, { status: 400 })

        // Idempotent: return existing cell if slug already exists
        const { data: existingCell } = await admin
          .from('cells')
          .select('id')
          .eq('slug', DEMO_CELL_SLUG)
          .maybeSingle()
        if (existingCell) {
          const existingId = (existingCell as { id: string }).id
          const { data: existingMember } = await admin
            .from('cell_members')
            .select('id')
            .eq('cell_id', existingId)
            .eq('user_id', asUserId as string)
            .maybeSingle()
          if (!existingMember) {
            await admin.from('cell_members').insert({
              cell_id: existingId,
              user_id: asUserId as string,
              role: 'MEMBER',
              status: 'ACTIVE',
            })
          }
          return Response.json({ cellId: existingId })
        }

        const { data: cell, error } = await admin
          .from('cells')
          .insert({
            title: 'The Marginal Review',
            slug: DEMO_CELL_SLUG,
            description: 'An independent magazine for long-form ideas journalism.',
            strategy_id: 'EZINE_V1',
            strategy_config: {
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
            },
            status: 'FORMING',
            current_stage: 'FORMING',
            member_cap: 6,
            min_members: 4,
            owner_id: asUserId,
            current_cycle: 1,
            is_recurring: true,
          })
          .select('id')
          .single()

        if (error) return Response.json({ error: error.message }, { status: 500 })

        const cellId = (cell as { id: string }).id

        // Insert owner as member
        await admin.from('cell_members').insert({
          cell_id: cellId,
          user_id: asUserId,
          role: 'MEMBER',
          status: 'ACTIVE',
        })

        return Response.json({ cellId })
      }

      case 'join-cell': {
        const { asUserId, cellSlug } = body
        if (!asUserId) return Response.json({ error: 'asUserId required' }, { status: 400 })

        const slug = (cellSlug as string) || DEMO_CELL_SLUG
        const { data: cell } = await admin
          .from('cells')
          .select('id')
          .eq('slug', slug)
          .single()

        if (!cell) return Response.json({ error: 'Cell not found' }, { status: 404 })

        const cellId = (cell as { id: string }).id

        // Check if already a member
        const { data: existing } = await admin
          .from('cell_members')
          .select('id')
          .eq('cell_id', cellId)
          .eq('user_id', asUserId)
          .maybeSingle()

        if (!existing) {
          await admin.from('cell_members').insert({
            cell_id: cellId,
            user_id: asUserId,
            role: 'MEMBER',
            status: 'ACTIVE',
          })
        }

        return Response.json({ ok: true })
      }

      case 'trigger-briefing': {
        const { asUserId, cellSlug } = body
        const slug = (cellSlug as string) || DEMO_CELL_SLUG

        const { data: cell } = await admin
          .from('cells')
          .select('id')
          .eq('slug', slug)
          .single()

        if (!cell) return Response.json({ error: 'Cell not found' }, { status: 404 })
        const cellId = (cell as { id: string }).id

        // Update cell stage
        await admin
          .from('cells')
          .update({ current_stage: 'BRIEFING', status: 'ACTIVE' })
          .eq('id', cellId)

        // Elect editor — set Elena (asUserId) as editor
        if (asUserId) {
          await admin
            .from('cell_members')
            .update({ role: 'EDITOR' })
            .eq('cell_id', cellId)
            .eq('user_id', asUserId)
        }

        return Response.json({ ok: true })
      }

      case 'publish-brief': {
        const { cellId, editorId, title, theme, guidance, word_count_min, word_count_max, slots, inviteeIds } = body
        if (!cellId || !editorId) return Response.json({ error: 'cellId and editorId required' }, { status: 400 })

        const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

        const { data: brief, error } = await admin
          .from('briefs')
          .insert({
            cell_id: cellId as string,
            cycle: 1,
            editor_id: editorId as string,
            title: (title as string) || 'Issue I',
            theme: (theme as string) || 'The Infrastructure of Everything',
            guidance: (guidance as string) || 'Write about hidden systems.',
            word_count_min: (word_count_min as number) || 400,
            word_count_max: (word_count_max as number) || 1200,
            slots: (slots as number) || 3,
            published_at: new Date().toISOString(),
            deadline,
          })
          .select('id')
          .single()

        if (error) return Response.json({ error: error.message }, { status: 500 })

        const briefId = (brief as { id: string }).id

        // Update cell to SUBMISSION stage
        await admin
          .from('cells')
          .update({ current_stage: 'SUBMISSION', stage_deadline: deadline })
          .eq('id', cellId as string)

        // Insert invitations
        if (Array.isArray(inviteeIds)) {
          for (const inviteeId of inviteeIds as string[]) {
            await admin.from('invitations').insert({
              brief_id: briefId,
              cell_id: cellId as string,
              invitee_id: inviteeId,
              status: 'PENDING',
            })
          }
        }

        return Response.json({ briefId })
      }

      case 'invite-members': {
        const { briefId, cellId, inviteeIds } = body
        if (!briefId || !Array.isArray(inviteeIds)) {
          return Response.json({ error: 'briefId and inviteeIds required' }, { status: 400 })
        }

        for (const inviteeId of inviteeIds as string[]) {
          await admin.from('invitations').insert({
            brief_id: briefId as string,
            cell_id: cellId as string,
            invitee_id: inviteeId,
            status: 'PENDING',
          })
        }

        return Response.json({ ok: true })
      }

      case 'respond-invitation': {
        const { asUserId, briefId } = body
        if (!asUserId || !briefId) {
          return Response.json({ error: 'asUserId and briefId required' }, { status: 400 })
        }

        // Update invitation
        await admin
          .from('invitations')
          .update({ status: 'ACCEPTED', responded_at: new Date().toISOString() })
          .eq('brief_id', briefId as string)
          .eq('invitee_id', asUserId as string)

        // Get cell_id from brief
        const { data: brief } = await admin
          .from('briefs')
          .select('cell_id')
          .eq('id', briefId as string)
          .single()

        if (brief) {
          const cellId = (brief as { cell_id: string }).cell_id
          // Update member role to WRITER
          await admin
            .from('cell_members')
            .update({ role: 'WRITER' })
            .eq('cell_id', cellId)
            .eq('user_id', asUserId as string)
        }

        return Response.json({ ok: true })
      }

      case 'submit-article': {
        const { cellId, briefId, asUserId, title, body: articleBody } = body
        if (!cellId || !briefId || !asUserId) {
          return Response.json({ error: 'cellId, briefId, asUserId required' }, { status: 400 })
        }

        const bodyText = (articleBody as string) || ''
        const wordCount = bodyText.split(/\s+/).filter(Boolean).length

        const { data: submission, error } = await admin
          .from('submissions')
          .insert({
            brief_id: briefId as string,
            cell_id: cellId as string,
            author_id: asUserId as string,
            title: (title as string) || 'Untitled',
            body: bodyText,
            word_count: wordCount,
            status: 'SUBMITTED',
            submitted_at: new Date().toISOString(),
            cycle: 1,
          })
          .select('id')
          .single()

        if (error) return Response.json({ error: error.message }, { status: 500 })

        // Ensure cell is in SUBMISSION stage
        await admin
          .from('cells')
          .update({ current_stage: 'SUBMISSION' })
          .eq('id', cellId as string)
          .neq('current_stage', 'SUBMISSION')

        return Response.json({ submissionId: (submission as { id: string }).id })
      }

      case 'advance-to-editing': {
        const { cellId } = body
        if (!cellId) return Response.json({ error: 'cellId required' }, { status: 400 })

        await admin
          .from('cells')
          .update({ current_stage: 'EDITING' })
          .eq('id', cellId as string)

        return Response.json({ ok: true })
      }

      case 'review-submission': {
        const { submissionId, status: submissionStatus, editorNote } = body
        if (!submissionId || !submissionStatus) {
          return Response.json({ error: 'submissionId and status required' }, { status: 400 })
        }

        const reviewedAt = new Date().toISOString()
        await admin
          .from('submissions')
          .update({
            status: submissionStatus as string,
            reviewed_at: reviewedAt,
            editor_note: editorNote ? (editorNote as string) : null,
          })
          .eq('id', submissionId as string)

        // Get cell_id, cycle, brief_id from submission to ensure publication exists
        const { data: sub } = await admin
          .from('submissions')
          .select('cell_id, cycle, brief_id')
          .eq('id', submissionId as string)
          .single()

        if (sub) {
          const { cell_id, cycle, brief_id } = sub as { cell_id: string; cycle: number; brief_id: string }
          const { data: existingPub } = await admin
            .from('publications')
            .select('id')
            .eq('cell_id', cell_id)
            .eq('cycle', cycle)
            .maybeSingle()

          if (!existingPub) {
            const { data: editorMember } = await admin
              .from('cell_members')
              .select('user_id')
              .eq('cell_id', cell_id)
              .eq('role', 'EDITOR')
              .maybeSingle()

            const editorUserId = (editorMember as { user_id: string } | null)?.user_id ?? ''
            await admin.from('publications').insert({
              cell_id,
              cycle,
              brief_id,
              assembled_by: editorUserId,
              status: 'ASSEMBLING',
              selected_submission_ids: [],
            })
          }
        }

        return Response.json({ ok: true })
      }

      case 'get-submissions': {
        const { cellId } = body
        if (!cellId) return Response.json({ error: 'cellId required' }, { status: 400 })

        const { data: submissions } = await admin
          .from('submissions')
          .select('id, author_id, status')
          .eq('cell_id', cellId as string)

        if (!submissions) return Response.json({ submissions: [] })

        // Get author emails
        const authorIds = (submissions as Array<{ author_id: string }>).map((s) => s.author_id)
        const { data: profiles } = await admin
          .from('profiles')
          .select('id, username')
          .in('id', authorIds)

        const profileMap = new Map<string, string>()
        if (profiles) {
          for (const p of profiles as Array<{ id: string; username: string }>) {
            const account = DEMO_ACCOUNTS.find((a) => a.username === p.username)
            if (account) profileMap.set(p.id, account.email)
          }
        }

        const result = (submissions as Array<{ id: string; author_id: string; status: string }>).map((s) => ({
          id: s.id,
          authorEmail: profileMap.get(s.author_id) ?? '',
          status: s.status,
        }))

        return Response.json({ submissions: result })
      }

      case 'publish-publication': {
        const { cellId } = body
        if (!cellId) return Response.json({ error: 'cellId required' }, { status: 400 })

        // Get accepted submissions
        const { data: accepted } = await admin
          .from('submissions')
          .select('id')
          .eq('cell_id', cellId as string)
          .eq('status', 'ACCEPTED')

        const selectedIds = accepted ? (accepted as Array<{ id: string }>).map((s) => s.id) : []

        // Get cell info
        const { data: cell } = await admin
          .from('cells')
          .select('current_cycle')
          .eq('id', cellId as string)
          .single()

        const cycle = (cell as { current_cycle: number } | null)?.current_cycle ?? 1

        // Get brief for this cell/cycle
        const { data: brief } = await admin
          .from('briefs')
          .select('id')
          .eq('cell_id', cellId as string)
          .eq('cycle', cycle)
          .maybeSingle()

        const briefId = (brief as { id: string } | null)?.id ?? ''

        // Get editor
        const { data: editorMember } = await admin
          .from('cell_members')
          .select('user_id')
          .eq('cell_id', cellId as string)
          .eq('role', 'EDITOR')
          .maybeSingle()

        const promotionDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()

        // Upsert publication
        const { data: existingPub } = await admin
          .from('publications')
          .select('id')
          .eq('cell_id', cellId as string)
          .eq('cycle', cycle)
          .maybeSingle()

        let publicationId: string

        if (existingPub) {
          const existing = existingPub as { id: string }
          await admin
            .from('publications')
            .update({
              status: 'PUBLISHED',
              selected_submission_ids: selectedIds,
              published_at: new Date().toISOString(),
              promotion_deadline: promotionDeadline,
            })
            .eq('id', existing.id)
          publicationId = existing.id
        } else {
          const assembledBy = (editorMember as { user_id: string } | null)?.user_id ?? ''
          const { data: newPub, error } = await admin
            .from('publications')
            .insert({
              cell_id: cellId as string,
              cycle,
              brief_id: briefId,
              assembled_by: assembledBy,
              status: 'PUBLISHED',
              selected_submission_ids: selectedIds,
              published_at: new Date().toISOString(),
              promotion_deadline: promotionDeadline,
            })
            .select('id')
            .single()

          if (error) return Response.json({ error: error.message }, { status: 500 })
          publicationId = (newPub as { id: string }).id
        }

        // Advance cell to PROMOTION
        await admin
          .from('cells')
          .update({
            current_stage: 'PROMOTION',
            stage_deadline: promotionDeadline,
          })
          .eq('id', cellId as string)

        return Response.json({ publicationId })
      }

      case 'submit-promotion': {
        const { asUserId, publicationId, evidenceUrl } = body
        if (!asUserId || !publicationId) {
          return Response.json({ error: 'asUserId and publicationId required' }, { status: 400 })
        }

        // Check if already submitted
        const { data: existing } = await admin
          .from('promotion_records')
          .select('id')
          .eq('publication_id', publicationId as string)
          .eq('user_id', asUserId as string)
          .maybeSingle()

        if (!existing) {
          await admin.from('promotion_records').insert({
            publication_id: publicationId as string,
            user_id: asUserId as string,
            evidence_url: (evidenceUrl as string) || 'https://example.com',
            submitted_at: new Date().toISOString(),
            status: 'PENDING',
          })
        }

        return Response.json({ ok: true })
      }

      case 'complete-cycle': {
        const { publicationId, cellId } = body
        if (!publicationId || !cellId) {
          return Response.json({ error: 'publicationId and cellId required' }, { status: 400 })
        }

        // Get publication data
        const { data: pub } = await admin
          .from('publications')
          .select('selected_submission_ids, assembled_by, cycle')
          .eq('id', publicationId as string)
          .single()

        if (!pub) return Response.json({ error: 'Publication not found' }, { status: 404 })

        const { selected_submission_ids, assembled_by, cycle } = pub as {
          selected_submission_ids: string[]
          assembled_by: string
          cycle: number
        }

        // Get accepted submission authors
        const acceptedIds = selected_submission_ids || []
        const authorMeritMap = new Map<string, number>()

        if (acceptedIds.length > 0) {
          const { data: subs } = await admin
            .from('submissions')
            .select('author_id')
            .in('id', acceptedIds)

          if (subs) {
            for (const s of subs as Array<{ author_id: string }>) {
              authorMeritMap.set(s.author_id, 10) // +10 per accepted submission
            }
          }
        }

        // Get promotion completers
        const { data: promotionRecords } = await admin
          .from('promotion_records')
          .select('user_id')
          .eq('publication_id', publicationId as string)
          .eq('status', 'PENDING') // PENDING = submitted but not yet verified

        const promoterSet = new Set<string>()
        if (promotionRecords) {
          for (const r of promotionRecords as Array<{ user_id: string }>) {
            promoterSet.add(r.user_id)
          }
        }

        // Get all active cell members
        const { data: members } = await admin
          .from('cell_members')
          .select('user_id, role')
          .eq('cell_id', cellId as string)
          .eq('status', 'ACTIVE')

        if (members) {
          for (const m of members as Array<{ user_id: string; role: string }>) {
            let delta = 3 // +3 per cycle completed

            if (m.user_id === assembled_by) delta += 15 // +15 for editor
            if (authorMeritMap.has(m.user_id)) delta += authorMeritMap.get(m.user_id)! // +10 for accepted submission
            if (promoterSet.has(m.user_id)) delta += 5 // +5 for on-time promotion

            // Fetch current profile
            const { data: profile } = await admin
              .from('profiles')
              .select('merit_score, merit_history')
              .eq('id', m.user_id)
              .single()

            if (profile) {
              const p = profile as { merit_score: number; merit_history: Array<{ event: string; delta: number; ts: string }> }
              const history = Array.isArray(p.merit_history) ? p.merit_history : []
              history.push({ event: `cycle_${cycle}_complete`, delta, ts: new Date().toISOString() })

              await admin
                .from('profiles')
                .update({
                  merit_score: p.merit_score + delta,
                  merit_history: history,
                })
                .eq('id', m.user_id)
            }
          }
        }

        // Update cell
        const { data: currentCell } = await admin
          .from('cells')
          .select('current_cycle')
          .eq('id', cellId as string)
          .single()

        const currentCycle = (currentCell as { current_cycle: number } | null)?.current_cycle ?? 1

        await admin
          .from('cells')
          .update({
            current_stage: 'COMPLETE',
            current_cycle: currentCycle + 1,
          })
          .eq('id', cellId as string)

        return Response.json({ ok: true })
      }

      case 'seed-design-tokens': {
        const { cellId } = body
        if (!cellId) return Response.json({ error: 'cellId required' }, { status: 400 })

        const { data: editorMember } = await admin
          .from('cell_members')
          .select('user_id')
          .eq('cell_id', cellId as string)
          .eq('role', 'EDITOR')
          .maybeSingle()
        const editorUserId = (editorMember as { user_id: string } | null)?.user_id ?? null

        const tokens = {
          meta: {
            inspiration_label: 'The Guardian / New Left Review',
            mood: 'Authoritative, unhurried, high contrast',
            generated_at: new Date().toISOString(),
          },
          fonts: {
            heading: {
              family: 'Playfair Display',
              google_font_url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap',
              weights: ['400', '700', '400i'],
              fallback: 'Georgia, "Times New Roman", serif',
            },
            subheading: {
              family: 'Playfair Display',
              google_font_url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap',
              weights: ['400', '600', '400i'],
              fallback: 'Georgia, serif',
            },
            body: {
              family: 'Source Serif 4',
              google_font_url: 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap',
              weights: ['400', '600', '400i'],
              fallback: 'Georgia, serif',
            },
            ui: {
              family: 'IBM Plex Mono',
              google_font_url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap',
              weights: ['400', '500'],
              fallback: '"Courier New", monospace',
            },
            pullquote: {
              family: 'Playfair Display',
              google_font_url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400;1,700&display=swap',
              weights: ['400i', '700i'],
              fallback: 'Georgia, serif',
            },
            caption: {
              family: 'IBM Plex Mono',
              google_font_url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&display=swap',
              weights: ['400'],
              fallback: '"Courier New", monospace',
            },
          },
          colours: {
            background: '#F5F2EC',
            surface: '#EDEBE4',
            text_primary: '#1A1A18',
            text_secondary: '#3D3D39',
            text_muted: '#7A7A5A',
            accent: '#C0392B',
            accent_light: '#F9ECEB',
            border: 'rgba(26,26,24,0.15)',
          },
          scale: {
            h1: 'clamp(2.5rem, 6vw, 5rem)',
            h2: 'clamp(1.75rem, 3.5vw, 2.5rem)',
            h3: '1.375rem',
            h4: '1.125rem',
            body: '1.125rem',
            caption: '0.75rem',
            ui: '0.6875rem',
            line_height_heading: '1.1',
            line_height_body: '1.75',
            letter_spacing_heading: '-0.02em',
            letter_spacing_body: '0.005em',
            column_max_width: '680px',
            column_narrow_width: '520px',
          },
          spacing: {
            section_gap: '5rem',
            block_gap: '2.5rem',
            paragraph_gap: '2rem',
            page_margin_horizontal: 'clamp(1.5rem, 6vw, 6rem)',
            page_margin_vertical: '4rem',
          },
          image_style: {
            treatment: 'full-bleed',
            caption_position: 'below',
            border_radius: '0',
            border_width: '0',
          },
          typography_details: {
            drop_cap: true,
            pull_quote_style: 'ruled-left',
            heading_case: 'sentence',
            byline_format: 'By {name}',
            rule_style: 'solid',
            rule_weight: '1px',
          },
        }

        const { data: existing } = await (admin
          .from('cell_design_tokens' as never)
          .select('id')
          .eq('cell_id' as never, cellId as string)
          .maybeSingle() as unknown as Promise<{ data: { id: string } | null; error: unknown }>)

        if (existing) {
          await admin
            .from('cell_design_tokens' as never)
            .update({ tokens, manually_edited: false } as never)
            .eq('id' as never, existing.id)
        } else {
          await admin
            .from('cell_design_tokens' as never)
            .insert({
              cell_id: cellId as string,
              inspiration_sources: [
                { type: 'url', value: 'https://www.theguardian.com', label: 'The Guardian' },
                { type: 'url', value: 'https://newleftreview.org', label: 'New Left Review' },
              ],
              tokens,
              generated_at: new Date().toISOString(),
              generated_by: editorUserId,
              manually_edited: false,
            } as never)
        }

        return Response.json({ ok: true })
      }

      case 'seed-layout': {
        const { cellId, cycle: cycleParam } = body
        if (!cellId) return Response.json({ error: 'cellId required' }, { status: 400 })
        const cycle = (cycleParam as number) || 1

        // Get publication
        const { data: pub } = await admin
          .from('publications')
          .select('id')
          .eq('cell_id', cellId as string)
          .eq('cycle', cycle)
          .maybeSingle()

        if (!pub) return Response.json({ error: 'No publication for this cycle' }, { status: 404 })
        const publicationId = (pub as { id: string }).id

        // Get accepted submissions with author info
        const { data: rawSubs } = await (admin
          .from('submissions')
          .select('id, title, author_id, profiles(display_name, username)')
          .eq('cell_id', cellId as string)
          .eq('cycle', cycle)
          .eq('status', 'ACCEPTED') as unknown as Promise<{
            data: Array<{
              id: string
              title: string | null
              author_id: string
              profiles: { display_name: string | null; username: string } | null
            }> | null
            error: unknown
          }>)

        const subs = rawSubs ?? []

        // Get editor
        const { data: editorMember } = await admin
          .from('cell_members')
          .select('user_id')
          .eq('cell_id', cellId as string)
          .eq('role', 'EDITOR')
          .maybeSingle()
        const editorUserId = (editorMember as { user_id: string } | null)?.user_id ?? null

        // Get design token id
        const { data: tokenRow } = await (admin
          .from('cell_design_tokens' as never)
          .select('id')
          .eq('cell_id' as never, cellId as string)
          .maybeSingle() as unknown as Promise<{ data: { id: string } | null; error: unknown }>)
        const designTokenId = tokenRow?.id ?? null

        const issueDate = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long' })

        // Build pages
        const pages = []

        // Cover page
        pages.push({
          id: crypto.randomUUID(),
          label: 'Cover',
          blocks: [
            {
              type: 'cover',
              id: crypto.randomUUID(),
              props: {
                title: 'The Marginal Review',
                subtitle: 'Issue I — The Infrastructure of Everything',
                issue_number: 'I',
                image_id: null,
                overlay_opacity: 0.35,
                title_position: 'bottom-left',
              },
            },
          ],
        })

        // Article pages
        for (let i = 0; i < subs.length; i++) {
          const sub = subs[i]
          const authorName = sub.profiles?.display_name ?? sub.profiles?.username ?? 'Unknown'
          pages.push({
            id: crypto.randomUUID(),
            label: `Article ${i + 1}`,
            blocks: [
              ...(i > 0
                ? [{ type: 'spacer', id: crypto.randomUUID(), props: { height: '3rem' } }]
                : []),
              {
                type: 'standfirst',
                id: crypto.randomUUID(),
                props: { text: sub.title ?? 'Untitled' },
              },
              {
                type: 'byline',
                id: crypto.randomUUID(),
                props: {
                  submission_id: sub.id,
                  author_name: authorName,
                  author_profile_url: null,
                  date: issueDate,
                  align: 'left',
                },
              },
              {
                type: 'article_body',
                id: crypto.randomUUID(),
                props: {
                  submission_id: sub.id,
                  show_drop_cap: i === 0,
                  column_width: 'standard',
                  show_title: false,
                  show_byline: false,
                },
              },
            ],
          })
        }

        // Colophon
        pages.push({
          id: crypto.randomUUID(),
          label: 'Colophon',
          blocks: [
            {
              type: 'divider',
              id: crypto.randomUUID(),
              props: { style: 'rule', weight: null },
            },
            {
              type: 'colophon',
              id: crypto.randomUUID(),
              props: {
                text: 'The Marginal Review is published by Quorum, a constraint-based co-operation platform. Contributors retain copyright of their work. This publication was assembled under structured constraint — automated deadlines, merit-weighted editorial election, and enforced submission rules.',
              },
            },
          ],
        })

        // Upsert layout
        const { data: existingLayout } = await (admin
          .from('publication_layouts' as never)
          .select('id')
          .eq('publication_id' as never, publicationId)
          .maybeSingle() as unknown as Promise<{ data: { id: string } | null; error: unknown }>)

        if (existingLayout) {
          await admin
            .from('publication_layouts' as never)
            .update({
              pages,
              design_token_id: designTokenId,
              last_edited_at: new Date().toISOString(),
              last_edited_by: editorUserId,
            } as never)
            .eq('id' as never, existingLayout.id)
        } else {
          await admin
            .from('publication_layouts' as never)
            .insert({
              publication_id: publicationId,
              cell_id: cellId as string,
              cycle,
              pages,
              design_token_id: designTokenId,
              status: 'DRAFT',
              last_edited_at: new Date().toISOString(),
              last_edited_by: editorUserId,
            } as never)
        }

        return Response.json({ ok: true, pageCount: pages.length })
      }

      case 'get-demo-content': {
        const { authorEmail } = body
        if (!authorEmail) return Response.json({ error: 'authorEmail required' }, { status: 400 })

        // Try DB first
        const { data: content } = await (admin
          .from('demo_content')
          .select('article_title, article_body')
          .eq('author_email', authorEmail as string)
                    .maybeSingle() as unknown as Promise<{ data: { article_title: string; article_body: string } | null; error: unknown }>)

        if (content) {
          return Response.json({ title: content.article_title, body: content.article_body })
        }

        // Inline fallback — works without seed:demo
        const FALLBACK: Record<string, { title: string; body: string }> = {
          'writer1@demo.quorum.dev': {
            title: 'The Politics of the Bus Route',
            body: `When the number 47 was rerouted three years ago, nobody held a press conference. There was a notice in the local paper — small print, buried under property listings — and then the change simply happened. For the 2,400 people who used that route daily, it meant an extra twenty minutes each way, a connecting bus that ran twice an hour, and, for those working early shifts at the distribution centre on Fenwick Road, a choice between arriving late or leaving home before dawn.\n\nThis is how transport policy works in most cities: not through grand announcements but through accumulated small decisions, each defensible in isolation, each shifting burden onto those who can least absorb it. The 47 was deemed underutilised. The data showed low ridership per kilometre. What the data did not show was who was riding it, or why, or what would happen to them when it was gone.\n\nUrban mobility researchers talk about "transit deserts" — areas where the density of public transport is insufficient to support car-free living. But the concept undersells the problem. Deserts are natural phenomena. Transit poverty is manufactured, decision by decision, reroute by reroute, over decades.\n\nI spent six months talking to the people most affected by the 47's disappearance. Maria, a hospital cleaner from Bratislava, who now cycles forty minutes each way in winter dark because the replacement service adds too much time to her shift. Winston, who drove taxis for twenty years before his licence was suspended and now cannot reach the job centre without a two-hour round trip. Amara, a student who stopped attending her evening classes entirely.\n\nWhat strikes you, talking to these people, is not their anger but their resignation. They have learned to work around the system because the system has never worked for them. Winston puts it plainly: "The bus was never for us. We just used it."\n\nThe language of transport planning is saturated with neutral-sounding metrics: catchment areas, interchanges, journey-time savings. These metrics tend to favour commuters travelling into city centres at peak times. The journeys that fall outside this model — the diagonal trip, the night shift, the outer-suburb link — appear in the data only as their absence.\n\nSome cities are beginning to map this gap deliberately. Helsinki has published isochrone maps showing how far different residents can travel in thirty minutes by public transport. The disparity is visible immediately: inner-city residents can reach vast swathes of the city; outer-suburb residents are effectively marooned.\n\nThe 47 will not come back. The money saved has already been reallocated. But three boroughs over, a new rapid transit corridor is under construction, connecting the central business district to a regenerating waterfront. It will have dedicated lanes, real-time displays, and a name chosen by public vote. It will be described as "connecting communities." It will not stop anywhere near Fenwick Road.`,
          },
          'writer2@demo.quorum.dev': {
            title: 'Learning to Live With Water',
            body: `The sea wall at Happisburgh is four metres high, concrete, and visibly failing. Sections have been patched with rubble. One section, near the car park, has a crack running diagonally from top to bottom that wasn't there last winter. Local residents photograph it periodically, a form of community monitoring that no one asked them to do but everyone understands is necessary.\n\nHappisburgh is on the Norfolk coast, on what geologists call a soft-cliff coastline: glacial till, loose and friable, that erodes at two to three metres per year in normal conditions and considerably faster when storms come from the northeast. Since 2002, when the coastal defence funding was cut, twenty-six houses have been demolished or fallen into the sea.\n\nThis is what climate adaptation looks like at the sharp end — not solar panels and heat pumps, but orderly retreat and managed grief. The policy framework calls it managed realignment: the sea is allowed to reclaim land, and people are relocated, theoretically with compensation. In practice, the compensation rarely reflects actual loss.\n\nThe harder question — the one that climate policy is still struggling to ask clearly — is what we owe to people in the path of inevitable change. The standard answer is resilience: communities must adapt, prepare, diversify. But resilience, as a policy framework, has a political convenience built into it. It locates responsibility for managing climate risk in the communities experiencing that risk, rather than in the systems that produced it.\n\nThere are better models. The Dutch have spent eighty years building a relationship with water that is neither surrender nor denial. Room for the River, their ambitious spatial planning programme, deliberately widens floodplains, relocates flood-prone buildings, and creates water storage areas that double as landscape parks. It is expensive, state-led, and predicated on a social contract that treats flood protection as a collective responsibility.\n\nBritain has no equivalent philosophy. Coastal policy is fragmented across local authorities with varying budgets and risk appetites. Some areas get sea walls; others get managed realignment strategies that are, in practice, policy euphemisms for abandonment.\n\nIn Happisburgh, there is a community archive project. Residents document the village as it was: buildings, families, routines. The archive is stored in multiple locations, in case any single one is lost. It is a form of memory-making in the face of physical erasure, and it is entirely unfunded.\n\nThe last house on Beach Road went over the cliff in January. The owner had already moved. She comes back sometimes and stands at the edge, looking at the gap where her kitchen used to be, and then she drives home.`,
          },
          'writer3@demo.quorum.dev': {
            title: 'The Invisible Constituency',
            body: `At the last general election, the turnout in the ten most deprived parliamentary constituencies averaged 51.4 per cent. In the ten least deprived, it was 72.1 per cent. This gap — call it the participation deficit — has been stable for twenty years, through different parties, different crises, different electoral systems. It is not a glitch. It is a feature.\n\nPolitical scientists have long understood that participation is correlated with resource. People who vote reliably are, in aggregate, more educated, more securely housed, more financially stable, and older than those who do not. These correlations do not reflect differential civic virtue; they reflect the fact that participation has costs — time, information, the belief that voting changes anything — and those costs are not evenly distributed.\n\nWhat is less discussed is how this participation gap shapes policy. Elected representatives are not indifferent to who votes for them. They hold surgeries, respond to letters, and pledge spending on the basis of where their voters are. If a constituency is reliably high-turnout and prosperous, it receives a different quality of political attention than one that is deprived and disengaged.\n\nThe result, over time, is a politics that is systematically skewed away from the most marginalised. Housing benefit freezes, the two-child benefit cap, the rollout of Universal Credit: each of these policies fell disproportionately on people with the lowest electoral leverage. None were electorally costly, because the people most affected were least likely to be in a polling booth.\n\nSome democracies have experimented with compulsory voting. Australia's system — where failure to vote incurs a small fine — produces turnout above 90 per cent and a measurably less skewed electorate. But compulsory voting is only part of the answer.\n\nThere is also the question of what people believe voting is for. In the communities with the lowest turnout, the most common reason given for not voting is not apathy but futility: a reasoned conclusion, based on experience, that the political system does not respond to people like them. This is not irrational. It is a measured assessment of the historical evidence.\n\nCorrecting for the participation deficit requires more than get-out-the-vote campaigns. It requires demonstrable policy responsiveness to non-voting populations — a kind of democratic commitment that runs against the current logic of political competition. It also requires taking seriously the possibility that representative democracy, as currently configured, does not represent everyone equally. That is not a comfortable conclusion for those who benefit from the current configuration. Which is, of course, precisely the problem.`,
          },
          'latejoin@demo.quorum.dev': {
            title: 'What Precarity Costs',
            body: `The IKEA bookcase in Dami's flat is held together with cable ties because she lost one of the cam locks in her last move and couldn't afford to replace the whole unit. She has moved four times in three years — twice because a landlord sold up, once because of a rent increase she couldn't absorb, once because of damp she couldn't get fixed.\n\nThis is a small thing. It is also not a small thing. Precarious housing produces precarious everything: precarious employment, because you can't take risks when your tenancy is uncertain; precarious relationships, because stress accumulates and overcrowded or unsuitable housing strains them; precarious health, because the cognitive load of financial instability is, in measurable physiological terms, exhausting.\n\nResearchers call this bandwidth poverty — the idea that financial precarity consumes cognitive resources that would otherwise be available for planning, self-regulation, and decision-making. A landmark study showed that the cognitive burden of financial stress is equivalent to losing thirteen IQ points. The implication is not that poor people make worse decisions; it is that scarcity makes good decision-making harder for anyone.\n\nThe economic literature on precarity focuses, understandably, on income. But income volatility — the unpredictability of earnings, not just their level — may be as damaging as income level. Gig economy workers earning reasonable average incomes report similar stress profiles to workers on lower but predictable wages.\n\nBritain's benefits system has compounded this problem in several ways. Universal Credit is paid monthly, in arrears, after a five-week wait for the first payment. For someone moving from fortnightly paid work, this is a structural cash-flow crisis built into the system's architecture.\n\nDami works in social care. She earns £12.40 an hour on a zero-hours contract. Some weeks she works thirty-five hours; some weeks she works eighteen. She cannot get a mortgage — the irregular income makes her unattractive to lenders. She cannot save reliably — the variable income makes long-term planning impossible.\n\nShe is not unusual. There are approximately four million workers in the UK on zero-hours or low-hours variable contracts. The political language around this tends toward flexibility — a word that describes the employer's position, not the worker's experience. From where Dami sits, flexibility is another word for risk, transferred from capital to labour, and worn by individuals whose bookcase is held together with cable ties.`,
          },
        }

        const fallback = FALLBACK[authorEmail as string]
        if (fallback) return Response.json({ title: fallback.title, body: fallback.body })

        return Response.json({ title: 'Untitled', body: 'No article found for this author.' })
      }

      case 'reset': {
        // Delete the cell (cascade deletes cell_members, briefs, invitations, submissions, publications, promotion_records)
        const { data: cell } = await admin
          .from('cells')
          .select('id')
          .eq('slug', DEMO_CELL_SLUG)
          .maybeSingle()

        if (cell) {
          const cellId = (cell as { id: string }).id

          // Delete child records that might not cascade
          await admin.from('promotion_records')
            .delete()
            .in(
              'publication_id',
              (await admin.from('publications').select('id').eq('cell_id', cellId)).data?.map((p: { id: string }) => p.id) ?? []
            )

          await admin.from('publications').delete().eq('cell_id', cellId)

          const briefIds = (await admin.from('briefs').select('id').eq('cell_id', cellId)).data?.map((b: { id: string }) => b.id) ?? []
          if (briefIds.length > 0) {
            await admin.from('invitations').delete().in('brief_id', briefIds)
            await admin.from('submissions').delete().in('brief_id', briefIds)
          }

          await admin.from('briefs').delete().eq('cell_id', cellId)
          await admin.from('cell_members').delete().eq('cell_id', cellId)
          await admin.from('cells').delete().eq('id', cellId)
        }

        return Response.json({ ok: true })
      }

      default:
        return Response.json({ error: `Unknown op: ${op}` }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
