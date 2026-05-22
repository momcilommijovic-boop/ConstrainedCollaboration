import type { ThemeTokens } from './types'

function hexToRgbTriplet(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '128 128 128'
  return `${r} ${g} ${b}`
}

const STYLE_ID = 'quorum-theme-override'
const STORAGE_KEY = 'quorum-demo-theme'

export function applyTheme(tokens: ThemeTokens): void {
  // Inject Google Font links
  const fonts = [tokens.fonts.heading, tokens.fonts.body, tokens.fonts.ui]
  const seenUrls = new Set<string>()
  for (const font of fonts) {
    if (!font.google_url || seenUrls.has(font.google_url)) continue
    seenUrls.add(font.google_url)
    const id = `quorum-font-${font.family.replace(/\s+/g, '-').toLowerCase()}`
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = font.google_url
      document.head.appendChild(link)
    }
  }

  // Build CSS override
  const c = tokens.colours
  const s = tokens.scale
  const f = tokens.fonts
  const css = `:root {
  --color-bg-rgb:      ${hexToRgbTriplet(c.background)};
  --color-text-rgb:    ${hexToRgbTriplet(c.text)};
  --color-accent-rgb:  ${hexToRgbTriplet(c.accent)};
  --color-muted-rgb:   ${hexToRgbTriplet(c.muted)};
  --color-surface-rgb: ${hexToRgbTriplet(c.surface)};
  --color-border-rgb:  ${hexToRgbTriplet(c.border)};
  --color-bg:      rgb(var(--color-bg-rgb));
  --color-text:    rgb(var(--color-text-rgb));
  --color-accent:  rgb(var(--color-accent-rgb));
  --color-muted:   rgb(var(--color-muted-rgb));
  --color-surface: rgb(var(--color-surface-rgb));
  --color-border:  rgb(var(--color-border-rgb));
  --font-heading: "${f.heading.family}", Georgia, serif;
  --font-body:    "${f.body.family}", Georgia, serif;
  --font-ui:      "${f.ui.family}", ui-monospace, monospace;
  --text-h1:   ${s.h1};
  --text-h2:   ${s.h2};
  --text-h3:   ${s.h3};
  --text-h4:   ${s.h4};
  --text-body: ${s.body};
  --leading-body:        ${s.line_height};
  --tracking-heading:    ${s.letter_spacing_heading};
}`

  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = css

  // Persist
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  } catch { /* storage unavailable */ }
}

export function resetTheme(): void {
  document.getElementById(STYLE_ID)?.remove()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* storage unavailable */ }
}

export function loadPersistedTheme(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const tokens = JSON.parse(raw) as ThemeTokens
    applyTheme(tokens)
  } catch { /* corrupt storage — ignore */ }
}

export function getPersistedTheme(): ThemeTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ThemeTokens
  } catch {
    return null
  }
}

const USER_PRESETS_KEY = 'quorum-user-presets'

export type UserPreset = { id: string; label: string; tokens: ThemeTokens }

export function getUserPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(USER_PRESETS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as UserPreset[]
  } catch {
    return []
  }
}

export function saveUserPreset(label: string, tokens: ThemeTokens): void {
  const presets = getUserPresets()
  const id = `user-${Date.now()}`
  presets.push({ id, label, tokens })
  try {
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets))
  } catch { /* storage unavailable */ }
}

export function deleteUserPreset(id: string): void {
  const presets = getUserPresets().filter(p => p.id !== id)
  try {
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets))
  } catch { /* storage unavailable */ }
}
