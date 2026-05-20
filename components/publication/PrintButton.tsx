'use client'

import type { CSSProperties } from 'react'

export function PrintButton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <button onClick={() => window.print()} className={className} style={style}>
      Save as PDF
    </button>
  )
}
