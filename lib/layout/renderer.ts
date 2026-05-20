import type { Block, DesignTokens, MediaItem, Page, SubmissionForRender } from './types'

// ── CSS injection ─────────────────────────────────────────────────────────────

function buildFontImports(tokens: DesignTokens): string {
  const seen = new Set<string>()
  const imports: string[] = []
  for (const font of Object.values(tokens.fonts)) {
    if (!seen.has(font.google_font_url)) {
      seen.add(font.google_font_url)
      imports.push(`@import url('${font.google_font_url}');`)
    }
  }
  return imports.join('\n')
}

function buildCssVars(tokens: DesignTokens): string {
  const t = tokens
  return `:root {
  --font-heading: '${t.fonts.heading.family}', ${t.fonts.heading.fallback};
  --font-subheading: '${t.fonts.subheading.family}', ${t.fonts.subheading.fallback};
  --font-body: '${t.fonts.body.family}', ${t.fonts.body.fallback};
  --font-ui: '${t.fonts.ui.family}', ${t.fonts.ui.fallback};
  --font-pullquote: '${t.fonts.pullquote.family}', ${t.fonts.pullquote.fallback};
  --font-caption: '${t.fonts.caption.family}', ${t.fonts.caption.fallback};
  --color-bg: ${t.colours.background};
  --color-surface: ${t.colours.surface};
  --color-text: ${t.colours.text_primary};
  --color-text-secondary: ${t.colours.text_secondary};
  --color-muted: ${t.colours.text_muted};
  --color-accent: ${t.colours.accent};
  --color-accent-light: ${t.colours.accent_light};
  --color-border: ${t.colours.border};
  --scale-h1: ${t.scale.h1};
  --scale-h2: ${t.scale.h2};
  --scale-h3: ${t.scale.h3};
  --scale-h4: ${t.scale.h4};
  --scale-body: ${t.scale.body};
  --scale-caption: ${t.scale.caption};
  --scale-ui: ${t.scale.ui};
  --lh-heading: ${t.scale.line_height_heading};
  --lh-body: ${t.scale.line_height_body};
  --ls-heading: ${t.scale.letter_spacing_heading};
  --ls-body: ${t.scale.letter_spacing_body};
  --col-max: ${t.scale.column_max_width};
  --col-narrow: ${t.scale.column_narrow_width};
  --gap-section: ${t.spacing.section_gap};
  --gap-block: ${t.spacing.block_gap};
  --gap-para: ${t.spacing.paragraph_gap};
  --margin-h: ${t.spacing.page_margin_horizontal};
  --margin-v: ${t.spacing.page_margin_vertical};
  --img-radius: ${t.image_style.border_radius};
  --img-border: ${t.image_style.border_width};
  --rule-style: ${t.typography_details.rule_style};
  --rule-weight: ${t.typography_details.rule_weight};
}`
}

