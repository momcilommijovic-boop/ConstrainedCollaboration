'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { submitArticle } from '@/app/actions/submissions'
import { SubmitButton } from '@/components/ui/Button'

interface SubmissionFormProps {
  briefId: string
  cellId: string
  wordCountMin: number
  wordCountMax: number
}

export function SubmissionForm({ briefId, cellId, wordCountMin, wordCountMax }: SubmissionFormProps) {
  const [state, action] = useFormState(submitArticle, { error: null })
  const [body, setBody] = useState('')

  const words = body.trim().split(/\s+/).filter(Boolean).length
  const isEmpty = body.trim().length === 0
  const tooShort = !isEmpty && words < wordCountMin
  const tooLong = words > wordCountMax
  const valid = !isEmpty && !tooShort && !tooLong

  const counterColor = tooLong
    ? 'text-accent-red'
    : valid
      ? 'text-near-black'
      : 'text-olive'

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="brief_id" value={briefId} />
      <input type="hidden" name="cell_id" value={cellId} />

      <div className="flex flex-col gap-1">
        <label className="font-mono text-xs uppercase tracking-widest text-olive">
          Article Title <span className="normal-case">(optional)</span>
        </label>
        <input
          name="title"
          maxLength={200}
          className="border border-near-black/30 bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:border-near-black w-full"
          placeholder="Leave blank to use the brief title"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <label className="font-mono text-xs uppercase tracking-widest text-olive">Article Body</label>
          <span className={`font-mono text-xs tabular-nums ${counterColor}`}>
            {isEmpty ? `${wordCountMin}–${wordCountMax} words required` : `${words} word${words !== 1 ? 's' : ''}`}
          </span>
        </div>
        <textarea
          name="body"
          required
          rows={20}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="border border-near-black/30 bg-transparent px-3 py-2 font-body text-base focus:outline-none focus:border-near-black w-full resize-y leading-relaxed"
          placeholder="Paste or type your article here…"
        />
        {tooShort && (
          <p className="font-mono text-xs text-olive">
            {wordCountMin - words} more word{wordCountMin - words !== 1 ? 's' : ''} needed.
          </p>
        )}
        {tooLong && (
          <p className="font-mono text-xs text-accent-red">
            {words - wordCountMax} word{words - wordCountMax !== 1 ? 's' : ''} over the limit.
          </p>
        )}
      </div>

      {state?.error && <p className="font-mono text-xs text-accent-red">{state?.error}</p>}

      <div>
        <SubmitButton variant="primary" disabled={!valid}>
          Submit Article →
        </SubmitButton>
      </div>
    </form>
  )
}
