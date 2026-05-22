import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // RGB triplet CSS vars enable opacity modifiers: bg-off-white/10, text-near-black/60, etc.
        'off-white':   'rgb(var(--color-bg-rgb)   / <alpha-value>)',
        'near-black':  'rgb(var(--color-text-rgb)  / <alpha-value>)',
        'accent-red':  'rgb(var(--color-accent-rgb)/ <alpha-value>)',
        'olive':       'rgb(var(--color-muted-rgb) / <alpha-value>)',
        'surface':     'rgb(var(--color-surface-rgb)/ <alpha-value>)',
        'border-col':  'rgb(var(--color-border-rgb)/ <alpha-value>)',
      },
      fontFamily: {
        'serif-display': ['var(--font-heading)', 'Georgia', 'serif'],
        mono:            ['var(--font-ui)',      'ui-monospace', 'monospace'],
        body:            ['var(--font-body)',    'Georgia', 'serif'],
      },
      borderRadius: {
        DEFAULT: '0',
        none: '0',
      },
    },
  },
  plugins: [],
}
export default config
