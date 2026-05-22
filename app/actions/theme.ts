'use server'

import type { ThemeTokens } from '@/lib/theme/types'

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const BOT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchText(url: string, timeoutMs = 10000): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BOT_UA,
        'Accept': 'text/html,text/css,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}

// ── Pre-extraction: regex-based color + font scraping ─────────────────────────
// This runs before the model call and gives the model concrete values to
// categorise rather than raw CSS to parse — much more reliable for small models.

const NAMED_COLORS: Record<string, string> = {
  white: '#FFFFFF', black: '#000000', transparent: '#FFFFFF',
  red: '#FF0000', blue: '#0000FF', green: '#008000',
  gray: '#808080', grey: '#808080', silver: '#C0C0C0',
  navy: '#000080', teal: '#008080', purple: '#800080',
  orange: '#FFA500', yellow: '#FFFF00', pink: '#FFC0CB',
  brown: '#A52A2A', beige: '#F5F5DC', ivory: '#FFFFF0',
  cream: '#FFFDD0', olive: '#808000', maroon: '#800000',
}

function parseColorToHex(v: unknown): string {
  if (typeof v !== 'string') return '#888888'
  const s = v.trim()

  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase()

  const hex3 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i)
  if (hex3) return ('#' + hex3[1]+hex3[1] + hex3[2]+hex3[2] + hex3[3]+hex3[3]).toUpperCase()

  if (/^[0-9a-f]{6}$/i.test(s)) return '#' + s.toUpperCase()

  const rgb = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgb) {
    return '#' + [rgb[1], rgb[2], rgb[3]]
      .map(n => Math.min(255, parseInt(n)).toString(16).padStart(2, '0'))
      .join('').toUpperCase()
  }

  const hsl = s.match(/hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%/)
  if (hsl) {
    const h = parseInt(hsl[1]) / 360
    const sat = parseInt(hsl[2]) / 100
    const l = parseInt(hsl[3]) / 100
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat
    const p = 2 * l - q
    const hue2rgb = (t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    return '#' + [h + 1/3, h, h - 1/3]
      .map(t => Math.round(hue2rgb(t) * 255).toString(16).padStart(2, '0'))
      .join('').toUpperCase()
  }

  const named = NAMED_COLORS[s.toLowerCase()]
  if (named) return named

  return '#888888'
}

function scrapeColors(text: string): string[] {
  const seen = new Set<string>()

  Array.from(text.matchAll(/#([0-9a-f]{6})\b/gi)).forEach(m => {
    seen.add('#' + m[1].toUpperCase())
  })
  Array.from(text.matchAll(/#([0-9a-f]{3})\b/gi)).forEach(m => {
    const [r, g, b] = m[1].split('')
    seen.add('#' + (r+r+g+g+b+b).toUpperCase())
  })
  Array.from(text.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)).forEach(m => {
    const hex = parseColorToHex(m[0])
    if (hex !== '#888888') seen.add(hex)
  })
  Array.from(text.matchAll(/hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%/gi)).forEach(m => {
    const hex = parseColorToHex(m[0])
    if (hex !== '#888888') seen.add(hex)
  })

  // Deduplicate very-similar colors (within 8 per channel)
  const unique: string[] = []
  Array.from(seen).forEach(hex => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const tooClose = unique.some(u => {
      const ur = parseInt(u.slice(1, 3), 16)
      const ug = parseInt(u.slice(3, 5), 16)
      const ub = parseInt(u.slice(5, 7), 16)
      return Math.abs(r - ur) < 8 && Math.abs(g - ug) < 8 && Math.abs(b - ub) < 8
    })
    if (!tooClose) unique.push(hex)
  })

  return unique.slice(0, 30)
}

