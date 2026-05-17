'use client'

import { useFormState } from 'react-dom'
import { submitPromotionEvidence } from '@/app/actions/promotions'
import { SubmitButton } from '@/components/ui/Button'

export function PromotionEvidenceForm({ publicationId }: { publicationId: string }) {
  const [state, action] = useFormState(submitPromotionEvidence, { error: null })

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="publication_id" value={publicationId} />

      <div className="flex flex-col gap-1">
        <label className="font-mono text-xs uppercase tracking-widest text-olive">
          Link to your social post
        </label>
        <input
          name="evidence_url"
          type="url"
          required
          placeholder="https://twitter.com/…"
          className="border border-near-black/30 bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:border-near-black w-full"
        />
        <p className="font-mono text-xs text-olive">
          Share the publication on any social platform and paste the link here.
        </p>
      </div>

      {state?.error && <p className="font-mono text-xs text-accent-red">{state?.error}</p>}

      <div>
        <SubmitButton variant="primary">Submit Evidence →</SubmitButton>
      </div>
    </form>
  )
}
