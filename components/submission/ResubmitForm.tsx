'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { resubmitArticle } from '@/app/actions/submissions'
import { SubmitButton } from '@/components/ui/Button'

interface ResubmitFormProps {
  submissionId: string
  initialBody: string
  initialTitle: string | null
  wordCountMin: number
  wordCountMax: number
}

export function ResubmitForm({
  submissionId,
  initialBody,
  initialTitle,
  wordCountMin,
  wordCountMax,
}: ResubmitFormProps) {
  const [state, action] = useFormState(resubmitArticle, { error: null })
  const [body, setBody] = useState(initialBody)

  const words = body.trim().split(/\s+/).filter(Boolean).length
  const isEmpty = body.trim().length === 0
  const tooShort = !isEmpty && words < wordCountMin
  const tooLong = words > wordCountMax
  const valid = !isEmpty && !tooShort && !tooLong

  const counterColor = tooLong ? 'text-accent-red' : valid ? 'text-near-black' : 'text-olive'

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="submission_id" value={submissionId} />

      <div className="flex flex-col gap-1">
        <label className="font-mono text-xs uppercase tracking-widest text-olive">
          Article Title <span className="normal-case">(optional)</span>
        </label>
        <input
          name="title"
          maxLength={200}
          defaultValue={initialTitle ?? ''}
          className="border border-near-black/30 bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:border-near-black w-full"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <label className="font-mono text-xs uppercase tracking-widest text-olive">
            Revised Article
          </label>
          <span className={`font-mono text-xs tabular-nums ${counterColor}`}>
            {words} word{words !== 1 ? 's' : ''}
          </span>
        </div>
        <textarea
          name="body"
          required
          rows={20}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="border border-near-black/30 bg-transparent px-3 py-2 font-body text-base focus:outline-none focus:border-near-black w-full resize-y leading-relaxed"
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
          Resubmit Article →
        </SubmitButton>
      </div>
    </form>
  )
}
