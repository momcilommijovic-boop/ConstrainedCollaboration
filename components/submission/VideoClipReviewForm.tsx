'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { reviewVideoClip, type VideoActionState } from '@/app/actions/videos'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="font-mono text-xs border border-near-black px-3 py-1.5
        hover:bg-near-black hover:text-off-white transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {pending ? '…' : label}
    </button>
  )
}

interface Props {
  clipId: string
  currentStatus: string
}

export function VideoClipReviewForm({ clipId, currentStatus }: Props) {
  const [approveState, approveAction] = useFormState<VideoActionState, FormData>(
    reviewVideoClip,
    { error: null }
  )
  const [rejectState, rejectAction] = useFormState<VideoActionState, FormData>(
    reviewVideoClip,
    { error: null }
  )

  if (currentStatus === 'APPROVED') {
    return <span className="font-mono text-xs text-near-black">Approved</span>
  }
  if (currentStatus === 'REJECTED') {
    return <span className="font-mono text-xs text-olive">Rejected</span>
  }

  return (
    <div className="flex items-center gap-3">
      <form action={approveAction}>
        <input type="hidden" name="clip_id" value={clipId} />
        <input type="hidden" name="status" value="APPROVED" />
        <SubmitButton label="Approve" />
      </form>

      <form action={rejectAction} className="flex items-center gap-2">
        <input type="hidden" name="clip_id" value={clipId} />
        <input type="hidden" name="status" value="REJECTED" />
        <input
          name="editor_note"
          type="text"
          placeholder="Reason (optional)"
          maxLength={200}
          className="font-mono text-xs border border-near-black/30 px-2 py-1.5 bg-transparent
            placeholder:text-olive focus:outline-none focus:border-near-black w-40"
        />
        <SubmitButton label="Reject" />
      </form>

      {(approveState.error || rejectState.error) && (
        <p className="font-mono text-xs text-accent-red">
          {approveState.error ?? rejectState.error}
        </p>
      )}
    </div>
  )
}
