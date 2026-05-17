'use client'

import { useFormState } from 'react-dom'
import { respondToInvitation } from '@/app/actions/briefs'
import { SubmitButton } from '@/components/ui/Button'

export function InvitationResponse({ invitationId }: { invitationId: string }) {
  const [state, action] = useFormState(respondToInvitation, { error: null })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <form action={action}>
          <input type="hidden" name="invitation_id" value={invitationId} />
          <input type="hidden" name="response" value="ACCEPTED" />
          <SubmitButton variant="primary">Accept →</SubmitButton>
        </form>
        <form action={action}>
          <input type="hidden" name="invitation_id" value={invitationId} />
          <input type="hidden" name="response" value="DECLINED" />
          <SubmitButton variant="ghost">Decline</SubmitButton>
        </form>
      </div>
      {state?.error && <p className="font-mono text-xs text-accent-red">{state?.error}</p>}
    </div>
  )
}
