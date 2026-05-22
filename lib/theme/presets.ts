import type { ThemeTokens } from './types'

export type Preset = { id: string; label: string; tokens: ThemeTokens }

export const PRESETS: Preset[] = [
  {
    id: 'blocked-britain',
    label: 'Blocked Britain',
    tokens: {
      source_url: 'https://blockedbritain.com',
      source_name: 'Blocked Britain',
      fonts: {
        heading: {
          family: 'Roboto Condensed',
          weights: ['700', '900'],
          google_url: 'https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@700;900&display=swap',
        },
        body: {
          family: 'Roboto',
          weights: ['400', '400i', '500'],
          google_url: 'https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;1,400&display=swap',
        },
        ui: {
          family: 'Roboto Mono',
          weights: ['400', '500'],
          google_url: 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500&display=swap',
        },
      },
      colours: {
        background: '#FFFFFF',
        surface:    '#F4F4F4',
        text:       '#111111',
        muted:      '#666666',
        accent:     '#E63228',
        border:     '#DDDDDD',
      },
      scale: {
        h1: '52px', h2: '36px', h3: '26px', h4: '20px',
        body: '16px', line_height: '1.6', letter_spacing_heading: '-0.02em',
      },
    },
  },
  {
    id: 'economist',
    label: 'The Economist',
    tokens: {
      source_url: 'https://economist.com',
      source_name: 'The Economist',
      fonts: {
        heading: {
          family: 'Libre Baskerville',
          weights: ['400', '700'],
          google_url: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap',
        },
        body: {
          family: 'Libre Baskerville',
          weights: ['400', '400i'],
          google_url: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;1,400&display=swap',
        },
        ui: {
          family: 'IBM Plex Sans',
          weights: ['400', '500', '600'],
          google_url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap',
        },
      },
      colours: {
        background: '#FFFFFF',
        surface:    '#F9F7F4',
        text:       '#1A1A1A',
        muted:      '#6B6B6B',
        accent:     '#B51A27',
        border:     '#E0DEDA',
      },
      scale: {
        h1: '44px', h2: '30px', h3: '22px', h4: '18px',
        body: '16px', line_height: '1.65', letter_spacing_heading: '0em',
      },
    },
  },
  {
    id: 'arena',
    label: 'Are.na',
    tokens: {
      source_url: 'https://are.na',
      source_name: 'Are.na',
      fonts: {
        heading: {
          family: 'Inter',
          weights: ['400', '500'],
          google_url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap',
        },
        body: {
          family: 'Inter',
          weights: ['400'],
          google_url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap',
        },
        ui: {
          family: 'Inter',
          weights: ['400', '500'],
          google_url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap',
        },
      },
      colours: {
        background: '#F7F7F5',
        surface:    '#EEEEEC',
        text:       '#1A1A1A',
        muted:      '#999999',
        accent:     '#1A1A1A',
        border:     '#E5E5E3',
      },
      scale: {
        h1: '24px', h2: '18px', h3: '15px', h4: '13px',
        body: '14px', line_height: '1.5', letter_spacing_heading: '0em',
      },
    },
  },
  {
    id: 'stripe',
    label: 'Stripe',
    tokens: {
      source_url: 'https://stripe.com',
      source_name: 'Stripe',
      fonts: {
        heading: {
          family: 'Inter',
          weights: ['600', '700'],
          google_url: 'https://fonts.googleapis.com/css2?family=Inter:wght@600;700&display=swap',
        },
        body: {
          family: 'Inter',
          weights: ['400', '500'],
          google_url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap',
        },
        ui: {
          family: 'Inter',
          weights: ['400', '500'],
          google_url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap',
        },
      },
      colours: {
        background: '#FFFFFF',
        surface:    '#F6F9FC',
        text:       '#0A2540',
        muted:      '#425466',
        accent:     '#635BFF',
        border:     '#E6EBF1',
      },
      scale: {
        h1: '50px', h2: '34px', h3: '22px', h4: '18px',
        body: '16px', line_height: '1.6', letter_spacing_heading: '-0.02em',
      },
    },
  },
  {
    id: 'ia-writer',
    label: 'iA Writer',
    tokens: {
      source_url: 'https://ia.net/writer',
      source_name: 'iA Writer',
      fonts: {
        heading: {
          family: 'IBM Plex Mono',
          weights: ['400', '700'],
          google_url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap',
        },
        body: {
          family: 'IBM Plex Serif',
          weights: ['400', '400i'],
          google_url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:ital,wght@0,400;1,400&display=swap',
        },
        ui: {
          family: 'IBM Plex Mono',
          weights: ['400', '500'],
          google_url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap',
        },
      },
      colours: {
        background: '#FFFEF5',
        surface:    '#F5F4E8',
        text:       '#181818',
        muted:      '#777777',
        accent:     '#3399FF',
        border:     '#E0DED5',
      },
      scale: {
        h1: '32px', h2: '24px', h3: '20px', h4: '17px',
        body: '18px', line_height: '2.0', letter_spacing_heading: '0em',
      },
    },
  },
  {
    id: 'le-monde',
    label: 'Le Monde',
    tokens: {
      source_url: 'https://lemonde.fr',
      source_name: 'Le Monde',
      fonts: {
        heading: {
          family: 'Cormorant Garamond',
          weights: ['600', '700'],
          google_url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&display=swap',
        },
        body: {
          family: 'Cormorant Garamond',
          weights: ['400', '400i', '600'],
          google_url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap',
        },
        ui: {
          family: 'Source Sans 3',
          weights: ['400', '600'],
          google_url: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600&display=swap',
        },
      },
      colours: {
        background: '#FAFAF8',
        surface:    '#F2F1EE',
        text:       '#151515',
        muted:      '#767676',
        accent:     '#003399',
        border:     '#E2E0DB',
      },
      scale: {
        h1: '56px', h2: '38px', h3: '26px', h4: '20px',
        body: '18px', line_height: '1.7', letter_spacing_heading: '-0.01em',
      },
    },
  },
]

export const DEFAULT_QUORUM_TOKENS: ThemeTokens = {
  source_url: '',
  source_name: 'Quorum Default',
  fonts: {
    heading: {
      family: 'DM Serif Display',
      weights: ['400'],
      google_url: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap',
    },
    body: {
      family: 'Source Serif 4',
      weights: ['400', '600'],
      google_url: 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap',
    },
    ui: {
      family: 'IBM Plex Mono',
      weights: ['400', '500'],
      google_url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap',
    },
  },
  colours: {
    background: '#F5F2EC',
    surface:    '#EDEAE3',
    text:       '#1A1A18',
    muted:      '#7A7A5A',
    accent:     '#C0392B',
    border:     '#D4D0C8',
  },
  scale: {
    h1: '48px', h2: '32px', h3: '24px', h4: '20px',
    body: '17px', line_height: '1.75', letter_spacing_heading: '-0.01em',
  },
}
