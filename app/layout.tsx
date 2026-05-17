import type { Metadata } from 'next'
import { DM_Serif_Display, IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google'
import { DevToolbar } from '@/components/dev/DevToolbar'
import './globals.css'

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-serif',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
})

const sourceSerif4 = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-source-serif',
})

export const metadata: Metadata = {
  title: 'Quorum',
  description: 'Structured co-operation projects bound by constraint.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${ibmPlexMono.variable} ${sourceSerif4.variable}`}
    >
      <body className="bg-off-white text-near-black font-body antialiased min-h-screen flex flex-col">
        <DevToolbar />
        {children}
      </body>
    </html>
  )
}
