'use client'

import { useEffect, useRef } from 'react'
import type { DesignTokens } from '@/lib/layout/types'

const MOCK_ARTICLE_HTML = (tokens: DesignTokens) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
@import url('${tokens.fonts.heading.google_font_url}');
@import url('${tokens.fonts.body.google_font_url}');
@import url('${tokens.fonts.ui.google_font_url}');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: ${tokens.colours.background};
  color: ${tokens.colours.text_primary};
  font-family: '${tokens.fonts.body.family}', ${tokens.fonts.body.fallback};
  font-size: ${tokens.scale.body};
  line-height: ${tokens.scale.line_height_body};
  padding: 2rem;
}
.preview-label {
  font-family: '${tokens.fonts.ui.family}', ${tokens.fonts.ui.fallback};
  font-size: ${tokens.scale.ui};
  color: ${tokens.colours.text_muted};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}
.preview-section { margin-bottom: 2rem; border-top: 1px solid ${tokens.colours.border}; padding-top: 1.5rem; }
.swatch-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.swatch {
  width: 40px;
  height: 40px;
  border: 1px solid ${tokens.colours.border};
  position: relative;
}
.swatch-label {
  font-family: '${tokens.fonts.ui.family}', ${tokens.fonts.ui.fallback};
  font-size: 9px;
  color: ${tokens.colours.text_muted};
  margin-top: 0.25rem;
  text-align: center;
  width: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
h1 {
  font-family: '${tokens.fonts.heading.family}', ${tokens.fonts.heading.fallback};
  font-size: ${tokens.scale.h1};
  line-height: ${tokens.scale.line_height_heading};
  letter-spacing: ${tokens.scale.letter_spacing_heading};
  color: ${tokens.colours.text_primary};
  margin-bottom: 0.5rem;
  text-transform: ${tokens.typography_details.heading_case === 'upper' ? 'uppercase' : tokens.typography_details.heading_case === 'title' ? 'capitalize' : 'none'};
}
h2 {
  font-family: '${tokens.fonts.heading.family}', ${tokens.fonts.heading.fallback};
  font-size: ${tokens.scale.h2};
  line-height: ${tokens.scale.line_height_heading};
  letter-spacing: ${tokens.scale.letter_spacing_heading};
  color: ${tokens.colours.text_primary};
  margin-bottom: 0.5rem;
}
h3 {
  font-family: '${tokens.fonts.heading.family}', ${tokens.fonts.heading.fallback};
  font-size: ${tokens.scale.h3};
  color: ${tokens.colours.text_primary};
}
h4 {
  font-family: '${tokens.fonts.subheading.family}', ${tokens.fonts.subheading.fallback};
  font-size: ${tokens.scale.h4};
  color: ${tokens.colours.text_secondary};
}
.byline {
  font-family: '${tokens.fonts.ui.family}', ${tokens.fonts.ui.fallback};
  font-size: ${tokens.scale.ui};
  color: ${tokens.colours.text_muted};
  letter-spacing: 0.05em;
  padding: 0.75rem 0;
  border-top: ${tokens.typography_details.rule_weight} ${tokens.typography_details.rule_style} ${tokens.colours.border};
  border-bottom: ${tokens.typography_details.rule_weight} ${tokens.typography_details.rule_style} ${tokens.colours.border};
  margin: 1rem 0;
}
p { margin-bottom: 1rem; }
blockquote {
  border-left: 3px solid ${tokens.colours.accent};
  padding-left: 1rem;
  font-family: '${tokens.fonts.pullquote.family}', ${tokens.fonts.pullquote.fallback};
  font-style: italic;
  font-size: 1.2rem;
  color: ${tokens.colours.text_primary};
  margin: 1.5rem 0;
}
.img-placeholder {
  background: ${tokens.colours.surface};
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 1rem 0;
  font-family: '${tokens.fonts.ui.family}', ${tokens.fonts.ui.fallback};
  font-size: ${tokens.scale.ui};
  color: ${tokens.colours.text_muted};
}
</style>
</head>
<body>
<div class="preview-section">
<p class="preview-label">Typography — Heading</p>
<h1>The Weight of Silence</h1>
<h2>An Investigation into What Was Left Unsaid</h2>
<h3>A Section Heading</h3>
<h4>Subheading level</h4>
</div>
<div class="preview-section">
<p class="preview-label">Article</p>
<div class="byline">By Margot Sinclair — Issue 4</div>
<div class="img-placeholder">[ Image placeholder ]</div>
<p>The city never sleeps, but it dreams. In the hours before dawn, when the streets are empty of everything but the faint hum of refrigeration units and the occasional taxi, something shifts in the architecture of the night — a quality of attention that daylight burns away.</p>
<p>She had been working on the piece for three months when the subject stopped returning her calls. It was not unusual. Sources went cold for any number of reasons: fear, regret, a lawyer's quiet counsel. But something in the timing felt deliberate.</p>
<blockquote>The city never sleeps, but it dreams — in the hours before dawn something shifts.</blockquote>
<p>By the time the official statement arrived — four paragraphs of institutional non-language — she had already filed. The editor read it twice and said nothing. That silence was its own kind of answer.</p>
</div>
<div class="preview-section">
<p class="preview-label">Colours</p>
<div class="swatch-row">
${Object.entries(tokens.colours).map(([key, val]) => `
<div>
<div class="swatch" style="background:${val}"></div>
<div class="swatch-label">${key}</div>
</div>`).join('')}
</div>
</div>
</body>
</html>
`

interface Props {
  tokens: DesignTokens
}

export function DesignPreview({ tokens }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const frame = iframeRef.current
    if (!frame) return
    const doc = frame.contentDocument ?? frame.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(MOCK_ARTICLE_HTML(tokens))
    doc.close()
  }, [tokens])

  return (
    <div className="border border-near-black/20">
      <div className="border-b border-near-black/20 px-4 py-2">
        <p className="font-mono text-xs text-olive uppercase tracking-widest">Preview</p>
      </div>
      <iframe
        ref={iframeRef}
        title="Design preview"
        className="w-full"
        style={{ height: '600px', border: 'none' }}
        sandbox="allow-same-origin"
      />
    </div>
  )
}
