'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useState } from 'react'
import { deleteCell } from '@/app/actions/admin'

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="font-mono text-xs bg-accent-red text-off-white px-6 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40"
    >
      {pending ? 'Deleting…' : 'Permanently delete Cell'}
    </button>
  )
}

export function DeleteCellForm({ cellId, slug }: { cellId: string; slug: string }) {
  const [state, formAction] = useFormState(deleteCell, { error: null })
  const [inputVal, setInputVal] = useState('')
  const confirmed = inputVal === slug

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="font-mono text-xs text-accent-red border border-accent-red px-4 py-2">
          {state.error}
        </p>
      )}

      <input type="hidden" name="cell_id" value={cellId} />
      <input type="hidden" name="expected_slug" value={slug} />

      <div>
        <label className="font-mono text-xs text-olive mb-2 block">
          Type <span className="font-mono text-xs text-near-black">{slug}</span> to confirm deletion
        </label>
        <input
          type="text"
          name="confirm_slug"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={slug}
          autoComplete="off"
          className="w-full border border-near-black/20 bg-transparent px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-accent-red"
        />
      </div>

      <SubmitButton disabled={!confirmed} />
    </form>
  )
}
