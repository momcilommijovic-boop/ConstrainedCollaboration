'use client'

import { useFormState } from 'react-dom'
import { publishBrief } from '@/app/actions/briefs'
import { SubmitButton } from '@/components/ui/Button'

type Member = { user_id: string; username: string; display_name: string | null }

interface BriefFormProps {
  cellId: string
  members: Member[]
  minInvites: number
  wordCountMin: number
  wordCountMax: number
}

export function BriefForm({
  cellId,
  members,
  minInvites,
  wordCountMin,
  wordCountMax,
}: BriefFormProps) {
  const [state, action] = useFormState(publishBrief, { error: null })

  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="cell_id" value={cellId} />

      <div className="flex flex-col gap-1">
        <label className="font-mono text-xs uppercase tracking-widest text-olive">Brief Title</label>
        <input
          name="title"
          required
          minLength={3}
          maxLength={120}
          className="border border-near-black/30 bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:border-near-black w-full"
          placeholder="e.g. Issue 4: The Limits of Knowing"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-mono text-xs uppercase tracking-widest text-olive">Theme</label>
        <input
          name="theme"
          required
          minLength={10}
          maxLength={300}
          className="border border-near-black/30 bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:border-near-black w-full"
          placeholder="One or two sentences describing this issue's theme"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-mono text-xs uppercase tracking-widest text-olive">
          Editorial Guidance
        </label>
        <textarea
          name="guidance"
          required
          minLength={20}
          maxLength={3000}
          rows={10}
          className="border border-near-black/30 bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:border-near-black w-full resize-y"
          placeholder="What are you looking for? What angles, tones, or forms fit this issue? What should writers avoid?"
        />
        <p className="font-mono text-xs text-olive">
          Submission word count: {wordCountMin}–{wordCountMax} words.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-mono text-xs uppercase tracking-widest text-olive">
          Article Slots
        </label>
        <input
          name="slots"
          type="number"
          required
          min={minInvites}
          max={20}
          defaultValue={minInvites}
          className="border border-near-black/30 bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:border-near-black w-32"
        />
        <p className="font-mono text-xs text-olive">
          Minimum {minInvites} (from strategy config). Invite extra to allow for dropouts.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-xs uppercase tracking-widest text-olive">
          Invite Writers — select at least {minInvites}
        </label>
        {members.length === 0 ? (
          <p className="font-mono text-xs text-olive border border-near-black/20 px-4 py-3">
            No other members available to invite.
          </p>
        ) : (
          <div className="border border-near-black/20 divide-y divide-near-black/10">
            {members.map((m) => (
              <label
                key={m.user_id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-near-black/5"
              >
                <input
                  type="checkbox"
                  name="invitee_ids"
                  value={m.user_id}
                  className="accent-near-black"
                />
                <span className="font-mono text-sm">
                  {m.display_name ?? m.username}
                  <span className="text-olive ml-2">@{m.username}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {state?.error && <p className="font-mono text-xs text-accent-red">{state?.error}</p>}

      <div>
        <SubmitButton variant="primary">Publish Brief →</SubmitButton>
      </div>
    </form>
  )
}
