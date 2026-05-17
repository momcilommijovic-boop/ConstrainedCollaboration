'use client'

import { useFormState } from 'react-dom'
import { joinCell } from '@/app/actions/cells'
import { SubmitButton } from '@/components/ui/Button'

export function JoinCellButton({ cellId }: { cellId: string }) {
  const [state, action] = useFormState(joinCell, { error: null })

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="cell_id" value={cellId} />
      <SubmitButton variant="primary">Join Cell →</SubmitButton>
      {state?.error && (
        <p className="font-mono text-xs text-accent-red">{state?.error}</p>
      )}
    </form>
  )
}