function buildBaseStyles(tokens: DesignTokens): string {
  const headingCase =
    tokens.typography_details.heading_case === 'upper'
      ? 'uppercase'
      : tokens.typography_details.heading_case === 'title'
      ? 'capitalize'
      : 'none'

  const pullQuoteStyle = buildPullQuoteStyle(tokens)

  return `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { font-size: 16px; }

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--scale-body);
  line-height: var(--lh-body);
  letter-spacing: var(--ls-body);
}

.pub-page {
  padding: var(--margin-v) var(--margin-h);
  /*
   * Extra margin-h on each side beyond col-max gives "wide" articles
   * meaningful breathing room. Standard articles (max-width: col-max)
   * are centred within this wider container; wide articles fill it.
   */
  max-width: calc(var(--col-max) + 4 * var(--margin-h));
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--gap-section);
}

h1, h2, h3, h4 {
  font-family: var(--font-heading);
  line-height: var(--lh-heading);
  letter-spacing: var(--ls-heading);
  color: var(--color-text);
  text-transform: ${headingCase};
}

h1 { font-size: var(--scale-h1); }
h2 { font-size: var(--scale-h2); }
h3 { font-size: var(--scale-h3); }
h4 { font-size: var(--scale-h4); font-family: var(--font-subheading); }

p { margin-bottom: var(--gap-para); }
p:last-child { margin-bottom: 0; }

/* Article paragraphs need at least one line-height of space so the break
   reads as a paragraph gap, not just a large line-spacing. */
.article-body p { margin-bottom: max(var(--gap-para), 1.8em); }
.article-body p:last-child { margin-bottom: 0; }

figure { margin: 0; }
figcaption {
  font-family: var(--font-caption);
  font-size: var(--scale-caption);
  color: var(--color-muted);
  margin-top: 0.5rem;
}

.pub-block { margin-bottom: var(--gap-block); }
.pub-block:last-child { margin-bottom: 0; }

/* Article body */
.article-body {
  max-width: var(--col-max);
  margin: 0 auto;
}
.article-body--narrow { max-width: var(--col-narrow); }
.article-body--wide { max-width: 100%; }

/* Drop cap — uses first-of-type so title/byline elements before body don't interfere */
.drop-cap > p:first-of-type::first-letter {
  font-family: var(--font-heading);
  font-size: 3.5em;
  line-height: 0.8;
  float: left;
  margin-right: 0.08em;
  margin-top: 0.05em;
  color: var(--color-text);
}

/* Article title / byline rendered inside the body block */
.article-title {
  font-family: var(--font-heading);
  font-size: var(--scale-h2);
  line-height: var(--lh-heading);
  letter-spacing: var(--ls-heading);
  margin-bottom: 0.4rem;
}
.article-byline-inline {
  font-family: var(--font-ui);
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  letter-spacing: 0.04em;
  margin-bottom: 1.25rem;
}

/* Inline image (float) rendered inside the article body */
.article-inline-image {
  float: left;
  margin: 0.25rem 1.5rem 1rem 0;
}
.article-inline-image--right {
  float: right;
  margin: 0.25rem 0 1rem 1.5rem;
}
.article-inline-image img {
  display: block;
  width: 100%;
  border-radius: var(--img-radius);
  border: var(--img-border) solid var(--color-border);
}
.article-inline-image figcaption {
  font-family: var(--font-caption);
  font-size: var(--scale-caption);
  color: var(--color-muted);
  margin-top: 0.5rem;
}
.article-body-clear::after { content: ''; display: table; clear: both; }

/* Cover */
.pub-cover {
  position: relative;
  min-height: 80vh;
  display: flex;
  align-items: flex-end;
  background: var(--color-text);
  overflow: hidden;
}
.pub-cover--centre { align-items: center; justify-content: center; text-align: center; }
.pub-cover--top-left { align-items: flex-start; justify-content: flex-start; }
.pub-cover--top-right { align-items: flex-start; justify-content: flex-end; text-align: right; }
.pub-cover--bottom-right { justify-content: flex-end; text-align: right; }
.pub-cover__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pub-cover__overlay {
  position: absolute;
  inset: 0;
  background: var(--color-text);
}
.pub-cover__text {
  position: relative;
  padding: 3rem var(--margin-h);
  color: var(--color-bg);
  max-width: 800px;
}
.pub-cover__issue {
  font-family: var(--font-ui);
  font-size: var(--scale-ui);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 1rem;
  opacity: 0.7;
}
.pub-cover__title {
  font-family: var(--font-heading);
  font-size: var(--scale-h1);
  line-height: var(--lh-heading);
  letter-spacing: var(--ls-heading);
  color: var(--color-bg);
  margin-bottom: 1rem;
}
.pub-cover__subtitle {
  font-family: var(--font-body);
  font-size: var(--scale-h4);
  color: var(--color-bg);
  opacity: 0.8;
}

/* Pull quote */
${pullQuoteStyle}

/* Byline */
.pub-byline {
  font-family: var(--font-ui);
  font-size: 0.875rem;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-top: var(--rule-weight) var(--rule-style) var(--color-border);
  border-bottom: var(--rule-weight) var(--rule-style) var(--color-border);
}
.pub-byline--centre { justify-content: center; }
.pub-byline--right  { justify-content: flex-end; }
.pub-byline__name { color: var(--color-text-secondary); }
.pub-byline__date { color: var(--color-muted); font-size: 0.75rem; }
.pub-byline a { color: inherit; text-decoration: none; }
.pub-byline a:hover { color: var(--color-accent); }

/* Standfirst */
.pub-standfirst {
  font-family: var(--font-subheading);
  font-size: var(--scale-h4);
  line-height: 1.4;
  color: var(--color-text-secondary);
  font-style: italic;
}

/* Heading block */
.pub-heading { max-width: var(--col-max); margin: 0 auto; }
.pub-heading--centre { text-align: center; }
.pub-heading--right { text-align: right; }

/* Divider */
.pub-divider--rule {
  border: none;
  border-top: var(--rule-weight) var(--rule-style) var(--color-border);
  margin: 0;
}
.pub-divider--ornament {
  text-align: center;
  font-family: var(--font-ui);
  color: var(--color-muted);
  letter-spacing: 0.5em;
}
.pub-divider--whitespace { height: 2rem; }

/* Contents */
.pub-contents { max-width: var(--col-max); margin: 0 auto; }
.pub-contents__title {
  font-family: var(--font-ui);
  font-size: var(--scale-ui);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin-bottom: 1.5rem;
}
.pub-contents__entry {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: var(--rule-weight) var(--rule-style) var(--color-border);
  font-family: var(--font-body);
}
.pub-contents__entry-title { font-size: var(--scale-body); }
.pub-contents__entry-author {
  font-family: var(--font-ui);
  font-size: var(--scale-ui);
  color: var(--color-muted);
}
.pub-contents__entry-page {
  font-family: var(--font-ui);
  font-size: var(--scale-ui);
  color: var(--color-muted);
  white-space: nowrap;
}

/* Image full — always constrained within page margins */
.pub-image-full { width: 100%; }
.pub-image-full img {
  width: 100%;
  display: block;
  border-radius: var(--img-radius);
  border: var(--img-border) solid var(--color-border);
}
.pub-image-full--16-9 img { aspect-ratio: 16/9; object-fit: cover; }
.pub-image-full--4-3 img { aspect-ratio: 4/3; object-fit: cover; }
.pub-image-full--3-2 img { aspect-ratio: 3/2; object-fit: cover; }
.pub-image-full--1-1 img { aspect-ratio: 1/1; object-fit: cover; }

/* Image inline */
.pub-image-inline {
  float: left;
  margin: 0 1.5rem 1rem 0;
  clear: left;
}
.pub-image-inline--right {
  float: right;
  margin: 0 0 1rem 1.5rem;
  clear: right;
}
.pub-image-inline img {
  display: block;
  border-radius: var(--img-radius);
  border: var(--img-border) solid var(--color-border);
}
.pub-inline-clearfix::after { content: ''; display: table; clear: both; }

/* Image duo */
.pub-image-duo { display: grid; grid-template-columns: 1fr 1fr; }
.pub-image-duo--tight { gap: 0.25rem; }
.pub-image-duo--normal { gap: 1rem; }
.pub-image-duo--wide { gap: 2rem; }
.pub-image-duo img { width: 100%; display: block; aspect-ratio: 3/2; object-fit: cover; border-radius: var(--img-radius); }

/* Colophon */
.pub-colophon {
  font-family: var(--font-ui);
  font-size: var(--scale-ui);
  color: var(--color-muted);
  line-height: 1.8;
  max-width: var(--col-narrow);
  padding-top: var(--gap-section);
  border-top: var(--rule-weight) var(--rule-style) var(--color-border);
}

/* Spacer */
.pub-spacer { display: block; }

/* Screen-only page separator — makes it obvious where one pub-page ends and the next begins */
@media screen {
  .pub-page + .pub-page {
    margin-top: var(--gap-section);
    border-top: 2px solid var(--color-border);
    padding-top: var(--margin-v);
  }
}

/* ── Print / PDF ── */
@media print {
  /*
   * @page margin: 0 suppresses the browser's built-in running headers/footers
   * (URL, date, page number). Gutters come from .pub-page padding instead.
   * box-decoration-break: clone re-applies that padding at the top of every
   * continuation physical page produced by paragraph break rules.
   */
  @page { margin: 0; size: A4 portrait; }
  @page landscape { size: A4 landscape; margin: 0; }
  @page portrait  { size: A4 portrait;  margin: 0; }
  html { font-size: 12px; }
  body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pub-page {
    page-break-after: always;
    break-after: page;
    padding: 1.5cm 2cm;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    max-width: 100%;
    margin: 0;
  }
  .pub-page:last-child { page-break-after: avoid; break-after: avoid; }
  .pub-no-print { display: none !important; }
  /* Break at paragraph boundaries, never mid-paragraph */
  p { break-inside: avoid; orphans: 3; widows: 3; margin-bottom: var(--gap-para); }
  p:last-child { margin-bottom: 0; }
  .article-body p { margin-bottom: max(var(--gap-para), 1.8em); }
  .article-body p:last-child { margin-bottom: 0; }
  /* Keep headings attached to the content that follows them */
  h1, h2, h3, h4 { break-after: avoid; }
  .pub-byline { break-inside: avoid; break-after: avoid; }
  .pub-standfirst { break-inside: avoid; break-after: avoid; }
  .article-title { break-after: avoid; }
  /* Let article body and blocks flow freely across print pages */
  .article-body { break-inside: auto; }
  .pub-block { break-inside: auto; }
}
`
}

