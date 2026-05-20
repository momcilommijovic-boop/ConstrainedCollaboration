'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useState } from 'react'
import { extractDesignTokens } from '@/app/actions/design'
import { TokenEditor } from './TokenEditor'
import type { DesignTokens } from '@/lib/layout/types'

function AnalyseButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="font-mono text-xs bg-near-black text-off-white px-6 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40"
    >
      {pending ? 'Analysing references…' : 'Analyse'}
    </button>
  )
}

interface Props {
  cellId: string
  cellSlug: string
  existingTokens: DesignTokens | null
}

export function DesignExtractionForm({ cellId, cellSlug, existingTokens }: Props) {
  const [state, formAction] = useFormState(extractDesignTokens, { error: null })
  const [editingTokens, setEditingTokens] = useState<DesignTokens | null>(existingTokens)

  const tokens = state.tokens ?? editingTokens

  return (
    <div className="space-y-8">
      {/* Extraction form */}
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="cell_id" value={cellId} />

        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-3">
            Reference URLs
          </p>
          <p className="font-mono text-xs text-olive/70 mb-3">
            Paste the homepage or a representative article of a magazine whose visual style you want to draw from.
          </p>
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              type="url"
              name={`url_${i}`}
              placeholder={`https://example.com${i > 0 ? ` (optional)` : ''}`}
              className="w-full border border-near-black/20 bg-transparent px-3 py-2 font-mono text-xs focus:outline-none focus:border-near-black mb-2"
            />
          ))}
        </div>

        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-3">
            Screenshots <span className="normal-case tracking-normal">(for paywalled / JS-heavy sites, max 4 MB each)</span>
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="mb-2">
              <input
                type="file"
                name={`screenshot_${i}`}
                accept="image/jpeg,image/png"
                className="font-mono text-xs text-olive file:mr-3 file:font-mono file:text-xs file:border file:border-near-black/20 file:bg-transparent file:px-3 file:py-1 file:cursor-pointer"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="font-mono text-xs uppercase tracking-widest text-olive mb-2 block">
            Mood notes <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <input
            type="text"
            name="mood_notes"
            placeholder="e.g. darker and more political than the references, less whitespace"
            maxLength={120}
            className="w-full border border-near-black/20 bg-transparent px-3 py-2 font-mono text-xs focus:outline-none focus:border-near-black"
          />
        </div>

        {state.error && (
          <p className="font-mono text-xs text-accent-red border border-accent-red px-4 py-2">
            {state.error}
          </p>
        )}

        <AnalyseButton />
      </form>

      {/* Token editor (shown after extraction or if existing tokens) */}
      {tokens && (
        <div className="border-t border-near-black/20 pt-8">
          <TokenEditor
            tokens={tokens}
            cellId={cellId}
            cellSlug={cellSlug}
            onChange={setEditingTokens}
          />
        </div>
      )}
    </div>
  )
}
