'use client'

import { useState, useEffect } from 'react'

interface Remaining {
  label: string
  urgent: boolean   // < 24h
  critical: boolean // < 6h
}

function compute(deadline: string): Remaining {
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms <= 0) return { label: 'Deadline passed', urgent: true, critical: true }

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const totalHours = ms / 3600000

  const critical = totalHours < 6
  const urgent = totalHours < 24

  if (days > 0) return { label: `${days}d ${hours}h`, urgent, critical }
  if (hours > 0) return { label: `${hours}h ${minutes}m`, urgent, critical }
  return { label: `${minutes}m ${seconds}s`, urgent: true, critical: true }
}

interface DeadlineCounterProps {
  deadline: string
  prefix?: string
  className?: string
}

export function DeadlineCounter({ deadline, prefix, className = '' }: DeadlineCounterProps) {
  const [state, setState] = useState<Remaining>(() => compute(deadline))

  useEffect(() => {
    setState(compute(deadline))
    const interval = setInterval(() => setState(compute(deadline)), 1000)
    return () => clearInterval(interval)
  }, [deadline])

  return (
    <span
      className={`font-mono text-xs tabular-nums ${
        state.critical
          ? 'text-accent-red animate-pulse'
          : state.urgent
            ? 'text-accent-red'
            : 'text-olive'
      } ${className}`}
    >
      {prefix && <span className="mr-1">{prefix}</span>}
      {state.label}
    </span>
  )
}