function buildPullQuoteStyle(tokens: DesignTokens): string {
  const style = tokens.typography_details.pull_quote_style
  const base = `
.pub-pullquote {
  font-family: var(--font-pullquote);
  font-style: italic;
  color: var(--color-text);
  margin: var(--gap-block) 0;
}
.pub-pullquote__text { }
.pub-pullquote__attribution {
  font-family: var(--font-ui);
  font-size: var(--scale-ui);
  font-style: normal;
  color: var(--color-muted);
  margin-top: 0.75rem;
  letter-spacing: 0.05em;
}
`
  if (style === 'large-italic-centred') {
    return base + `.pub-pullquote { text-align: center; max-width: var(--col-max); margin: var(--gap-block) auto; }
.pub-pullquote__text { font-size: clamp(1.5rem, 3vw, 2.25rem); line-height: 1.3; }`
  }
  if (style === 'ruled-left') {
    return base + `.pub-pullquote { border-left: 3px solid var(--color-accent); padding-left: 1.5rem; max-width: var(--col-narrow); }
.pub-pullquote__text { font-size: clamp(1.25rem, 2.5vw, 1.75rem); line-height: 1.35; }`
  }
  if (style === 'full-width-display') {
    return base + `.pub-pullquote { border-top: var(--rule-weight) var(--rule-style) var(--color-border); border-bottom: var(--rule-weight) var(--rule-style) var(--color-border); padding: 2rem 0; text-align: center; }
.pub-pullquote__text { font-size: clamp(1.75rem, 3.5vw, 2.75rem); line-height: 1.2; }`
  }
  // marginal
  return base + `.pub-pullquote { max-width: 240px; margin-left: auto; font-size: 1rem; line-height: 1.5; border-top: 2px solid var(--color-accent); padding-top: 0.75rem; }`
}

