'use client'

import { useState, useTransition } from 'react'
import { suggestPullQuote } from '@/app/actions/layout'
import type {
  Block, DesignTokens, MediaItem, SubmissionForRender,
  CoverProps, ArticleBodyProps, HeadingProps, StandfirstProps, PullQuoteProps,
  ImageFullProps, ImageInlineProps, ImageDuoProps, DividerProps,
  BylineProps, ContentsProps, ColophonProps, SpacerProps,
} from '@/lib/layout/types'

const inputCls = 'border border-near-black/20 bg-transparent px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-near-black w-full'
const labelCls = 'font-mono text-xs text-olive block mb-1'
const selectCls = 'border border-near-black/20 bg-off-white px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-near-black w-full'
const fieldCls = 'mb-3'

interface Props {
  block: Block
  tokens: DesignTokens
  submissions: SubmissionForRender[]
  media: MediaItem[]
  onUpdate: (block: Block) => void
  onUploadMedia: (file: File) => void
}

function MediaPicker({
  value,
  media,
  onSelect,
  onUpload,
}: {
  value: string
  media: MediaItem[]
  onSelect: (id: string) => void
  onUpload: (file: File) => void
}) {
  const selected = media.find((m) => m.id === value)
  return (
    <div className="space-y-2">
      {selected && (
        <div className="border border-near-black/20 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.storage_url} alt={selected.alt_text ?? ''} className="w-full h-24 object-cover" />
          <p className="font-mono text-xs text-olive mt-1 truncate">{selected.filename}</p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">
        {media.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={`border-2 ${value === m.id ? 'border-near-black' : 'border-transparent'} hover:border-near-black/50 transition-colors`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.storage_url} alt={m.alt_text ?? ''} className="w-full h-14 object-cover" />
          </button>
        ))}
      </div>
      <label className="font-mono text-xs border border-near-black/20 px-2 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-near-black hover:text-off-white transition-colors">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
        />
        + Upload image
      </label>
    </div>
  )
}

