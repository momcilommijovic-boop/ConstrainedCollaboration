'use client'

import { useFormState } from 'react-dom'
import { seedTestUsers } from '@/app/actions/admin'
import { SubmitButton } from '@/components/ui/Button'

export function SeedUsersForm() {
  const [state, action] = useFormState(seedTestUsers, { error: null, created: 0, done: false })

  return (
    <form action={action} className="flex items-center gap-4 flex-wrap">
      {state?.error && (
        <p className="font-mono text-xs text-accent-red">{state.error}</p>
      )}
      {state?.done && !state.error && (
        <p className="font-mono text-xs text-olive">
          {state.created > 0 ? `Created ${state.created} new user(s).` : 'All test users already exist.'}
        </p>
      )}
      <SubmitButton className="px-6">Seed / Refresh Test Users →</SubmitButton>
    </form>
  )
}
