'use client'

import { useFormState } from 'react-dom'
import { advanceToComplete } from '@/app/actions/promotions'
import { SubmitButton } from '@/components/ui/Button'

export function AdvanceToCompleteForm({ cellId }: { cellId: string }) {
  const [state, action] = useFormState(advanceToComplete, { error: null })

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="cell_id" value={cellId} />
      <SubmitButton variant="ghost">Close Promotion →</SubmitButton>
      {state?.error && <p className="font-mono text-xs text-accent-red">{state?.error}</p>}
    </form>
  )
}
