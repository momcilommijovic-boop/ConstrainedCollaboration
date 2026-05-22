'use client'

export function DemoBadge() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null
  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 9999,
        fontFamily: 'monospace',
        fontSize: '10px',
        letterSpacing: '0.15em',
        background: '#C0392B',
        color: 'white',
        padding: '2px 6px',
        pointerEvents: 'none',
      }}
    >
      DEMO
    </div>
  )
}
