'use server'

import Anthropic from '@anthropic-ai/sdk'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gatherCycleContext } from '@/lib/retrospective/gather'
import { ELEVENLABS_VOICE_MAP, ELEVENLABS_MODEL, ELEVENLABS_API_BASE } from '@/lib/retrospective/voice-map'
import type { EpisodeScript, VoicePersona } from '@/lib/retrospective/types'

export type RetrospectiveActionState = { error: string | null }

const MAX_SEGMENTS = 8

// ── Main server action ────────────────────────────────────────────────────────

export async function generateRetrospective(
  prevState: RetrospectiveActionState,
  formData: FormData
): Promise<RetrospectiveActionState> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const cellId = formData.get('cell_id') as string
  const cycle = parseInt(formData.get('cycle') as string, 10)
  if (!cellId || isNaN(cycle)) return { error: 'Invalid request.' }

  const admin = createAdminClient()

  // Auth: must be cell owner or admin
  const { data: cell } = await admin
    .from('cells')
    .select('owner_id, slug, title')
    .eq('id', cellId)
    .single() as { data: { owner_id: string; slug: string; title: string } | null; error: unknown }

  if (!cell) return { error: 'Cell not found.' }

  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single() as { data: { is_admin: boolean } | null; error: unknown }

  if (cell.owner_id !== user.id && !profile?.is_admin) {
    return { error: 'Only the Cell owner or an admin can generate a retrospective.' }
  }

  // Idempotency: if READY retrospective already exists, redirect to it
  const { data: existing } = await admin
    .from('retrospectives')
    .select('id, status')
    .eq('cell_id', cellId)
    .eq('cycle', cycle)
    .maybeSingle() as { data: { id: string; status: string } | null; error: unknown }

  if (existing?.status === 'READY') {
    redirect(`/cells/${cell.slug}/retrospective/${cycle}`)
  }

  const ttsProvider = process.env.NEXT_PUBLIC_TTS_PROVIDER === 'elevenlabs' &&
    process.env.ELEVENLABS_API_KEY
    ? 'elevenlabs'
    : 'webspeech'

  // Create or reset the retrospective row
  let retroId: string

  type RetroInsert = { cell_id: string; cycle: number; status: string; tts_provider: string; generated_at: string }
  type RetroUpdate = { status?: string; tts_provider?: string; generated_at?: string; episode_title?: string; episode_summary?: string }

  if (existing) {
    retroId = existing.id
    await (admin
      .from('retrospectives')
      .update({ status: 'GENERATING', tts_provider: ttsProvider, generated_at: new Date().toISOString() } as RetroUpdate as never)
      .eq('id', retroId) as unknown as Promise<{ error: unknown }>)
    // Clear old segments
    await (admin.from('retrospective_segments').delete().eq('retrospective_id', retroId) as unknown as Promise<{ error: unknown }>)
  } else {
    const { data: newRetro, error: insertErr } = await (admin
      .from('retrospectives')
      .insert({
        cell_id: cellId,
        cycle,
        status: 'GENERATING',
        tts_provider: ttsProvider,
        generated_at: new Date().toISOString(),
      } as RetroInsert as never)
      .select('id')
      .single() as unknown as Promise<{ data: { id: string } | null; error: unknown }>)

    if (insertErr || !newRetro) return { error: 'Failed to create retrospective record.' }
    retroId = newRetro.id
  }

  try {
    // ── 1. Gather cycle data ────────────────────────────────────────────────
    const context = await gatherCycleContext(cellId, cycle)

    // ── 2. Call Claude API ──────────────────────────────────────────────────
    const script = await generateScript(context)

    // Cap at MAX_SEGMENTS
    const segments = script.segments.slice(0, MAX_SEGMENTS)

    // ── 3. Save text segments ───────────────────────────────────────────────
    const segmentRows = segments.map((seg, i) => ({
      retrospective_id: retroId,
      segment_index: i,
      speaker_name: seg.speaker_name,
      speaker_role: seg.speaker_role,
      speaker_status: seg.speaker_status,
      voice_persona: seg.voice_persona,
      text: seg.text,
      duration_estimate_seconds: seg.duration_estimate_seconds,
      audio_url: null as string | null,
    }))

    type SegInsert = typeof segmentRows[0]
    const { data: insertedSegments, error: segErr } = await (admin
      .from('retrospective_segments')
      .insert(segmentRows as SegInsert[] as never)
      .select('id, segment_index') as unknown as Promise<{ data: { id: string; segment_index: number }[] | null; error: unknown }>)

    if (segErr || !insertedSegments) {
      await (admin.from('retrospectives').update({ status: 'FAILED' } as RetroUpdate as never).eq('id', retroId) as unknown as Promise<unknown>)
      return { error: 'Failed to save episode segments.' }
    }

    // ── 4. Update title/summary ─────────────────────────────────────────────
    await (admin
      .from('retrospectives')
      .update({ episode_title: script.episode_title, episode_summary: script.episode_summary } as RetroUpdate as never)
      .eq('id', retroId) as unknown as Promise<unknown>)

    // ── 5. TTS generation (ElevenLabs only) ────────────────────────────────
    if (ttsProvider === 'elevenlabs') {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const segRow = insertedSegments.find((s) => s.segment_index === i)
        if (!segRow) continue

        try {
          const audioUrl = await generateElevenLabsAudio(
            seg.text,
            seg.voice_persona as VoicePersona,
            cellId,
            cycle,
            i
          )
          if (audioUrl) {
            await (admin
              .from('retrospective_segments')
              .update({ audio_url: audioUrl } as never)
              .eq('id', segRow.id) as unknown as Promise<unknown>)
          }
        } catch {
          // Segment TTS failure: leave audio_url null — player falls back to webspeech for this segment
        }
      }
    }

    // ── 6. Mark ready ───────────────────────────────────────────────────────
    await (admin.from('retrospectives').update({ status: 'READY' } as RetroUpdate as never).eq('id', retroId) as unknown as Promise<unknown>)

  } catch (err) {
    await (admin.from('retrospectives').update({ status: 'FAILED' } as RetroUpdate as never).eq('id', retroId) as unknown as Promise<unknown>)
    return { error: err instanceof Error ? err.message : 'Generation failed.' }
  }

  redirect(`/cells/${cell.slug}/retrospective/${cycle}`)
}

