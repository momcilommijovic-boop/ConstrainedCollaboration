'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { setPublicationYouTubeUrl, type VideoActionState } from '@/app/actions/videos'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="font-mono text-xs border border-near-black px-4 py-2
        hover:bg-near-black hover:text-off-white transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {pending ? 'Saving…' : 'Save URL'}
    </button>
  )
}

interface Props {
  publicationId: string
  currentUrl: string | null
}

export function SetYouTubeUrlForm({ publicationId, currentUrl }: Props) {
  const [state, action] = useFormState<VideoActionState, FormData>(
    setPublicationYouTubeUrl,
    { error: null }
  )

  return (
    <div className="border-t border-near-black/20 pt-5 mt-5">
      <p className="font-mono text-xs uppercase tracking-widest text-olive mb-3">
        YouTube Video
      </p>
      <form action={action} className="flex items-center gap-3">
        <input type="hidden" name="publication_id" value={publicationId} />
        <input
          name="youtube_url"
          type="url"
          defaultValue={currentUrl ?? ''}
          placeholder="https://www.youtube.com/watch?v=…"
          className="font-mono text-xs border border-near-black/30 px-3 py-2 bg-transparent
            placeholder:text-olive focus:outline-none focus:border-near-black flex-1"
        />
        <SubmitButton />
      </form>
      {state.error && (
        <p className="font-mono text-xs text-accent-red mt-2">{state.error}</p>
      )}
      {!state.error && currentUrl && (
        <p className="font-mono text-xs text-olive mt-2">
          Currently linked:{' '}
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-near-black"
          >
            {currentUrl}
          </a>
        </p>
      )}
    </div>
  )
}
