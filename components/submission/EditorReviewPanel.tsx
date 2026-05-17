'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { updateSubmissionStatus } from '@/app/actions/submissions'
import { SubmitButton } from '@/components/ui/Button'

interface EditorReviewPanelProps {
  submissionId: string
  currentStatus: string
}

type ActionMode = 'reject' | 'rework' | null

export function EditorReviewPanel({ submissionId, currentStatus }: EditorReviewPanelProps) {
  const [state, action] = useFormState(updateSubmissionStatus, { error: null })
  const [mode, setMode] = useState<ActionMode>(null)

  if (currentStatus !== 'SUBMITTED') return null

  return (
    <div className="border-t border-near-black/10 pt-4 mt-4">
      <p className="font-mono text-xs uppercase tracking-widest text-olive mb-3">Review</p>

      {mode === null && (
        <div className="flex gap-2 flex-wrap">
          {/* Accept */}
          <form action={action}>
            <input type="hidden" name="submission_id" value={submissionId} />
            <input type="hidden" name="status" value="ACCEPTED" />
            <SubmitButton variant="primary">Accept</SubmitButton>
          </form>

          <button
            type="button"
            onClick={() => setMode('rework')}
            className="font-mono text-xs border border-near-black/30 px-4 py-2 hover:border-near-black transition-colors"
          >
            Request Rework
          </button>

          <button
            type="button"
            onClick={() => setMode('reject')}
            className="font-mono text-xs border border-accent-red/40 text-accent-red px-4 py-2 hover:border-accent-red transition-colors"
          >
            Reject
          </button>
        </div>
      )}

      {(mode === 'reject' || mode === 'rework') && (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="submission_id" value={submissionId} />
          <input type="hidden" name="status" value={mode === 'reject' ? 'REJECTED' : 'REWORK_REQUESTED'} />

          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs uppercase tracking-widest text-olive">
              {mode === 'reject' ? 'Rejection Note' : 'Rework Guidance'}
              <span className="normal-case text-accent-red ml-1">*</span>
            </label>
            <textarea
              name="editor_note"
              required
              rows={4}
              autoFocus
              className="border border-near-black/30 bg-transparent px-3 py-2 font-mono text-xs focus:outline-none focus:border-near-black w-full resize-y"
              placeholder={
                mode === 'reject'
                  ? 'Explain why this submission is not accepted.'
                  : 'Explain what changes are needed and why.'
              }
            />
          </div>

          {state?.error && <p className="font-mono text-xs text-accent-red">{state?.error}</p>}

          <div className="flex gap-2">
            <SubmitButton variant={mode === 'reject' ? 'danger' : 'primary'}>
              {mode === 'reject' ? 'Confirm Rejection' : 'Send for Rework'}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="font-mono text-xs text-olive hover:text-near-black transition-colors px-3"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {state?.error && mode === null && (
        <p className="font-mono text-xs text-accent-red mt-2">{state?.error}</p>
      )}
    </div>
  )
}
