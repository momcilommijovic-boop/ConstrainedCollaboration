// Provider-agnostic LLM wrapper.
// robustParseJSON handles the common ways local models malform JSON output.
// Set LLM_PROVIDER=ollama in .env.local to use a local Ollama model instead of Anthropic.
// Ollama must be running at OLLAMA_BASE_URL (default: http://localhost:11434).

export type LLMProvider = 'anthropic' | 'ollama'

export function getLLMProvider(): LLMProvider {
  const v = process.env.LLM_PROVIDER
  if (v === 'ollama') return 'ollama'
  return 'anthropic'
}

interface CallOptions {
  maxTokens?: number
  system?: string
}

// Simple text-in / text-out call. Works for both providers.
export async function callLLM(
  userMessage: string,
  options: CallOptions = {}
): Promise<string> {
  const provider = getLLMProvider()
  const { maxTokens = 4000, system } = options

  if (provider === 'ollama') {
    return callOllama(system ?? '', userMessage, maxTokens)
  }
  return callAnthropic(system ?? '', userMessage, maxTokens)
}

async function callOllama(
  system: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL ?? 'qwen2'

  type OllamaMessage = { role: 'system' | 'user' | 'assistant'; content: string }
  const messages: OllamaMessage[] = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: userMessage })

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      stream: false,
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama error (${res.status}): ${text.slice(0, 200)}`)
  }

  type OllamaResponse = { choices: Array<{ message: { content: string } }> }
  const data = (await res.json()) as OllamaResponse
  return data.choices[0]?.message?.content ?? ''
}

async function callAnthropic(
  system: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: system || undefined,
    messages: [{ role: 'user', content: userMessage }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ── JSON extraction ───────────────────────────────────────────────────────────

/**
 * Single-pass preprocessor that converts JS/JSON5-style LLM output into
 * valid JSON. Handles, in one scan:
 *   - Double-quoted strings: copied verbatim, control chars escaped
 *   - Single-quoted strings: delimiters converted, inner " escaped, \' unescaped
 *   - // line comments: stripped
 *   - /* block comments: stripped
 * After the scan, a regex pass quotes any remaining bare object keys.
 */
function preprocessLLMJson(s: string): string {
  let out = ''
  let i = 0

  while (i < s.length) {
    // ── Double-quoted string ──────────────────────────────────────────────────
    if (s[i] === '"') {
      out += '"'
      i++
      while (i < s.length) {
        if (s[i] === '\\') {
          out += s[i] + (s[i + 1] ?? '')
          i += 2
        } else if (s[i] === '"') {
          out += '"'; i++; break
        } else {
          const c = s.charCodeAt(i)
          if (c < 0x20) {
            if      (c === 0x08) out += '\\b'
            else if (c === 0x09) out += '\\t'
            else if (c === 0x0a) out += '\\n'
            else if (c === 0x0c) out += '\\f'
            else if (c === 0x0d) out += '\\r'
            else out += `\\u${c.toString(16).padStart(4, '0')}`
          } else {
            out += s[i]
          }
          i++
        }
      }
      continue
    }

    // ── Single-quoted string → double-quoted ─────────────────────────────────
    if (s[i] === "'") {
      out += '"'
      i++
      while (i < s.length) {
        if (s[i] === '\\' && s[i + 1] === "'") {
          out += "'"; i += 2          // \' → literal apostrophe
        } else if (s[i] === '\\') {
          out += s[i] + (s[i + 1] ?? ''); i += 2
        } else if (s[i] === "'") {
          out += '"'; i++; break      // closing quote
        } else if (s[i] === '"') {
          out += '\\"'; i++           // bare " must be escaped
        } else {
          const c = s.charCodeAt(i)
          if (c < 0x20) {
            if      (c === 0x09) out += '\\t'
            else if (c === 0x0a) out += '\\n'
            else if (c === 0x0d) out += '\\r'
            else out += `\\u${c.toString(16).padStart(4, '0')}`
          } else {
            out += s[i]
          }
          i++
        }
      }
      continue
    }

    // ── Line comment (//) ─────────────────────────────────────────────────────
    if (s[i] === '/' && s[i + 1] === '/') {
      while (i < s.length && s[i] !== '\n') i++
      continue
    }

    // ── Block comment (/* ... */) ─────────────────────────────────────────────
    if (s[i] === '/' && s[i + 1] === '*') {
      i += 2
      while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++
      i += 2
      continue
    }

    out += s[i]; i++
  }

  // Quote any remaining bare object keys: { key: or , key:
  out = out.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')

  // Remove trailing commas before } or ]
  out = out.replace(/,(\s*[}\]])/g, '$1')

  return out
}

/**
 * Extracts and parses JSON from LLM output that may contain:
 * - Markdown code fences
 * - JS-style // and /* comments
 * - Single-quoted strings
 * - Unquoted object keys
 * - Literal control characters inside strings
 * - Trailing commas
 * - Preamble/postamble text
 * - Truncated output
 */
export function robustParseJSON(raw: string): unknown {
  // 1. Strip markdown fences
  let s = raw
    .replace(/^```(?:json|javascript|js)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim()

  // 2. Extract outermost { ... } or [ ... ] — discard any preamble text
  const objIdx = s.indexOf('{')
  const arrIdx = s.indexOf('[')

  if (objIdx === -1 && arrIdx === -1) {
    throw new SyntaxError('No JSON object or array found in LLM response')
  }

  const isObj  = objIdx !== -1 && (arrIdx === -1 || objIdx < arrIdx)
  const open   = isObj ? '{' : '['
  const close  = isObj ? '}' : ']'
  const start  = isObj ? objIdx : arrIdx
  const end    = s.lastIndexOf(close)

  s = end > start ? s.slice(start, end + 1) : s.slice(start) + close

  // 3. Full preprocessing pass (comments, quotes, control chars, bare keys, trailing commas)
  s = preprocessLLMJson(s)

  // 4. Parse — with one fallback trim if the model truncated mid-object
  try {
    return JSON.parse(s)
  } catch (firstErr) {
    const lastClose = s.lastIndexOf(open === '{' ? '}' : ']')
    if (lastClose > 0 && lastClose < s.length - 1) {
      const trimmed = preprocessLLMJson(
        s.slice(0, lastClose + 1)
      )
      return JSON.parse(trimmed)
    }
    throw firstErr
  }
}
