// ── Design Tokens ─────────────────────────────────────────────────────────────

export type GoogleFontToken = {
  family: string
  google_font_url: string
  weights: string[]
  fallback: string
}

export type DesignTokens = {
  meta: {
    inspiration_label: string
    mood: string
    generated_at: string
  }
  fonts: {
    heading: GoogleFontToken
    subheading: GoogleFontToken
    body: GoogleFontToken
    ui: GoogleFontToken
    pullquote: GoogleFontToken
    caption: GoogleFontToken
  }
  colours: {
    background: string
    surface: string
    text_primary: string
    text_secondary: string
    text_muted: string
    accent: string
    accent_light: string
    border: string
  }
  scale: {
    h1: string
    h2: string
    h3: string
    h4: string
    body: string
    caption: string
    ui: string
    line_height_heading: string
    line_height_body: string
    letter_spacing_heading: string
    letter_spacing_body: string
    column_max_width: string
    column_narrow_width: string
  }
  spacing: {
    section_gap: string
    block_gap: string
    paragraph_gap: string
    page_margin_horizontal: string
    page_margin_vertical: string
  }
  image_style: {
    treatment: 'full-bleed' | 'framed' | 'inset' | 'borderless'
    caption_position: 'below' | 'overlay-bottom' | 'beside'
    border_radius: string
    border_width: string
  }
  typography_details: {
    drop_cap: boolean
    pull_quote_style: 'large-italic-centred' | 'ruled-left' | 'full-width-display' | 'marginal'
    heading_case: 'sentence' | 'title' | 'upper'
    byline_format: string
    rule_style: 'solid' | 'dashed' | 'double' | 'none'
    rule_weight: string
  }
}

// ── Block Props ───────────────────────────────────────────────────────────────

export type CoverProps = {
  title: string
  subtitle: string
  issue_number: string
  image_id: string | null
  overlay_opacity: number
  title_position: 'centre' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
}

export type ArticleBodyProps = {
  submission_id: string
  show_drop_cap: boolean
  column_width: 'narrow' | 'standard' | 'wide'
  show_title?: boolean
  show_byline?: boolean
  inline_image_id?: string | null
  inline_image_position?: 'left' | 'right'
  inline_image_width?: '33%' | '40%' | '50%'
}

export type HeadingProps = {
  text: string
  level: 'h2' | 'h3' | 'h4'
  align: 'left' | 'centre' | 'right'
}

export type StandfirstProps = {
  text: string
}

export type PullQuoteProps = {
  text: string
  attribution: string | null
  style_override: string | null
}

export type ImageFullProps = {
  image_id: string
  caption: string
  alt: string
  aspect: '16:9' | '4:3' | '3:2' | '1:1' | 'original'
}

export type ImageInlineProps = {
  image_id: string
  caption: string
  alt: string
  position: 'left' | 'right'
  width: '33%' | '40%' | '50%'
}

export type ImageDuoProps = {
  image_ids: [string, string]
  captions: [string, string]
  gap: 'tight' | 'normal' | 'wide'
}

export type DividerProps = {
  style: 'rule' | 'ornament' | 'whitespace'
  weight: string | null
}

export type BylineProps = {
  submission_id: string | null
  author_name: string
  author_profile_url: string | null
  date: string
}

export type ContentsProps = {
  show_page_numbers: boolean
  entries: Array<{ title: string; author: string; page: number }>
}

export type ColophonProps = {
  text: string
}

export type SpacerProps = {
  height: string
}

// ── Block Union ───────────────────────────────────────────────────────────────

export type Block =
  | { type: 'cover';        id: string; props: CoverProps }
  | { type: 'article_body'; id: string; props: ArticleBodyProps }
  | { type: 'heading';      id: string; props: HeadingProps }
  | { type: 'standfirst';   id: string; props: StandfirstProps }
  | { type: 'pull_quote';   id: string; props: PullQuoteProps }
  | { type: 'image_full';   id: string; props: ImageFullProps }
  | { type: 'image_inline'; id: string; props: ImageInlineProps }
  | { type: 'image_duo';    id: string; props: ImageDuoProps }
  | { type: 'divider';      id: string; props: DividerProps }
  | { type: 'byline';       id: string; props: BylineProps }
  | { type: 'contents';     id: string; props: ContentsProps }
  | { type: 'colophon';     id: string; props: ColophonProps }
  | { type: 'spacer';       id: string; props: SpacerProps }

// ── Page ─────────────────────────────────────────────────────────────────────

export type Page = {
  id: string
  label: string
  blocks: Block[]
}

// ── Media ─────────────────────────────────────────────────────────────────────

export type MediaItem = {
  id: string
  cell_id: string
  cycle: number
  uploader_id: string | null
  filename: string | null
  storage_url: string
  width: number | null
  height: number | null
  alt_text: string | null
  focal_point_x: number
  focal_point_y: number
  uploaded_at: string
}

// ── Design token row ──────────────────────────────────────────────────────────

export type DesignTokenRow = {
  id: string
  cell_id: string
  inspiration_sources: Array<{ type: 'url' | 'screenshot'; value: string; label: string }>
  tokens: DesignTokens
  generated_at: string
  generated_by: string | null
  manually_edited: boolean
}

// ── Layout row ────────────────────────────────────────────────────────────────

export type LayoutRow = {
  id: string
  publication_id: string
  cell_id: string
  cycle: number
  pages: Page[]
  design_token_id: string | null
  status: 'DRAFT' | 'PUBLISHED'
  last_edited_at: string
  last_edited_by: string | null
}

// ── Submission (for renderer) ─────────────────────────────────────────────────

export type SubmissionForRender = {
  id: string
  title: string | null
  body: string | null
  author_name: string
}
