'use client'

import { useFormState } from 'react-dom'
import { advanceToEditing } from '@/app/actions/submissions'
import { SubmitButton } from '@/components/ui/Button'

export function AdvanceToEditingForm({
  cellId,
  submittedCount,
}: {
  cellId: string
  submittedCount: number
}) {
  const [state, action] = useFormState(advanceToEditing, { error: null })

  if (submittedCount === 0) {
    return (
      <p className="font-mono text-xs text-olive">
        Waiting for submissions. Close Submissions becomes available once at least one article is
        received.
      </p>
    )
  }

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="cell_id" value={cellId} />
      <SubmitButton variant="ghost">
        Close Submissions ({submittedCount} received) →
      </SubmitButton>
      {state?.error && <p className="font-mono text-xs text-accent-red">{state?.error}</p>}
    </form>
  )
}
