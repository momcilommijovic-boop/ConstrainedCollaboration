'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { publishPublication } from '@/app/actions/publications'
import { SubmitButton } from '@/components/ui/Button'

type AcceptedSubmission = {
  id: string
  title: string | null
  author: string
  word_count: number | null
}

interface PublicationAssemblyProps {
  cellId: string
  briefId: string
  acceptedSubmissions: AcceptedSubmission[]
}

export function PublicationAssembly({
  cellId,
  briefId,
  acceptedSubmissions,
}: PublicationAssemblyProps) {
  const [state, action] = useFormState(publishPublication, { error: null })
  const [orders, setOrders] = useState<Record<string, number>>(
    Object.fromEntries(acceptedSubmissions.map((s, i) => [s.id, i + 1]))
  )

  if (acceptedSubmissions.length === 0) {
    return (
      <p className="font-mono text-xs text-olive">
        No accepted articles yet. Accept submissions before publishing.
      </p>
    )
  }

  const sorted = [...acceptedSubmissions].sort(
    (a, b) => (orders[a.id] ?? 99) - (orders[b.id] ?? 99)
  )

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="cell_id" value={cellId} />
      <input type="hidden" name="brief_id" value={briefId} />

      <div className="flex flex-col gap-1">
        <label className="font-mono text-xs uppercase tracking-widest text-olive">
          Cover Image URL <span className="normal-case">(optional)</span>
        </label>
        <input
          name="cover_image_url"
          type="url"
          placeholder="https://…"
          className="border border-near-black/30 bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:border-near-black w-full"
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-olive">Article Order</p>
        <p className="font-mono text-xs text-olive">
          Assign a position number to each article. Lower numbers appear first.
        </p>
        <div className="border border-near-black/20 divide-y divide-near-black/10">
          {sorted.map((sub) => (
            <div key={sub.id} className="flex items-center gap-4 px-4 py-3">
              <input type="hidden" name="submission_ids" value={sub.id} />
              <input
                type="number"
                name="order"
                min={1}
                max={acceptedSubmissions.length}
                value={orders[sub.id] ?? 1}
                onChange={(e) =>
                  setOrders((prev) => ({
                    ...prev,
                    [sub.id]: parseInt(e.target.value, 10) || 1,
                  }))
                }
                className="border border-near-black/30 bg-transparent px-2 py-1 font-mono text-sm focus:outline-none focus:border-near-black w-14 text-center shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm truncate">{sub.title ?? '(untitled)'}</p>
                <p className="font-mono text-xs text-olive">
                  {sub.author}
                  {sub.word_count != null ? ` · ${sub.word_count} words` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {state?.error && <p className="font-mono text-xs text-accent-red">{state?.error}</p>}

      <div>
        <SubmitButton variant="primary">Publish Issue →</SubmitButton>
      </div>
    </form>
  )
}
