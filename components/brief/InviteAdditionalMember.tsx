'use client'

import { useFormState } from 'react-dom'
import { inviteMember } from '@/app/actions/briefs'
import { SubmitButton } from '@/components/ui/Button'

type Member = { user_id: string; username: string; display_name: string | null }

export function InviteAdditionalMember({
  briefId,
  availableMembers,
}: {
  briefId: string
  availableMembers: Member[]
}) {
  const [state, action] = useFormState(inviteMember, { error: null })

  if (availableMembers.length === 0) return null

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="brief_id" value={briefId} />
      <p className="font-mono text-xs uppercase tracking-widest text-olive">
        Invite Additional Member
      </p>
      <div className="flex items-center gap-3">
        <select
          name="invitee_id"
          required
          className="border border-near-black/30 bg-off-white px-3 py-2 font-mono text-sm focus:outline-none focus:border-near-black flex-1"
        >
          <option value="">Select member…</option>
          {availableMembers.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name ?? m.username} (@{m.username})
            </option>
          ))}
        </select>
        <SubmitButton variant="ghost">Invite →</SubmitButton>
      </div>
      {state?.error && <p className="font-mono text-xs text-accent-red">{state?.error}</p>}
    </form>
  )
}
