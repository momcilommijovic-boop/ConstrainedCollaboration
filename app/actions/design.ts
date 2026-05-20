'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_TOKENS } from '@/lib/layout/defaults'
import { callLLM, getLLMProvider, robustParseJSON } from '@/lib/llm'
import type { DesignTokens, GoogleFontToken } from '@/lib/layout/types'
import { revalidatePath } from 'next/cache'

export type DesignActionState = { error: string | null; tokens?: DesignTokens }

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchPageCss(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Quorum/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    const cssData: string[] = []

    // Extract Google Fonts links
    const fontLinks = Array.from(html.matchAll(/href="(https:\/\/fonts\.googleapis\.com[^"]+)"/g))
    fontLinks.forEach((m) => cssData.push(`/* Google Font: ${m[1]} */`))

    // Extract <style> blocks
    const styleBlocks = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    styleBlocks.forEach((m) => cssData.push(m[1]))

    // Extract @font-face and CSS custom properties
    const result = cssData.join('\n').slice(0, 8000)
    return result || `/* No CSS extracted from ${url} */`
  } catch {
    return `/* Failed to fetch ${url} */`
  }
}

function fixGoogleFontUrl(url: string, family: string): string {
  if (url.startsWith('https://fonts.googleapis.com/css2?family=')) return url
  const encoded = family.replace(/ /g, '+')
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700&display=swap`
}

function mergeFontTokens(token: Partial<GoogleFontToken>, family: string): GoogleFontToken {
  return {
    family: token.family ?? family,
    google_font_url: fixGoogleFontUrl(token.google_font_url ?? '', token.family ?? family),
    weights: token.weights ?? ['400', '700'],
    fallback: token.fallback ?? 'serif',
  }
}

function mergeWithDefaults(partial: Partial<DesignTokens>): DesignTokens {
  const d = DEFAULT_TOKENS
  const p = partial

  const fonts = {
    heading: mergeFontTokens(p.fonts?.heading ?? {}, d.fonts.heading.family),
    subheading: mergeFontTokens(p.fonts?.subheading ?? {}, d.fonts.subheading.family),
    body: mergeFontTokens(p.fonts?.body ?? {}, d.fonts.body.family),
    ui: mergeFontTokens(p.fonts?.ui ?? {}, d.fonts.ui.family),
    pullquote: mergeFontTokens(p.fonts?.pullquote ?? {}, d.fonts.pullquote.family),
    caption: mergeFontTokens(p.fonts?.caption ?? {}, d.fonts.caption.family),
  }

  return {
    meta: { ...d.meta, ...(p.meta ?? {}) },
    fonts,
    colours: { ...d.colours, ...(p.colours ?? {}) },
    scale: { ...d.scale, ...(p.scale ?? {}) },
    spacing: { ...d.spacing, ...(p.spacing ?? {}) },
    image_style: { ...d.image_style, ...(p.image_style ?? {}) },
    typography_details: { ...d.typography_details, ...(p.typography_details ?? {}) },
  }
}

// ── extractDesignTokens ───────────────────────────────────────────────────────

export async function extractDesignTokens(
  prevState: DesignActionState,
  formData: FormData
): Promise<DesignActionState> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const cellId = formData.get('cell_id') as string
  const moodNotes = (formData.get('mood_notes') as string)?.trim() ?? ''

  // Auth: owner or editor
  const admin = createAdminClient()
  const { data: cell } = await admin
    .from('cells')
    .select('owner_id, slug')
    .eq('id', cellId)
    .single() as { data: { owner_id: string; slug: string } | null; error: unknown }

  if (!cell) return { error: 'Cell not found.' }

  const { data: membership } = await admin
    .from('cell_members')
    .select('role')
    .eq('cell_id', cellId)
    .eq('user_id', user.id)
    .single() as { data: { role: string } | null; error: unknown }

  const isOwner = cell.owner_id === user.id
  const isEditor = membership?.role === 'EDITOR'
  if (!isOwner && !isEditor) return { error: 'Only the Cell owner or Editor can manage design tokens.' }

  // Collect URL sources
  const urlSources: string[] = []
  for (let i = 0; i < 3; i++) {
    const u = (formData.get(`url_${i}`) as string)?.trim()
    if (u && u.startsWith('http')) urlSources.push(u)
  }

  // Collect screenshot uploads (store in Supabase Storage)
  const screenshotUrls: string[] = []
  for (let i = 0; i < 3; i++) {
    const file = formData.get(`screenshot_${i}`) as File | null
    if (!file || file.size === 0) continue
    if (file.size > 4 * 1024 * 1024) continue
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${cellId}/ref_${i}.${ext}`
    const bytes = await file.arrayBuffer()
    const { error: uploadErr } = await admin.storage
      .from('design-analysis')
      .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: true })
    if (!uploadErr) {
      const { data: urlData } = admin.storage.from('design-analysis').getPublicUrl(path)
      screenshotUrls.push(urlData.publicUrl)
    }
  }

  if (urlSources.length === 0 && screenshotUrls.length === 0) {
    return { error: 'Please provide at least one URL or screenshot.' }
  }

  // Fetch CSS from URLs
  const cssChunks = await Promise.all(urlSources.map(fetchPageCss))

  const typeDefinition = `type DesignTokens = { meta: { inspiration_label: string; mood: string; generated_at: string }; fonts: { heading: GoogleFontToken; subheading: GoogleFontToken; body: GoogleFontToken; ui: GoogleFontToken; pullquote: GoogleFontToken; caption: GoogleFontToken }; colours: { background: string; surface: string; text_primary: string; text_secondary: string; text_muted: string; accent: string; accent_light: string; border: string }; scale: { h1: string; h2: string; h3: string; h4: string; body: string; caption: string; ui: string; line_height_heading: string; line_height_body: string; letter_spacing_heading: string; letter_spacing_body: string; column_max_width: string; column_narrow_width: string }; spacing: { section_gap: string; block_gap: string; paragraph_gap: string; page_margin_horizontal: string; page_margin_vertical: string }; image_style: { treatment: 'full-bleed'|'framed'|'inset'|'borderless'; caption_position: 'below'|'overlay-bottom'|'beside'; border_radius: string; border_width: string }; typography_details: { drop_cap: boolean; pull_quote_style: 'large-italic-centred'|'ruled-left'|'full-width-display'|'marginal'; heading_case: 'sentence'|'title'|'upper'; byline_format: string; rule_style: 'solid'|'dashed'|'double'|'none'; rule_weight: string } }; type GoogleFontToken = { family: string; google_font_url: string; weights: string[]; fallback: string };`

  const systemPrompt = `You are a senior editorial art director analysing reference publications to extract a design system.
You will receive CSS data from one or more reference publications.
Your job is to identify the design language — typeface choices, colour palette, typographic scale, spacing rhythm, image treatment style — and translate it into a structured design token set for a new independent magazine.

Rules:
- All fonts must be available on Google Fonts. If the reference uses a paid font, identify the closest Google Fonts equivalent.
- Colours should be extracted or closely approximated — do not invent a palette that doesn't reflect the reference.
- If multiple references are provided, synthesise them — find the shared visual DNA, do not just copy one.
- Apply any mood notes from the user to modulate the result.
- Return JSON only, conforming exactly to the DesignTokens type. No markdown fences, no commentary.`

  // Build user message text (images only supported with Anthropic)
  const provider = getLLMProvider()
  let userText = `Generate design tokens for a new independent magazine based on the following references.\n\nType definition:\n${typeDefinition}\n`
  if (moodNotes) userText += `\nMood notes from the editor: "${moodNotes}"\n`
  urlSources.forEach((url, i) => {
    userText += `\n--- Reference ${i + 1}: ${url} ---\n${cssChunks[i] ?? '(no CSS extracted)'}`
  })
  if (screenshotUrls.length > 0 && provider === 'ollama') {
    userText += `\n\n(${screenshotUrls.length} screenshot(s) were uploaded but cannot be analysed by the local model — infer style from the URL CSS above.)`
  }
  userText += '\n\nNow output the DesignTokens JSON object:'

  try {
    let raw: string

    if (provider === 'anthropic' && screenshotUrls.length > 0) {
      // Anthropic path with vision (images included)
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      type Part =
        | { type: 'text'; text: string }
        | { type: 'image'; source: { type: 'url'; url: string } }
      const parts: Part[] = [
        { type: 'text', text: userText.replace('\n\nNow output the DesignTokens JSON object:', '') },
        ...screenshotUrls.map((url): Part => ({
          type: 'image',
          source: { type: 'url', url },
        })),
        { type: 'text', text: '\n\nNow output the DesignTokens JSON object:' },
      ]
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: parts }],
      })
      raw = response.content[0].type === 'text' ? response.content[0].text : ''
    } else {
      raw = await callLLM(userText, { system: systemPrompt, maxTokens: 4000 })
    }

    const parsed = robustParseJSON(raw) as Partial<DesignTokens>
    const tokens = mergeWithDefaults(parsed)

    // Build inspiration sources list
    const sources = [
      ...urlSources.map((url) => ({ type: 'url' as const, value: url, label: url })),
      ...screenshotUrls.map((url, i) => ({ type: 'screenshot' as const, value: url, label: `Screenshot ${i + 1}` })),
    ]

    // Upsert cell_design_tokens
    const { error: upsertErr } = await (admin
      .from('cell_design_tokens' as never)
      .upsert({
        cell_id: cellId,
        inspiration_sources: sources,
        tokens,
        generated_at: new Date().toISOString(),
        generated_by: user.id,
        manually_edited: false,
      } as never, { onConflict: 'cell_id' }) as unknown as Promise<{ error: unknown }>)

    if (upsertErr) return { error: 'Failed to save design tokens.' }

    revalidatePath(`/cells/${cell.slug}/settings/design`)
    return { error: null, tokens }

  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Design extraction failed.' }
  }
}

// ── saveDesignTokens ──────────────────────────────────────────────────────────

export async function saveDesignTokens(
  prevState: DesignActionState,
  formData: FormData
): Promise<DesignActionState> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const cellId = formData.get('cell_id') as string
  const tokensJson = formData.get('tokens') as string

  let tokens: DesignTokens
  try {
    tokens = JSON.parse(tokensJson) as DesignTokens
  } catch {
    return { error: 'Invalid token data.' }
  }

  const admin = createAdminClient()
  const { error } = await (admin
    .from('cell_design_tokens' as never)
    .upsert({
      cell_id: cellId,
      tokens,
      manually_edited: true,
      generated_at: new Date().toISOString(),
      generated_by: user.id,
      inspiration_sources: [],
    } as never, { onConflict: 'cell_id' }) as unknown as Promise<{ error: unknown }>)

  if (error) return { error: 'Save failed.' }

  const { data: cell } = await admin.from('cells').select('slug').eq('id', cellId).single() as { data: { slug: string } | null; error: unknown }
  revalidatePath(`/cells/${cell?.slug ?? ''}/settings/design`)

  return { error: null, tokens }
}