// ── LLM call (Anthropic or Ollama) ───────────────────────────────────────────

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const provider = process.env.LLM_PROVIDER ?? 'anthropic'

  if (provider === 'ollama') {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
    const model = process.env.OLLAMA_MODEL ?? 'qwen2'

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        // Ollama respects max_tokens via this field in OpenAI-compat mode
        max_tokens: 4000,
        stream: false,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Ollama error ${res.status}: ${body}`)
    }

    const json = await res.json() as { choices: Array<{ message: { content: string } }> }
    return json.choices?.[0]?.message?.content ?? ''
  }

  // Default: Anthropic
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

async function generateScript(context: Awaited<ReturnType<typeof gatherCycleContext>>): Promise<EpisodeScript> {
  // (provider resolved inside callLLM)

  const systemPrompt = `You are writing a fictional audio documentary about a completed editorial collaboration.
The participants are real people with distinct personalities shaped by what they did and didn't do during the process.
Write each interview segment as first-person spoken word — natural, slightly informal, as if recorded after the fact.
Each voice must be psychologically distinct. A person who was kicked speaks differently from someone who thrived.
An editor who had submissions rejected defends their decisions. A writer who missed a deadline has a rationalisation.
Do not summarise — inhabit the character. Reveal the friction, the pride, the disappointment.
If the cycle was sparse (few members, few events), lean into the intimacy — quieter stakes are still real stakes.
Return JSON only. No markdown fences.`

  const hasKicked = context.members.some((m) => m.status === 'KICKED')
  const hasPenalties = context.penalties.length > 0
  const editorName = context.members.find((m) => m.role === 'EDITOR')?.display_name ?? 'the editor'

  const userMessage = `Generate a retrospective audio documentary episode for the following completed Cell cycle.

CELL: ${context.cell.title}
CYCLE: ${context.cell.cycle}

MEMBERS (${context.members.length}):
${context.members.map((m) =>
  `- ${m.display_name} | role: ${m.role} | status: ${m.status} | merit: ${m.merit_score}` +
  (m.merit_history.length > 0
    ? `\n  merit history: ${m.merit_history.map((h) => `${h.event} (${h.delta > 0 ? '+' : ''}${h.delta})`).join(', ')}`
    : '')
).join('\n')}

BRIEF${context.brief ? ` (editor: ${editorName}):
  title: "${context.brief.title}"
  theme: ${context.brief.theme}
  guidance: ${context.brief.guidance}
  deadline: ${context.brief.deadline}` : ': none published'}

INVITATIONS:
${context.invitations.length > 0
  ? context.invitations.map((i) => `- ${i.invitee_name}: ${i.status}`).join('\n')
  : '- none'}

SUBMISSIONS (${context.submissions.length}):
${context.submissions.length > 0
  ? context.submissions.map((s) =>
      `- ${s.author_name}: "${s.title ?? 'untitled'}" | ${s.status}` +
      (s.editor_note ? `\n  editor note: "${s.editor_note}"` : '')
    ).join('\n')
  : '- none received'}

PUBLICATION: ${context.publication
  ? `${context.publication.article_count} article(s) | status: ${context.publication.status}`
  : 'not published'}

PROMOTION:
${context.promotionRecords.length > 0
  ? context.promotionRecords.map((p) => `- ${p.member_name}: ${p.status}`).join('\n')
  : '- no records'}

PENALTIES (${context.penalties.length}):
${context.penalties.length > 0
  ? context.penalties.map((p) => `- ${p.member_name} | ${p.reason} | ${p.merit_delta} merit | stage: ${p.stage ?? '?'}`).join('\n')
  : '- none'}

${hasKicked ? `NOTE: One or more members were kicked. Their voice should reflect this — defiant, aggrieved, or resigned.` : ''}
${hasPenalties && !hasKicked ? `NOTE: Penalties were applied but no one was kicked. The tone is cautionary rather than dramatic.` : ''}

Generate the episode in this exact JSON structure. Order: editor first, then writers who submitted (accepted before rejected/rework), then writers who missed, then remaining members by most dramatic merit arc. End with whoever had the most dramatic arc (highest merit change or the kicked person):

{
  "episode_title": "...",
  "episode_summary": "...",
  "segments": [
    {
      "speaker_name": "...",
      "speaker_role": "EDITOR|WRITER|ILLUSTRATOR|MEMBER",
      "speaker_status": "ACTIVE|WARNED|KICKED",
      "voice_persona": "measured|defensive|enthusiastic|regretful|pragmatic|bitter|proud",
      "text": "...",
      "duration_estimate_seconds": 45
    }
  ]
}

Each segment: 80–180 words of natural spoken word. Total episode: 4–7 minutes. Maximum ${MAX_SEGMENTS} segments.`

  const text = await callLLM(systemPrompt, userMessage)

  // Strip any accidental markdown fences
  const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  const parsed = JSON.parse(clean) as EpisodeScript

  if (!parsed.segments || !Array.isArray(parsed.segments)) {
    throw new Error('Claude returned malformed episode JSON.')
  }

  return parsed
}

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────

async function generateElevenLabsAudio(
  text: string,
  persona: VoicePersona,
  cellId: string,
  cycle: number,
  segmentIndex: number
): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return null

  const voiceId = ELEVENLABS_VOICE_MAP[persona]
  const response = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })

  if (!response.ok) {
    throw new Error(`ElevenLabs error ${response.status}: ${await response.text()}`)
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer())

  // Upload to Supabase Storage (admin client for service-role access)
  const admin = createAdminClient()
  const storagePath = `${cellId}/${cycle}/segment_${segmentIndex}.mp3`

  const { error: uploadErr } = await admin.storage
    .from('retrospectives')
    .upload(storagePath, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

  if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`)

  const { data: urlData } = admin.storage.from('retrospectives').getPublicUrl(storagePath)
  return urlData.publicUrl
}