function scrapeFonts(text: string): string[] {
  const seen = new Set<string>()
  Array.from(text.matchAll(/font-family\s*:\s*([^;{}]+)/gi)).forEach(m => {
    m[1].split(',').forEach(f => {
      const name = f.trim().replace(/^["']|["']$/g, '').trim()
      if (name && name.length > 1 && !/^(inherit|initial|unset|revert|sans-serif|serif|monospace|cursive|fantasy|system-ui|-apple-system)$/i.test(name)) {
        seen.add(name)
      }
    })
  })
  Array.from(text.matchAll(/family=([^&"'\s:]+)/gi)).forEach(m => {
    const name = decodeURIComponent(m[1]).replace(/\+/g, ' ')
    if (name) seen.add(name)
  })
  return Array.from(seen).slice(0, 15)
}

function scrapeFontSizes(text: string): string[] {
  const seen = new Set<string>()
  Array.from(text.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em))/gi)).forEach(m => {
    seen.add(m[1])
  })
  return Array.from(seen).slice(0, 10)
}

function scrapeGoogleFonts(text: string): string[] {
  const seen = new Set<string>()
  Array.from(text.matchAll(/https?:\/\/fonts\.googleapis\.com\/css[^"'\s)>]*/gi)).forEach(m => {
    seen.add(m[0])
  })
  return Array.from(seen).slice(0, 5)
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(
  url: string,
  colors: string[],
  fonts: string[],
  fontSizes: string[],
  googleFonts: string[],
): string {
  const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()

  const colorList = colors.length
    ? colors.join(', ')
    : 'no colors found — infer a neutral palette'

  const fontList = fonts.length
    ? fonts.join(', ')
    : 'no fonts found — use Inter'

  const sizeList = fontSizes.length
    ? fontSizes.join(', ')
    : 'no sizes found — use defaults'

  const gfList = googleFonts.length
    ? googleFonts.join('\n')
    : ''

  return `You are a design token classifier. Given the following values scraped from ${url}, return a JSON object assigning them to design token roles.

COLORS FOUND ON SITE: ${colorList}

FONTS FOUND ON SITE: ${fontList}

FONT SIZES FOUND: ${sizeList}

GOOGLE FONT URLS FOUND:
${gfList || '(none)'}

Return ONLY this JSON object with no other text. Use the actual values from above — do not invent new ones. If a role has no clear match, pick the closest color from the list.

{"source_url":"${url}","source_name":"${hostname}","fonts":{"heading":{"family":"FONT_NAME","weights":["400","700"],"google_url":"GOOGLE_URL_OR_INTER"},"body":{"family":"FONT_NAME","weights":["400"],"google_url":"GOOGLE_URL_OR_INTER"},"ui":{"family":"FONT_NAME","weights":["400","500"],"google_url":"GOOGLE_URL_OR_INTER"}},"colours":{"background":"LIGHTEST_COLOR","surface":"SECOND_LIGHTEST","text":"DARKEST_COLOR","muted":"MID_GREY","accent":"BRAND_COLOR","border":"LIGHT_GREY"},"scale":{"h1":"LARGEST_SIZE","h2":"SECOND_SIZE","h3":"THIRD_SIZE","h4":"FOURTH_SIZE","body":"BODY_SIZE","line_height":"1.6","letter_spacing_heading":"0em"}}`
}

// ── Model calls ───────────────────────────────────────────────────────────────

async function callAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic API error: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

async function callOllama(prompt: string): Promise<string> {
  const base = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '')
  const model = process.env.OLLAMA_MODEL ?? 'qwen2'

  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      format: 'json',
      stream: false,
      system: 'You are a JSON API. Output only a single valid JSON object. No prose, no explanation, no markdown.',
      prompt,
    }),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) throw new Error(`Ollama error: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return data.response ?? ''
}

// ── Response normalisation ────────────────────────────────────────────────────

function parseRawJson(raw: string): Record<string, unknown> | null {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const s = cleaned.indexOf('{')
    const e = cleaned.lastIndexOf('}')
    if (s === -1 || e === -1) return null
    return JSON.parse(cleaned.slice(s, e + 1))
  } catch { return null }
}

const FALLBACK_FONT = {
  family: 'Inter',
  weights: ['400', '500'],
  google_url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap',
}
const FALLBACK_COLOURS = {
  background: '#FFFFFF', surface: '#F5F5F5', text: '#111111',
  muted: '#666666', accent: '#0066CC', border: '#DDDDDD',
}
const FALLBACK_SCALE = {
  h1: '40px', h2: '28px', h3: '22px', h4: '18px',
  body: '16px', line_height: '1.6', letter_spacing_heading: '0em',
}

function coerceFont(v: unknown): { family: string; weights: string[]; google_url: string } {
  if (typeof v === 'string' && v.length > 1) return { ...FALLBACK_FONT, family: v }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return {
      family: String(o.family ?? o.name ?? o.font_family ?? 'Inter'),
      weights: Array.isArray(o.weights) ? o.weights.map(String) : ['400', '500'],
      google_url: String(o.google_url ?? o.url ?? o.href ?? FALLBACK_FONT.google_url),
    }
  }
  return { ...FALLBACK_FONT }
}

function normalizeTokens(raw: string, url: string): ThemeTokens | null {
  const obj = parseRawJson(raw)
  if (!obj) return null

  const rawColours = (obj.colours ?? obj.colors ?? obj.color ?? obj.palette ?? {}) as Record<string, unknown>
  const colours = {
    background: parseColorToHex(rawColours.background ?? rawColours.bg ?? FALLBACK_COLOURS.background),
    surface:    parseColorToHex(rawColours.surface ?? rawColours.surfaceColor ?? rawColours.card ?? FALLBACK_COLOURS.surface),
    text:       parseColorToHex(rawColours.text ?? rawColours.foreground ?? rawColours.textColor ?? FALLBACK_COLOURS.text),
    muted:      parseColorToHex(rawColours.muted ?? rawColours.secondary ?? rawColours.subtle ?? FALLBACK_COLOURS.muted),
    accent:     parseColorToHex(rawColours.accent ?? rawColours.primary ?? rawColours.brand ?? FALLBACK_COLOURS.accent),
    border:     parseColorToHex(rawColours.border ?? rawColours.divider ?? rawColours.separator ?? FALLBACK_COLOURS.border),
  }

  const rawFonts = (obj.fonts ?? obj.font ?? obj.typography ?? {}) as Record<string, unknown>
  const fonts = {
    heading: coerceFont(rawFonts.heading ?? rawFonts.display ?? rawFonts.title),
    body:    coerceFont(rawFonts.body ?? rawFonts.text ?? rawFonts.paragraph),
    ui:      coerceFont(rawFonts.ui ?? rawFonts.interface ?? rawFonts.mono ?? rawFonts.code),
  }

  const rawScale = (obj.scale ?? obj.sizes ?? obj.type_scale ?? {}) as Record<string, unknown>
  const px = (v: unknown, fb: string) =>
    v ? (String(v).includes('px') ? String(v) : String(v) + 'px') : fb

  const scale = {
    h1:   px(rawScale.h1 ?? rawScale.heading1, FALLBACK_SCALE.h1),
    h2:   px(rawScale.h2 ?? rawScale.heading2, FALLBACK_SCALE.h2),
    h3:   px(rawScale.h3 ?? rawScale.heading3, FALLBACK_SCALE.h3),
    h4:   px(rawScale.h4 ?? rawScale.heading4, FALLBACK_SCALE.h4),
    body: px(rawScale.body ?? rawScale.base ?? rawScale.paragraph, FALLBACK_SCALE.body),
    line_height:            String(rawScale.line_height ?? rawScale.lineHeight ?? FALLBACK_SCALE.line_height),
    letter_spacing_heading: String(rawScale.letter_spacing_heading ?? rawScale.letterSpacing ?? FALLBACK_SCALE.letter_spacing_heading),
  }

  return {
    source_url:  String(obj.source_url ?? url),
    source_name: String(obj.source_name ?? obj.name ?? obj.brand ?? (() => { try { return new URL(url).hostname } catch { return url } })()),
    fonts,
    colours,
    scale,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export type LLMProvider = 'anthropic' | 'ollama'

export async function extractThemeFromUrl(
  url: string,
  provider?: LLMProvider,
): Promise<{ tokens?: ThemeTokens; error?: string; debug?: string }> {
  if (!url.startsWith('http')) return { error: 'Invalid URL' }

  const resolvedProvider: LLMProvider =
    provider ?? ((process.env.LLM_PROVIDER === 'ollama' ? 'ollama' : 'anthropic') as LLMProvider)

  // Step 1: fetch the page
  const html = await fetchText(url)
  if (!html) return { error: `Could not fetch ${url} — site may block server-side requests` }

  // Step 2: find stylesheet URLs in the HTML
  const sheetHrefs: string[] = []
  Array.from(html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)).forEach(m => {
    if (sheetHrefs.length >= 3) return
    const href = m[1]
    if (href.startsWith('http')) sheetHrefs.push(href)
    else if (href.startsWith('/')) {
      try { sheetHrefs.push(new URL(href, url).toString()) } catch { /* skip */ }
    }
  })

  // Step 3: fetch stylesheets in parallel, combine with inline styles
  const sheetTexts = await Promise.all(sheetHrefs.map(h => fetchText(h, 8000)))
  const inlineStyles: string[] = []
  Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).forEach(m => {
    inlineStyles.push(m[1].slice(0, 6000))
  })

  const allCss = [html, ...sheetTexts, ...inlineStyles].join('\n')

  // Step 4: pre-extract concrete values (model gets a list, not raw CSS)
  const colors    = scrapeColors(allCss)
  const fonts     = scrapeFonts(allCss)
  const fontSizes = scrapeFontSizes(allCss)
  const gFonts    = scrapeGoogleFonts(allCss)

  const debugInfo = `colors(${colors.length}): ${colors.slice(0,8).join(' ')} | fonts: ${fonts.slice(0,4).join(', ')} | sizes: ${fontSizes.slice(0,5).join(', ')}`
  console.log(`[theme-extract] ${url}`, debugInfo)

  const prompt = buildPrompt(url, colors, fonts, fontSizes, gFonts)

  // Step 5: call the model
  let raw = ''
  try {
    raw = resolvedProvider === 'ollama'
      ? await callOllama(prompt)
      : await callAnthropic(prompt)
    console.log(`[theme-extract] model response (${raw.length} chars):`, raw.slice(0, 400))
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }

  // Step 6: parse and normalise
  const tokens = normalizeTokens(raw, url)
  if (!tokens) {
    return { error: `No JSON in model response`, debug: raw.slice(0, 300) }
  }

  return { tokens, debug: debugInfo }
}

export async function getDefaultLLMProvider(): Promise<LLMProvider> {
  return (process.env.LLM_PROVIDER === 'ollama' ? 'ollama' : 'anthropic') as LLMProvider
}
