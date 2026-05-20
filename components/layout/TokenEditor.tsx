'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useState } from 'react'
import { saveDesignTokens } from '@/app/actions/design'
import type { DesignTokens } from '@/lib/layout/types'

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="font-mono text-xs bg-near-black text-off-white px-5 py-2 hover:opacity-80 transition-opacity disabled:opacity-40">
      {pending ? 'Saving…' : 'Save'}
    </button>
  )
}

interface Props {
  tokens: DesignTokens
  cellId: string
  cellSlug: string
  onChange?: (tokens: DesignTokens) => void
}

export function TokenEditor({ tokens: initial, cellId, cellSlug, onChange }: Props) {
  const [state, formAction] = useFormState(saveDesignTokens, { error: null })
  const [tokens, setTokens] = useState<DesignTokens>(initial)

  function update(path: string[], value: unknown) {
    setTokens((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as Record<string, unknown>
      let obj = next
      for (let i = 0; i < path.length - 1; i++) {
        obj = obj[path[i]] as Record<string, unknown>
      }
      obj[path[path.length - 1]] = value
      const updated = next as unknown as DesignTokens
      onChange?.(updated)
      return updated
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const hidden = form.querySelector<HTMLInputElement>('input[name="tokens"]')
    if (hidden) hidden.value = JSON.stringify(tokens)
  }

  const fieldCls = 'border border-near-black/20 bg-transparent px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-near-black w-full'
  const labelCls = 'font-mono text-xs text-olive block mb-1'
  const sectionTitle = 'font-mono text-xs uppercase tracking-widest text-olive mb-3 mt-6'

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-2">
      <input type="hidden" name="cell_id" value={cellId} />
      <input type="hidden" name="tokens" defaultValue={JSON.stringify(initial)} />

      {state.error && (
        <p className="font-mono text-xs text-accent-red border border-accent-red px-4 py-2">{state.error}</p>
      )}

      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-olive">Token Editor</p>
        <SaveButton />
      </div>

      {/* Colours */}
      <p className={sectionTitle}>Colours</p>
      <div className="grid grid-cols-2 gap-3">
        {(Object.entries(tokens.colours) as [string, string][]).map(([key, val]) => (
          <div key={key}>
            <label className={labelCls}>{key.replace(/_/g, ' ')}</label>
            <div className="flex gap-1">
              <input
                type="color"
                value={val.startsWith('#') ? val : '#1a1a18'}
                onChange={(e) => update(['colours', key], e.target.value)}
                className="w-10 h-8 border border-near-black/20 cursor-pointer p-0"
              />
              <input
                type="text"
                value={val}
                onChange={(e) => update(['colours', key], e.target.value)}
                className={fieldCls + ' flex-1'}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Fonts */}
      <p className={sectionTitle}>Fonts</p>
      {(Object.entries(tokens.fonts) as [string, typeof tokens.fonts.heading][]).map(([role, font]) => (
        <div key={role} className="border border-near-black/10 p-3 space-y-2">
          <p className="font-mono text-xs text-olive">{role}</p>
          <div>
            <label className={labelCls}>Family</label>
            <input type="text" value={font.family}
              onChange={(e) => update(['fonts', role, 'family'], e.target.value)}
              className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Google Fonts URL</label>
            <input type="url" value={font.google_font_url}
              onChange={(e) => update(['fonts', role, 'google_font_url'], e.target.value)}
              className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Fallback</label>
            <input type="text" value={font.fallback}
              onChange={(e) => update(['fonts', role, 'fallback'], e.target.value)}
              className={fieldCls} />
          </div>
        </div>
      ))}

      {/* Scale */}
      <p className={sectionTitle}>Scale</p>
      <div className="grid grid-cols-2 gap-3">
        {(Object.entries(tokens.scale) as [string, string][]).map(([key, val]) => (
          <div key={key}>
            <label className={labelCls}>{key.replace(/_/g, ' ')}</label>
            <input type="text" value={val}
              onChange={(e) => update(['scale', key], e.target.value)}
              className={fieldCls} />
          </div>
        ))}
      </div>

      {/* Spacing */}
      <p className={sectionTitle}>Spacing</p>
      <div className="grid grid-cols-2 gap-3">
        {(Object.entries(tokens.spacing) as [string, string][]).map(([key, val]) => (
          <div key={key}>
            <label className={labelCls}>{key.replace(/_/g, ' ')}</label>
            <input type="text" value={val}
              onChange={(e) => update(['spacing', key], e.target.value)}
              className={fieldCls} />
          </div>
        ))}
      </div>

      {/* Image style */}
      <p className={sectionTitle}>Image Style</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Treatment</label>
          <select value={tokens.image_style.treatment}
            onChange={(e) => update(['image_style', 'treatment'], e.target.value)}
            className="border border-near-black/20 bg-off-white px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-near-black w-full">
            {['full-bleed','framed','inset','borderless'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Caption position</label>
          <select value={tokens.image_style.caption_position}
            onChange={(e) => update(['image_style', 'caption_position'], e.target.value)}
            className="border border-near-black/20 bg-off-white px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-near-black w-full">
            {['below','overlay-bottom','beside'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Border radius</label>
          <input type="text" value={tokens.image_style.border_radius}
            onChange={(e) => update(['image_style', 'border_radius'], e.target.value)}
            className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Border width</label>
          <input type="text" value={tokens.image_style.border_width}
            onChange={(e) => update(['image_style', 'border_width'], e.target.value)}
            className={fieldCls} />
        </div>
      </div>

      {/* Typography details */}
      <p className={sectionTitle}>Typography Details</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Pull quote style</label>
          <select value={tokens.typography_details.pull_quote_style}
            onChange={(e) => update(['typography_details', 'pull_quote_style'], e.target.value)}
            className="border border-near-black/20 bg-off-white px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-near-black w-full">
            {['large-italic-centred','ruled-left','full-width-display','marginal'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Heading case</label>
          <select value={tokens.typography_details.heading_case}
            onChange={(e) => update(['typography_details', 'heading_case'], e.target.value)}
            className="border border-near-black/20 bg-off-white px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-near-black w-full">
            {['sentence','title','upper'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Rule style</label>
          <select value={tokens.typography_details.rule_style}
            onChange={(e) => update(['typography_details', 'rule_style'], e.target.value)}
            className="border border-near-black/20 bg-off-white px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-near-black w-full">
            {['solid','dashed','double','none'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Byline format</label>
          <input type="text" value={tokens.typography_details.byline_format}
            onChange={(e) => update(['typography_details', 'byline_format'], e.target.value)}
            className={fieldCls} />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="drop_cap"
            checked={tokens.typography_details.drop_cap}
            onChange={(e) => update(['typography_details', 'drop_cap'], e.target.checked)}
            className="border border-near-black/20" />
          <label htmlFor="drop_cap" className="font-mono text-xs text-olive">Drop cap</label>
        </div>
      </div>

      <div className="pt-4">
        <SaveButton />
      </div>
    </form>
  )
}
