'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { generateRetrospective } from '@/app/actions/retrospective'

function GenerateSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="font-mono text-xs border border-near-black px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {pending ? 'Generating episode…' : 'Generate Retrospective →'}
    </button>
  )
}

interface Props {
  cellId: string
  cellSlug: string
  cycle: number
  existingStatus: 'GENERATING' | 'READY' | 'FAILED' | null
}

export function GenerateRetrospectiveButton({ cellId, cellSlug, cycle, existingStatus }: Props) {
  const [state, action] = useFormState(generateRetrospective, { error: null })

  if (existingStatus === 'READY') {
    return (
      <Link
        href={`/cells/${cellSlug}/retrospective/${cycle}`}
        className="font-mono text-xs border border-near-black px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors"
      >
        Play Episode →
      </Link>
    )
  }

  if (existingStatus === 'GENERATING') {
    return (
      <span className="font-mono text-xs text-olive">
        Episode generating…
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-2 items-start">
      {existingStatus === 'FAILED' && (
        <p className="font-mono text-xs text-accent-red">
          Generation failed. Try again below.
        </p>
      )}
      {state?.error && (
        <p className="font-mono text-xs text-accent-red">{state.error}</p>
      )}
      <form action={action}>
        <input type="hidden" name="cell_id" value={cellId} />
        <input type="hidden" name="cycle" value={cycle} />
        <GenerateSubmitButton />
      </form>
      <p className="font-mono text-xs text-olive/60">
        Takes 30–90 seconds. You will be redirected when complete.
      </p>
    </div>
  )
}
