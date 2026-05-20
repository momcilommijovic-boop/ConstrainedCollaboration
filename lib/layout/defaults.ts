import type { DesignTokens } from './types'

export const DEFAULT_TOKENS: DesignTokens = {
  meta: {
    inspiration_label: 'Quorum Default',
    mood: 'Editorial, high contrast, unhurried',
    generated_at: new Date().toISOString(),
  },
  fonts: {
    heading: {
      family: 'Playfair Display',
      google_font_url:
        'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap',
      weights: ['400', '700', '400i'],
      fallback: 'Georgia, "Times New Roman", serif',
    },
    subheading: {
      family: 'Playfair Display',
      google_font_url:
        'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap',
      weights: ['400', '600', '400i'],
      fallback: 'Georgia, serif',
    },
    body: {
      family: 'Source Serif 4',
      google_font_url:
        'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap',
      weights: ['400', '600', '400i'],
      fallback: 'Georgia, serif',
    },
    ui: {
      family: 'IBM Plex Mono',
      google_font_url:
        'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap',
      weights: ['400', '500'],
      fallback: '"Courier New", monospace',
    },
    pullquote: {
      family: 'Playfair Display',
      google_font_url:
        'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400;1,700&display=swap',
      weights: ['400i', '700i'],
      fallback: 'Georgia, serif',
    },
    caption: {
      family: 'IBM Plex Mono',
      google_font_url:
        'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&display=swap',
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
    line_height_body: '1.7',
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
