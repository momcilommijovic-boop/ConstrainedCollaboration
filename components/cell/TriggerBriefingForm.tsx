'use client'

import { useFormState } from 'react-dom'
import { triggerBriefing } from '@/app/actions/cells'
import { SubmitButton } from '@/components/ui/Button'

export function TriggerBriefingForm({ cellId }: { cellId: string }) {
  const [state, action] = useFormState(triggerBriefing, { error: null })

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="cell_id" value={cellId} />
      <SubmitButton variant="primary">Start Briefing →</SubmitButton>
      {state?.error && (
        <p className="font-mono text-xs text-accent-red">{state?.error}</p>
      )}
    </form>
  )
}
