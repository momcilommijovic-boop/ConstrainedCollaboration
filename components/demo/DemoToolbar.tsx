'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DemoRunner } from '@/lib/demo/runner'
import { DEMO_STEPS } from '@/lib/demo/steps'
import { DemoNarration } from './DemoNarration'
import type { DemoState, DemoSpeed } from '@/lib/demo/types'
import type { CSSProperties } from 'react'

export function DemoToolbar() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null
  return <DemoToolbarInner />
}

function DemoToolbarInner() {
  const router = useRouter()
  const runnerRef = useRef<DemoRunner | null>(null)
  const [state, setState] = useState<DemoState | null>(null)
  const [showComplete, setShowComplete] = useState(false)

  useEffect(() => {
    const runner = new DemoRunner((route) => router.push(route), () => router.refresh())
    runner.setSteps(DEMO_STEPS)
    const unsub = runner.subscribe((s) => {
      setState(s)
      if (s.status === 'COMPLETE') {
        setShowComplete(true)
        setTimeout(() => setShowComplete(false), 5000)
      }
    })
    runnerRef.current = runner
    // Emit initial idle state
    ;(runner as unknown as { emit: () => void }).emit()
    return unsub
  }, [router])

  const runner = runnerRef.current
  if (!state || !runner) return null

  const isRunning = state.status === 'RUNNING'
  const isPaused = state.status === 'PAUSED'
  const isIdle = state.status === 'IDLE'
  const isError = state.status === 'ERROR'

  return (
    <>
      <DemoNarration state={state} />

      {showComplete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(26,26,24,0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#F5F2EC',
          }}
        >
          <p
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              letterSpacing: '0.2em',
              color: '#C0392B',
              marginBottom: 24,
              textTransform: 'uppercase',
            }}
          >
            Demo Complete
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-dm-serif, Georgia, serif)',
              fontSize: '3rem',
              marginBottom: 16,
            }}
          >
            Quorum
          </h1>
          <p
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              letterSpacing: '0.12em',
              color: 'rgba(245,242,236,0.6)',
              textTransform: 'uppercase',
            }}
          >
            Constraint. Collaboration. Output.
          </p>
        </div>
      )}

      <div
        className="demo-toolbar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          zIndex: 9997,
          background: 'rgba(26,26,24,0.9)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 20px',
          borderTop: '1px solid rgba(245,242,236,0.1)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Label */}
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            letterSpacing: '0.15em',
            color: '#C0392B',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          ▶ QUORUM DEMO
        </span>

        <span style={{ color: 'rgba(245,242,236,0.2)', fontSize: 12 }}>│</span>

        {/* Step label / error */}
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            color: isError ? '#C0392B' : '#F5F2EC',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
          }}
        >
          {isError
            ? `⚠ ${state.errorMessage}`
            : `Step ${state.currentStepIndex + 1}/${state.totalSteps}: ${state.stepLabel}`}
        </span>

        {/* Progress bar */}
        <div
          style={{
            width: 160,
            height: 4,
            background: 'rgba(245,242,236,0.15)',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              background: '#C0392B',
              width: `${(state.currentStepIndex / Math.max(1, state.totalSteps - 1)) * 100}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        <span style={{ color: 'rgba(245,242,236,0.2)', fontSize: 12 }}>│</span>

        {/* Controls */}
        {isRunning || isPaused ? (
          <button
            onClick={() => (isRunning ? runner.pause() : runner.play())}
            style={btnStyle}
          >
            {isRunning ? '⏸' : '▶'}
          </button>
        ) : (
          <button onClick={() => runner.play()} style={btnStyle}>
            {isIdle ? '▶ Start' : isError ? '↺ Retry' : '▶'}
          </button>
        )}

        <button
          onClick={() => runner.skipToStep(state.currentStepIndex + 1)}
          style={btnStyle}
          title="Skip to next step"
        >
          ▶▶
        </button>

        <button
          onClick={async () => {
            if (window.confirm('This will delete all demo data and reset to start — are you sure?')) {
              await runner.reset()
            }
          }}
          style={btnStyle}
          title="Reset demo"
        >
          ↺
        </button>

        <span style={{ color: 'rgba(245,242,236,0.2)', fontSize: 12 }}>│</span>

        {/* Speed */}
        <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(245,242,236,0.5)' }}>
          Speed:
        </span>
        {([1, 2, 3] as const).map((s) => (
          <button
            key={s}
            onClick={() => runner.setSpeed(s as DemoSpeed)}
            style={{
              ...btnStyle,
              background: state.speed === s ? '#C0392B' : 'transparent',
            }}
          >
            {s}×
          </button>
        ))}
      </div>
    </>
  )
}

const btnStyle: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '11px',
  color: '#F5F2EC',
  background: 'transparent',
  border: '1px solid rgba(245,242,236,0.2)',
  padding: '4px 10px',
  cursor: 'pointer',
  transition: 'background 0.15s',
}
