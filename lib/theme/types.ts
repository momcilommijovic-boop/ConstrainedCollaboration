export type ThemeFont = {
  family: string
  weights: string[]
  google_url: string
}

export type ThemeTokens = {
  source_url: string
  source_name: string
  fonts: {
    heading: ThemeFont
    body:    ThemeFont
    ui:      ThemeFont
  }
  colours: {
    background: string
    surface:    string
    text:       string
    muted:      string
    accent:     string
    border:     string
  }
  scale: {
    h1:                   string
    h2:                   string
    h3:                   string
    h4:                   string
    body:                 string
    line_height:          string
    letter_spacing_heading: string
  }
}