// ── Block renderers ───────────────────────────────────────────────────────────

function imageTag(media: MediaItem | undefined, alt: string, style?: string): string {
  if (!media) return `<div style="background:var(--color-surface);aspect-ratio:3/2;display:flex;align-items:center;justify-content:center;"><span style="font-family:var(--font-ui);font-size:var(--scale-ui);color:var(--color-muted);">Image placeholder</span></div>`
  const fp = `object-position: ${(media.focal_point_x ?? 0.5) * 100}% ${(media.focal_point_y ?? 0.5) * 100}%`
  return `<img src="${escHtml(media.storage_url)}" alt="${escHtml(alt)}" loading="lazy" style="object-fit:cover;${fp};${style ?? ''}" />`
}

function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bodyToHtml(text: string): string {
  // Normalize CRLF/CR to LF — browser textareas submit \r\n which breaks \n\n splitting
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return normalized
    .split(/\n\n+/)
    .filter(Boolean)
    .map((p) => `<p>${escHtml(p.trim()).replace(/\n/g, ' ')}</p>`)
    .join('\n')
}

function renderBlock(
  block: Block,
  tokens: DesignTokens,
  media: MediaItem[],
  submissions: SubmissionForRender[]
): string {
  const mediaMap = new Map(media.map((m) => [m.id, m]))
  const subMap = new Map(submissions.map((s) => [s.id, s]))

  switch (block.type) {
    case 'cover': {
      const p = block.props
      const img = p.image_id ? mediaMap.get(p.image_id) : undefined
      const posClass =
        p.title_position === 'centre'
          ? 'pub-cover--centre'
          : p.title_position === 'top-left'
          ? 'pub-cover--top-left'
          : p.title_position === 'top-right'
          ? 'pub-cover--top-right'
          : p.title_position === 'bottom-right'
          ? 'pub-cover--bottom-right'
          : ''
      const bylineFormatted = p.issue_number
      return `<section class="pub-cover ${posClass}">
${img ? `<img class="pub-cover__image" src="${escHtml(img.storage_url)}" alt="${escHtml(p.title)}" style="object-position:${(img.focal_point_x ?? 0.5) * 100}% ${(img.focal_point_y ?? 0.5) * 100}%" />` : ''}
<div class="pub-cover__overlay" style="opacity:${(p.overlay_opacity ?? 40) / 100}"></div>
<div class="pub-cover__text">
${bylineFormatted ? `<p class="pub-cover__issue">${escHtml(bylineFormatted)}</p>` : ''}
<h1 class="pub-cover__title">${escHtml(p.title)}</h1>
${p.subtitle ? `<p class="pub-cover__subtitle">${escHtml(p.subtitle)}</p>` : ''}
</div>
</section>`
    }

    case 'article_body': {
      const p = block.props
      const sub = subMap.get(p.submission_id)
      // Width is always rendered as inline style so % values and presets work uniformly
      const widthCss =
        p.column_width === 'narrow'   ? 'max-width:var(--col-narrow);margin-left:auto;margin-right:auto;'
        : p.column_width === 'wide'   ? 'max-width:100%;'
        : p.column_width === 'standard' ? 'max-width:var(--col-max);margin-left:auto;margin-right:auto;'
        : `max-width:${escHtml(p.column_width)};margin-left:auto;margin-right:auto;`
      const dropCapClass = p.show_drop_cap && tokens.typography_details.drop_cap ? 'drop-cap' : ''
      const html = sub?.body ? bodyToHtml(sub.body) : '<p><em>Submission body not available.</em></p>'

      const showTitle = p.show_title ?? false
      const showByline = p.show_byline ?? false
      const inlineImageId = p.inline_image_id ?? null
      const inlinePos = p.inline_image_position ?? 'left'
      const inlineWidth = p.inline_image_width ?? '40%'

      const titleHtml = showTitle && sub?.title
        ? `<h2 class="article-title">${escHtml(sub.title)}</h2>`
        : ''
      const bylineHtml = showByline && sub
        ? `<div class="article-byline-inline">${escHtml(tokens.typography_details.byline_format.replace('{name}', sub.author_name))}</div>`
        : ''

      let inlineImageHtml = ''
      if (inlineImageId) {
        const inlineMedia = mediaMap.get(inlineImageId)
        const posClass = inlinePos === 'right' ? 'article-inline-image--right' : ''
        inlineImageHtml = `<figure class="article-inline-image ${posClass}" style="width:${inlineWidth}">${imageTag(inlineMedia, '')}</figure>`
      }

      const clearfix = inlineImageId ? `<div class="article-body-clear"></div>` : ''

      return `<article class="article-body ${dropCapClass}" style="${widthCss}">${titleHtml}${bylineHtml}${inlineImageHtml}${html}${clearfix}</article>`
    }

    case 'heading': {
      const p = block.props
      const level = ['h2','h3','h4'].includes(p.level) ? p.level : 'h2'
      const alignClass = p.align === 'centre' ? 'pub-heading--centre' : p.align === 'right' ? 'pub-heading--right' : ''
      return `<div class="pub-heading ${alignClass}"><${level}>${escHtml(p.text ?? '')}</${level}></div>`
    }

    case 'standfirst':
      return `<p class="pub-standfirst">${escHtml(block.props.text ?? '')}</p>`

    case 'pull_quote': {
      const p = block.props
      // align positions the box; width constrains it
      const boxMargin =
        p.align === 'centre' ? 'margin-left:auto;margin-right:auto;'
        : p.align === 'right' ? 'margin-left:auto;margin-right:0;'
        : p.align === 'left'  ? 'margin-left:0;margin-right:auto;'
        : ''
      const widthCss = p.width ? `max-width:${escHtml(p.width)};` : ''
      const inlineStyle = widthCss || boxMargin ? ` style="${widthCss}${boxMargin}"` : ''
      return `<blockquote class="pub-pullquote"${inlineStyle}>
<p class="pub-pullquote__text">${escHtml(p.text ?? '')}</p>
${p.attribution ? `<cite class="pub-pullquote__attribution">— ${escHtml(p.attribution)}</cite>` : ''}
</blockquote>`
    }

    case 'image_full': {
      const p = block.props
      const m = p.image_id ? mediaMap.get(p.image_id) : undefined
      const treatment = tokens.image_style.treatment === 'full-bleed' ? 'pub-image-full--full-bleed' : ''
      const aspectClass =
        p.aspect === '16:9' ? 'pub-image-full--16-9'
        : p.aspect === '4:3' ? 'pub-image-full--4-3'
        : p.aspect === '3:2' ? 'pub-image-full--3-2'
        : p.aspect === '1:1' ? 'pub-image-full--1-1'
        : ''
      return `<figure class="pub-image-full ${treatment} ${aspectClass}">
${imageTag(m, p.alt ?? '')}
${p.caption ? `<figcaption>${tokens.image_style.caption_position === 'overlay-bottom' ? '' : escHtml(p.caption)}</figcaption>` : ''}
</figure>`
    }

    case 'image_inline': {
      const p = block.props
      const m = p.image_id ? mediaMap.get(p.image_id) : undefined
      const posClass = p.position === 'right' ? 'pub-image-inline--right' : ''
      return `<figure class="pub-image-inline ${posClass}" style="width:${p.width ?? '40%'}">
${imageTag(m, p.alt ?? '', `width:100%`)}
${p.caption ? `<figcaption>${escHtml(p.caption)}</figcaption>` : ''}
</figure>`
    }

    case 'image_duo': {
      const p = block.props
      const gapClass = `pub-image-duo--${p.gap ?? 'normal'}`
      const ids: [string, string] = Array.isArray(p.image_ids) ? p.image_ids as [string, string] : ['', '']
      const caps: [string, string] = Array.isArray(p.captions) ? p.captions as [string, string] : ['', '']
      const m0 = mediaMap.get(ids[0])
      const m1 = mediaMap.get(ids[1])
      return `<div class="pub-image-duo ${gapClass}">
<figure>${imageTag(m0, caps[0])}${caps[0] ? `<figcaption>${escHtml(caps[0])}</figcaption>` : ''}</figure>
<figure>${imageTag(m1, caps[1])}${caps[1] ? `<figcaption>${escHtml(caps[1])}</figcaption>` : ''}</figure>
</div>`
    }

    case 'divider': {
      const p = block.props
      if (p.style === 'rule') {
        return `<hr class="pub-divider--rule" style="${p.weight ? `border-top-width:${p.weight}` : ''}"/>`
      }
      if (p.style === 'ornament') {
        return `<p class="pub-divider--ornament">· · ·</p>`
      }
      return `<div class="pub-divider--whitespace"></div>`
    }

    case 'byline': {
      const p = block.props
      // Fall back to the linked submission's author name if the prop is empty
      const sub = p.submission_id ? subMap.get(p.submission_id) : undefined
      const resolvedName = p.author_name || sub?.author_name || ''
      const fmt = tokens.typography_details.byline_format.replace('{name}', escHtml(resolvedName))
      const name = p.author_profile_url
        ? `<a href="${escHtml(p.author_profile_url)}">${fmt}</a>`
        : fmt
      let dateStr = ''
      if (p.date) {
        try { dateStr = new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) } catch { /* skip */ }
      }
      const alignClass = p.align === 'centre' ? ' pub-byline--centre' : p.align === 'right' ? ' pub-byline--right' : ''
      return `<div class="pub-byline${alignClass}">
<span class="pub-byline__name">${name}</span>
${dateStr ? `<span class="pub-byline__date">${escHtml(dateStr)}</span>` : ''}
</div>`
    }

    case 'contents': {
      const p = block.props
      const entries = Array.isArray(p.entries) ? p.entries : []
      return `<nav class="pub-contents">
<p class="pub-contents__title">Contents</p>
${entries.map((e) => `<div class="pub-contents__entry">
<div>
<div class="pub-contents__entry-title">${escHtml(e.title)}</div>
<div class="pub-contents__entry-author">${escHtml(e.author)}</div>
</div>
${p.show_page_numbers ? `<span class="pub-contents__entry-page">${e.page}</span>` : ''}
</div>`).join('')}
</nav>`
    }

    case 'colophon':
      return `<footer class="pub-colophon">${(block.props.text ?? '').split('\n').map((l) => `<p>${escHtml(l)}</p>`).join('')}</footer>`

    case 'spacer':
      return `<div class="pub-spacer" style="height:${escHtml(block.props.height ?? '2rem')}"></div>`

    default:
      return ''
  }
}

