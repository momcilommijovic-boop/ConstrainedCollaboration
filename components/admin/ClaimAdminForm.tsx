'use client'

import { useFormState } from 'react-dom'
import { claimAdmin } from '@/app/actions/admin'
import { SubmitButton } from '@/components/ui/Button'

export function ClaimAdminForm() {
  const [state, action] = useFormState(claimAdmin, { error: null })

  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error && (
        <p className="font-mono text-xs text-accent-red border border-accent-red px-3 py-2">
          {state.error}
        </p>
      )}
      <p className="font-mono text-xs text-near-black/70">
        Claiming admin will set your account as the platform administrator. This action cannot be
        reversed through the UI.
      </p>
      <SubmitButton className="self-start px-8">Claim Admin →</SubmitButton>
    </form>
  )
}
