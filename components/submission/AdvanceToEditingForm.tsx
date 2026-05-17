'use client'

import { useFormState } from 'react-dom'
import { advanceToEditing } from '@/app/actions/submissions'
import { SubmitButton } from '@/components/ui/Button'

export function AdvanceToEditingForm({ cellId }: { cellId: string }) {
  const [state, action] = useFormState(advanceToEditing, { error: null })

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="cell_id" value={cellId} />
      <SubmitButton variant="ghost">Close Submissions →</SubmitButton>
      {state?.error && <p className="font-mono text-xs text-accent-red">{state?.error}</p>}
    </form>
  )
}