// ── Main render function ──────────────────────────────────────────────────────

export function renderPublication(
  pages: Page[],
  tokens: DesignTokens,
  media: MediaItem[],
  submissions: SubmissionForRender[],
  options: { shell?: boolean } = {}
): string {
  const fontImports = buildFontImports(tokens)
  const cssVars = buildCssVars(tokens)
  const baseStyles = buildBaseStyles(tokens)

  const firstPage = pages[0]
  const globalFontPx = firstPage?.font_size_px ?? 16

  const pagesHtml = pages
    .map((page) => {
      const blocksHtml = page.blocks
        .map((block) => `<div class="pub-block">${renderBlock(block, tokens, media, submissions)}</div>`)
        .join('\n')
      const orientation = page.orientation ?? 'portrait'
      const padParts = (page.padding_l || page.padding_r || page.padding_v)
        ? `padding: ${page.padding_v ?? 'var(--margin-v)'} ${page.padding_r ?? 'var(--margin-h)'} ${page.padding_v ?? 'var(--margin-v)'} ${page.padding_l ?? 'var(--margin-h)'}; max-width: none; margin-left: 0; margin-right: 0;`
        : ''
      const pageNameCss = `page: ${orientation};`
      const inlineStyle = ` style="${padParts}${pageNameCss}"`
      return `<section class="pub-page" data-page="${escHtml(page.id)}" data-label="${escHtml(page.label)}"${inlineStyle}>${blocksHtml}</section>`
    })
    .join('\n')

  const fontSizeOverride = globalFontPx !== 16 ? `html { font-size: ${globalFontPx}px; }` : ''
  const styles = `<style>${fontImports}\n${cssVars}\n${baseStyles}\n${fontSizeOverride}</style>`

  if (!options.shell) {
    // Fragment for iframe embedding — no <html> wrapper
    return `${styles}\n<div class="pub-root">${pagesHtml}</div>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${styles}
</head>
<body>
${pagesHtml}
</body>
</html>`
}

// ── Single-page fragment (for canvas iframe) ──────────────────────────────────

export function renderPage(
  page: Page,
  tokens: DesignTokens,
  media: MediaItem[],
  submissions: SubmissionForRender[]
): string {
  const fontImports = buildFontImports(tokens)
  const cssVars = buildCssVars(tokens)
  const baseStyles = buildBaseStyles(tokens)

  const orientation = page.orientation ?? 'portrait'
  const fontSizePx = page.font_size_px ?? 16
  // A4 at 96 DPI: portrait = 1122px tall, landscape = 794px tall
  const a4Height = orientation === 'landscape' ? 794 : 1122

  const overrideStyles = [
    fontSizePx !== 16 ? `html { font-size: ${fontSizePx}px; }` : '',
    `@media print { @page { size: A4 ${orientation}; } }`,
  ].filter(Boolean).join('\n')

  const blocksHtml = page.blocks
    .map((block) => `<div class="pub-block">${renderBlock(block, tokens, media, submissions)}</div>`)
    .join('\n')

  const padStyle = (page.padding_l || page.padding_r || page.padding_v)
    ? ` style="padding: ${page.padding_v ?? 'var(--margin-v)'} ${page.padding_r ?? 'var(--margin-h)'} ${page.padding_v ?? 'var(--margin-v)'} ${page.padding_l ?? 'var(--margin-h)'}; max-width: none; margin-left: 0; margin-right: 0;"`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${fontImports}\n${cssVars}\n${baseStyles}\n${overrideStyles}</style>
<script>document.fonts.ready.then(()=>document.documentElement.classList.add('fonts-loaded'))</script>
</head>
<body style="position:relative">
<div class="pub-no-print" aria-hidden="true" style="position:absolute;top:0;left:0;right:0;height:max(100%,8000px);pointer-events:none;z-index:999;background-image:repeating-linear-gradient(to bottom,transparent 0px,transparent ${a4Height - 1}px,rgba(192,57,43,0.35) ${a4Height - 1}px,rgba(192,57,43,0.35) ${a4Height}px);"></div>
<section class="pub-page"${padStyle}>${blocksHtml}</section>
</body>
</html>`
}
