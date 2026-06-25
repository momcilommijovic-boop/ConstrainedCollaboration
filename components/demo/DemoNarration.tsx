'use client'

import { useEffect, useState } from 'react'
import type { DemoState } from '@/lib/demo/types'

export function DemoNarration({ state }: { state: DemoState | null }) {
  const [visible, setVisible] = useState(false)
  const [displayed, setDisplayed] = useState<DemoState | null>(null)

  useEffect(() => {
    if (!state || state.status === 'IDLE' || state.status === 'COMPLETE') {
      setVisible(false)
      return
    }
    setDisplayed(state)
    setVisible(true)
  }, [state?.currentStepIndex, state?.status])

  if (!displayed) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        width: 460,
        zIndex: 9998,
        background: 'rgba(26,26,24,0.92)',
        color: '#F5F2EC',
        padding: '28px',
        border: '1px solid rgba(245,242,236,0.15)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        fontFamily: 'inherit',
      }}
    >
      <p
        style={{
          fontFamily: 'monospace',
          fontSize: '11px',
          letterSpacing: '0.15em',
          color: '#C0392B',
          marginBottom: '14px',
          textTransform: 'uppercase',
        }}
      >
        Step {displayed.currentStepIndex + 1} of {displayed.totalSteps}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-dm-serif, Georgia, serif)',
          fontSize: '18px',
          lineHeight: '1.6',
          marginBottom: '20px',
          color: '#F5F2EC',
        }}
      >
        {displayed.stepNarration}
      </p>
      <div style={{ height: 2, background: 'rgba(245,242,236,0.15)', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            background: '#C0392B',
            width: `${displayed.stepProgress * 100}%`,
            transition: 'width 0.1s linear',
          }}
        />
      </div>
    </div>
  )
}
