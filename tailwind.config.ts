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
        'off-white': '#F5F2EC',
        'near-black': '#1A1A18',
        'accent-red': '#C0392B',
        olive: '#7A7A5A',
      },
      fontFamily: {
        'serif-display': ['var(--font-dm-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-ibm-plex-mono)', 'ui-monospace', 'monospace'],
        body: ['var(--font-source-serif)', 'Georgia', 'serif'],
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