function FocalPointPicker({
  imageId,
  media,
  x,
  y,
}: {
  imageId: string
  media: MediaItem[]
  x: number
  y: number
}) {
  const m = media.find((m) => m.id === imageId)
  if (!m) return null
  return (
    <div className="mt-2">
      <p className={labelCls}>Focal point: ({Math.round(x * 100)}%, {Math.round(y * 100)}%)</p>
      <p className="font-mono text-[10px] text-olive/60 mb-1">Drag crosshair on the image to set crop focus.</p>
      <div
        className="relative cursor-crosshair border border-near-black/20"
        style={{ height: '80px', overflow: 'hidden' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const nx = (e.clientX - rect.left) / rect.width
          const ny = (e.clientY - rect.top) / rect.height
          // bubble up via custom event — parent handles in onChange
          e.currentTarget.dispatchEvent(new CustomEvent('focal-change', { detail: { x: nx, y: ny }, bubbles: true }))
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.storage_url} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${x * 100}% ${y * 100}%` }} />
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-off-white shadow"
          style={{ left: `calc(${x * 100}% - 8px)`, top: `calc(${y * 100}% - 8px)`, background: 'var(--color-accent, #C0392B)' }}
        />
      </div>
    </div>
  )
}

export function BlockInspector({ block, tokens, submissions, media, onUpdate, onUploadMedia }: Props) {
  const [isPending, startTransition] = useTransition()

  function update(props: Partial<typeof block.props>) {
    onUpdate({ ...block, props: { ...block.props, ...props } } as Block)
  }

  switch (block.type) {
    // ── Cover ───────────────────────────────────────────────────────────────────
    case 'cover': {
      const p = block.props as CoverProps
      return (
        <div className="p-4 space-y-0">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Cover</p>
          <div className={fieldCls}>
            <label className={labelCls}>Title</label>
            <input type="text" value={p.title} onChange={(e) => update({ title: e.target.value })} className={inputCls} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Subtitle</label>
            <input type="text" value={p.subtitle} onChange={(e) => update({ subtitle: e.target.value })} className={inputCls} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Issue number / label</label>
            <input type="text" value={p.issue_number} onChange={(e) => update({ issue_number: e.target.value })} className={inputCls} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Cover image</label>
            <MediaPicker value={p.image_id ?? ''} media={media} onSelect={(id) => update({ image_id: id })} onUpload={onUploadMedia} />
          </div>
          {p.image_id && (
            <div className={fieldCls}>
              <label className={labelCls}>Overlay opacity: {p.overlay_opacity}%</label>
              <input type="range" min={0} max={80} value={p.overlay_opacity}
                onChange={(e) => update({ overlay_opacity: parseInt(e.target.value, 10) })}
                className="w-full" />
            </div>
          )}
          <div className={fieldCls}>
            <label className={labelCls}>Title position</label>
            <div className="grid grid-cols-2 gap-1 w-24">
              {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => (
                <button key={pos} type="button" onClick={() => update({ title_position: pos })}
                  className={`border text-[9px] font-mono py-1 px-1 ${p.title_position === pos ? 'bg-near-black text-off-white border-near-black' : 'border-near-black/20 text-olive hover:border-near-black'} transition-colors`}
                  title={pos}>
                  {pos === 'top-left' ? '↖' : pos === 'top-right' ? '↗' : pos === 'bottom-left' ? '↙' : '↘'}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => update({ title_position: 'centre' })}
              className={`mt-1 w-24 border text-[9px] font-mono py-1 ${p.title_position === 'centre' ? 'bg-near-black text-off-white border-near-black' : 'border-near-black/20 text-olive'} transition-colors`}>
              Centre
            </button>
          </div>
        </div>
      )
    }

    // ── Article body ─────────────────────────────────────────────────────────────
    case 'article_body': {
      const p = block.props as ArticleBodyProps
      return (
        <div className="p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Article Body</p>
          <div className={fieldCls}>
            <label className={labelCls}>Submission</label>
            <select value={p.submission_id} onChange={(e) => update({ submission_id: e.target.value })} className={selectCls}>
              <option value="">— select —</option>
              {submissions.map((s) => (
                <option key={s.id} value={s.id}>{s.title ?? 'Untitled'} / {s.author_name}</option>
              ))}
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Column width</label>
            <select value={p.column_width} onChange={(e) => update({ column_width: e.target.value as 'narrow' | 'standard' | 'wide' })} className={selectCls}>
              <option value="narrow">Narrow</option>
              <option value="standard">Standard</option>
              <option value="wide">Wide</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input type="checkbox" id="drop_cap" checked={p.show_drop_cap} onChange={(e) => update({ show_drop_cap: e.target.checked })} />
            <label htmlFor="drop_cap" className={labelCls + ' mb-0'}>Drop cap</label>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input type="checkbox" id="show_title" checked={p.show_title ?? false} onChange={(e) => update({ show_title: e.target.checked })} />
            <label htmlFor="show_title" className={labelCls + ' mb-0'}>Show title</label>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input type="checkbox" id="show_byline" checked={p.show_byline ?? false} onChange={(e) => update({ show_byline: e.target.checked })} />
            <label htmlFor="show_byline" className={labelCls + ' mb-0'}>Show byline</label>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Inline image (floats beside text)</label>
            <MediaPicker
              value={p.inline_image_id ?? ''}
              media={media}
              onSelect={(id) => update({ inline_image_id: id || null })}
              onUpload={onUploadMedia}
            />
            {p.inline_image_id && (
              <>
                <button type="button" onClick={() => update({ inline_image_id: null })}
                  className="font-mono text-xs text-accent-red mt-1">Remove inline image</button>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1">
                    <label className={labelCls}>Position</label>
                    <select value={p.inline_image_position ?? 'left'} onChange={(e) => update({ inline_image_position: e.target.value as 'left'|'right' })} className={selectCls}>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className={labelCls}>Width</label>
                    <select value={p.inline_image_width ?? '40%'} onChange={(e) => update({ inline_image_width: e.target.value as '33%'|'40%'|'50%' })} className={selectCls}>
                      <option value="33%">33%</option>
                      <option value="40%">40%</option>
                      <option value="50%">50%</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )
    }

    // ── Heading ─────────────────────────────────────────────────────────────────
    case 'heading': {
      const p = block.props as HeadingProps
      return (
        <div className="p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Heading</p>
          <div className={fieldCls}>
            <label className={labelCls}>Text</label>
            <input type="text" value={p.text} onChange={(e) => update({ text: e.target.value })} className={inputCls} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Level</label>
            <select value={p.level} onChange={(e) => update({ level: e.target.value as 'h2'|'h3'|'h4' })} className={selectCls}>
              <option value="h2">H2</option><option value="h3">H3</option><option value="h4">H4</option>
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Align</label>
            <select value={p.align} onChange={(e) => update({ align: e.target.value as 'left'|'centre'|'right' })} className={selectCls}>
              <option value="left">Left</option><option value="centre">Centre</option><option value="right">Right</option>
            </select>
          </div>
        </div>
      )
    }

    // ── Standfirst ───────────────────────────────────────────────────────────────
    case 'standfirst': {
      const p = block.props as StandfirstProps
      return (
        <div className="p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Standfirst</p>
          <div className={fieldCls}>
            <label className={labelCls}>Text</label>
            <textarea rows={4} value={p.text} onChange={(e) => update({ text: e.target.value })} className={inputCls + ' resize-none'} />
          </div>
        </div>
      )
    }

    // ── Pull quote ───────────────────────────────────────────────────────────────
    case 'pull_quote': {
      const p = block.props as PullQuoteProps
      return (
        <div className="p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Pull Quote</p>
          <div className={fieldCls}>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls + ' mb-0'}>Quote text</label>
              <button type="button" disabled={isPending}
                onClick={() => {
                  const subId = submissions[0]?.id
                  if (!subId) return
                  startTransition(async () => {
                    const result = await suggestPullQuote(subId)
                    if (result.text) update({ text: result.text })
                  })
                }}
                className="font-mono text-[10px] text-olive hover:text-near-black transition-colors disabled:opacity-40">
                {isPending ? 'Thinking…' : 'Suggest →'}
              </button>
            </div>
            <textarea rows={4} value={p.text} onChange={(e) => update({ text: e.target.value })} className={inputCls + ' resize-none'} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Attribution</label>
            <input type="text" value={p.attribution ?? ''} onChange={(e) => update({ attribution: e.target.value || null })} className={inputCls} placeholder="Optional" />
          </div>
        </div>
      )
    }

    // ── Image full ───────────────────────────────────────────────────────────────
    case 'image_full': {
      const p = block.props as ImageFullProps
      const m = media.find((m) => m.id === p.image_id)
      return (
        <div className="p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Image — Full</p>
          <div className={fieldCls}>
            <label className={labelCls}>Image</label>
            <MediaPicker value={p.image_id} media={media} onSelect={(id) => update({ image_id: id })} onUpload={onUploadMedia} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Aspect ratio</label>
            <select value={p.aspect} onChange={(e) => update({ aspect: e.target.value as ImageFullProps['aspect'] })} className={selectCls}>
              {['16:9','4:3','3:2','1:1','original'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Caption</label>
            <input type="text" value={p.caption} onChange={(e) => update({ caption: e.target.value })} className={inputCls} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Alt text</label>
            <input type="text" value={p.alt} onChange={(e) => update({ alt: e.target.value })} className={inputCls} />
          </div>
          {m && <FocalPointPicker imageId={p.image_id} media={media} x={m.focal_point_x} y={m.focal_point_y} />}
        </div>
      )
    }

    // ── Image inline ─────────────────────────────────────────────────────────────
    case 'image_inline': {
      const p = block.props as ImageInlineProps
      return (
        <div className="p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Image — Inline</p>
          <div className={fieldCls}>
            <label className={labelCls}>Image</label>
            <MediaPicker value={p.image_id} media={media} onSelect={(id) => update({ image_id: id })} onUpload={onUploadMedia} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Position</label>
            <select value={p.position} onChange={(e) => update({ position: e.target.value as 'left'|'right' })} className={selectCls}>
              <option value="left">Left</option><option value="right">Right</option>
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Width</label>
            <select value={p.width} onChange={(e) => update({ width: e.target.value as '33%'|'40%'|'50%' })} className={selectCls}>
              <option value="33%">33%</option><option value="40%">40%</option><option value="50%">50%</option>
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Caption</label>
            <input type="text" value={p.caption} onChange={(e) => update({ caption: e.target.value })} className={inputCls} />
          </div>
        </div>
      )
    }

    // ── Image duo ────────────────────────────────────────────────────────────────
    case 'image_duo': {
      const p = block.props as ImageDuoProps
      const ids: [string, string] = Array.isArray(p.image_ids) ? p.image_ids as [string, string] : ['', '']
      const caps: [string, string] = Array.isArray(p.captions) ? p.captions as [string, string] : ['', '']
      return (
        <div className="p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Image — Duo</p>
          {[0, 1].map((i) => (
            <div key={i} className={fieldCls}>
              <label className={labelCls}>Image {i + 1}</label>
              <MediaPicker value={ids[i]} media={media}
                onSelect={(id) => {
                  const next: [string, string] = [ids[0], ids[1]]
                  next[i] = id
                  update({ image_ids: next })
                }}
                onUpload={onUploadMedia} />
              <input type="text" value={caps[i]} placeholder={`Caption ${i + 1}`}
                onChange={(e) => {
                  const next: [string, string] = [caps[0], caps[1]]
                  next[i] = e.target.value
                  update({ captions: next })
                }}
                className={inputCls + ' mt-1'} />
            </div>
          ))}
          <div className={fieldCls}>
            <label className={labelCls}>Gap</label>
            <select value={p.gap} onChange={(e) => update({ gap: e.target.value as 'tight'|'normal'|'wide' })} className={selectCls}>
              <option value="tight">Tight</option><option value="normal">Normal</option><option value="wide">Wide</option>
            </select>
          </div>
        </div>
      )
    }

    // ── Divider ──────────────────────────────────────────────────────────────────
    case 'divider': {
      const p = block.props as DividerProps
      return (
        <div className="p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Divider</p>
          <div className={fieldCls}>
            <label className={labelCls}>Style</label>
            <select value={p.style} onChange={(e) => update({ style: e.target.value as 'rule'|'ornament'|'whitespace' })} className={selectCls}>
              <option value="rule">Rule</option><option value="ornament">Ornament (· · ·)</option><option value="whitespace">Whitespace</option>
            </select>
          </div>
          {p.style === 'rule' && (
            <div className={fieldCls}>
              <label className={labelCls}>Weight</label>
              <input type="text" value={p.weight ?? ''} placeholder="e.g. 2px" onChange={(e) => update({ weight: e.target.value || null })} className={inputCls} />
            </div>
          )}
        </div>
      )
    }

    // ── Byline ───────────────────────────────────────────────────────────────────
    case 'byline': {
      const p = block.props as BylineProps
      return (
        <div className="p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Byline</p>
          <div className={fieldCls}>
            <label className={labelCls}>Link to submission</label>
            <select value={p.submission_id ?? ''} onChange={(e) => {
              const sub = submissions.find((s) => s.id === e.target.value)
              update({ submission_id: e.target.value || null, author_name: sub?.author_name ?? p.author_name })
            }} className={selectCls}>
              <option value="">— manual —</option>
              {submissions.map((s) => <option key={s.id} value={s.id}>{s.title ?? 'Untitled'} / {s.author_name}</option>)}
            </select>
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Author name</label>
            <input type="text" value={p.author_name} onChange={(e) => update({ author_name: e.target.value })} className={inputCls} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Date</label>
            <input type="date" value={p.date} onChange={(e) => update({ date: e.target.value })} className={inputCls} />
          </div>
        </div>
      )
    }

    // ── Contents ─────────────────────────────────────────────────────────────────
    case 'contents': {
      const p = block.props as ContentsProps
      return (
        <div className="p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Contents</p>
          <div className="flex items-center gap-2 mb-3">
            <input type="checkbox" id="show_pg" checked={p.show_page_numbers} onChange={(e) => update({ show_page_numbers: e.target.checked })} />
            <label htmlFor="show_pg" className={labelCls + ' mb-0'}>Show page numbers</label>
          </div>
          <div className={fieldCls}>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls + ' mb-0'}>Entries</label>
              {submissions.length > 0 && (
                <button type="button"
                  onClick={() => update({ entries: submissions.map((s, i) => ({ title: s.title ?? 'Untitled', author: s.author_name, page: i + 1 })) })}
                  className="font-mono text-[10px] text-olive hover:text-near-black transition-colors">
                  ↺ Sync from submissions
                </button>
              )}
            </div>
            {p.entries.map((entry, i) => (
              <div key={i} className="border border-near-black/10 p-2 mb-1 space-y-1">
                <input type="text" value={entry.title} placeholder="Title"
                  onChange={(e) => {
                    const entries = p.entries.map((en, idx) => idx === i ? { ...en, title: e.target.value } : en)
                    update({ entries })
                  }} className={inputCls} />
                <input type="text" value={entry.author} placeholder="Author"
                  onChange={(e) => {
                    const entries = p.entries.map((en, idx) => idx === i ? { ...en, author: e.target.value } : en)
                    update({ entries })
                  }} className={inputCls} />
                <div className="flex gap-1">
                  <input type="number" value={entry.page} placeholder="Pg"
                    onChange={(e) => {
                      const entries = p.entries.map((en, idx) => idx === i ? { ...en, page: parseInt(e.target.value, 10) } : en)
                      update({ entries })
                    }} className={inputCls + ' w-16'} />
                  <button type="button" onClick={() => update({ entries: p.entries.filter((_, idx) => idx !== i) })}
                    className="font-mono text-xs text-accent-red px-2">×</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => update({ entries: [...p.entries, { title: '', author: '', page: p.entries.length + 1 }] })}
              className="font-mono text-xs text-olive hover:text-near-black transition-colors">+ Add entry</button>
          </div>
        </div>
      )
    }

    // ── Colophon ─────────────────────────────────────────────────────────────────
    case 'colophon': {
      const p = block.props as ColophonProps
      return (
        <div className="p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Colophon</p>
          <div className={fieldCls}>
            <label className={labelCls}>Text</label>
            <textarea rows={6} value={p.text} onChange={(e) => update({ text: e.target.value })} className={inputCls + ' resize-none'} />
          </div>
        </div>
      )
    }

    // ── Spacer ───────────────────────────────────────────────────────────────────
    case 'spacer': {
      const p = block.props as SpacerProps
      return (
        <div className="p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Spacer</p>
          <div className={fieldCls}>
            <label className={labelCls}>Height</label>
            <input type="text" value={p.height} onChange={(e) => update({ height: e.target.value })} className={inputCls} placeholder="e.g. 2rem" />
          </div>
        </div>
      )
    }

    default:
      return <div className="p-4"><p className="font-mono text-xs text-olive">No inspector for this block type.</p></div>
  }
}
