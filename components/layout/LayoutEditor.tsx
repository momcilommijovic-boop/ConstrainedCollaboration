'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { nanoid } from 'nanoid'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { saveLayout, suggestLayout, uploadMedia } from '@/app/actions/layout'
import { BlockInspector } from './BlockInspector'
import { renderPage } from '@/lib/layout/renderer'
import type { Block, DesignTokens, MediaItem, Page, SubmissionForRender } from '@/lib/layout/types'

type SaveStatus = 'saved' | 'saving' | 'unsaved'

// ── Block type palette ────────────────────────────────────────────────────────

const BLOCK_TYPES: Array<{ type: Block['type']; label: string }> = [
  { type: 'cover', label: 'Cover' },
  { type: 'article_body', label: 'Article Body' },
  { type: 'heading', label: 'Heading' },
  { type: 'standfirst', label: 'Standfirst' },
  { type: 'pull_quote', label: 'Pull Quote' },
  { type: 'image_full', label: 'Image — Full' },
  { type: 'image_inline', label: 'Image — Inline' },
  { type: 'image_duo', label: 'Image — Duo' },
  { type: 'byline', label: 'Byline' },
  { type: 'divider', label: 'Divider' },
  { type: 'contents', label: 'Contents' },
  { type: 'colophon', label: 'Colophon' },
  { type: 'spacer', label: 'Spacer' },
]

function defaultProps(type: Block['type'], submissions: SubmissionForRender[]): Block['props'] {
  const firstSub = submissions[0]
  switch (type) {
    case 'cover': return { title: 'Issue Title', subtitle: '', issue_number: 'Issue 1', image_id: null, overlay_opacity: 40, title_position: 'bottom-left' }
    case 'article_body': return { submission_id: firstSub?.id ?? '', show_drop_cap: true, column_width: '80%', show_title: true, show_byline: true, inline_image_id: null, inline_image_position: 'left', inline_image_width: '40%' }
    case 'heading': return { text: 'Heading', level: 'h2', align: 'left' }
    case 'standfirst': return { text: 'An introductory paragraph that sets the scene.' }
    case 'pull_quote': return { text: 'A compelling sentence from the article.', attribution: null, style_override: null }
    case 'image_full': return { image_id: '', caption: '', alt: '', aspect: '16:9' }
    case 'image_inline': return { image_id: '', caption: '', alt: '', position: 'left', width: '40%' }
    case 'image_duo': return { image_ids: ['', ''], captions: ['', ''], gap: 'normal' }
    case 'divider': return { style: 'rule', weight: null }
    case 'byline': return { submission_id: firstSub?.id ?? null, author_name: firstSub?.author_name ?? 'Author', author_profile_url: null, date: new Date().toISOString().split('T')[0] }
    case 'contents': return { show_page_numbers: true, entries: submissions.map((s, i) => ({ title: s.title ?? 'Untitled', author: s.author_name, page: i + 1 })) }
    case 'colophon': return { text: 'Published by Quorum.\nAll rights reserved.' }
    case 'spacer': return { height: '2rem' }
  }
}

// ── Sortable block row ────────────────────────────────────────────────────────

function SortableBlockRow({
  block,
  isSelected,
  onSelect,
  onDelete,
}: {
  block: Block
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 border-b border-near-black/10 cursor-pointer hover:bg-near-black/5 ${isSelected ? 'bg-near-black/10' : ''}`}
      onClick={onSelect}
    >
      <span {...attributes} {...listeners} className="text-olive/40 cursor-grab hover:text-olive shrink-0 select-none" title="Drag to reorder">⠿</span>
      <span className="font-mono text-xs flex-1 truncate">{block.type.replace('_', ' ')}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="font-mono text-xs text-olive/40 hover:text-accent-red transition-colors shrink-0"
        title="Delete block"
      >×</button>
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

interface Props {
  publicationId: string
  cellId: string
  cellSlug: string
  cycle: number
  initialPages: Page[]
  tokens: DesignTokens
  submissions: SubmissionForRender[]
  media: MediaItem[]
}

export function LayoutEditor({
  publicationId,
  cellId,
  cellSlug,
  cycle,
  initialPages,
  tokens,
  submissions,
  media: initialMedia,
}: Props) {
  const [pages, setPages] = useState<Page[]>(
    initialPages.length > 0 ? initialPages : []
  )
  const [currentPageIdx, setCurrentPageIdx] = useState(0)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'blocks' | 'inspector'>('blocks')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [media, setMedia] = useState<MediaItem[]>(initialMedia)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [suggestedPages, setSuggestedPages] = useState<Page[] | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentPage = pages[currentPageIdx] ?? null
  const selectedBlock = currentPage?.blocks.find((b) => b.id === selectedBlockId) ?? null

  // Render page into iframe
  useEffect(() => {
    const frame = iframeRef.current
    if (!frame || !currentPage) return
    const html = renderPage(currentPage, tokens, media, submissions)
    const doc = frame.contentDocument ?? frame.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
  }, [currentPage, tokens, media, submissions])

  // Auto-save
  const doSave = useCallback(async (pagesToSave: Page[]) => {
    setSaveStatus('saving')
    setSaveError(null)
    const result = await saveLayout(publicationId, pagesToSave, cellId, cycle)
    if (result.error) {
      setSaveStatus('unsaved')
      setSaveError(result.error)
    } else {
      setSaveStatus('saved')
    }
  }, [publicationId, cellId, cycle])

  const scheduleSave = useCallback((pagesToSave: Page[]) => {
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(pagesToSave), 2000)
  }, [doSave])

  function updatePages(next: Page[]) {
    setPages(next)
    scheduleSave(next)
  }

  function addPage() {
    const next: Page = { id: nanoid(8), label: `Page ${pages.length + 1}`, blocks: [] }
    updatePages([...pages, next])
    setCurrentPageIdx(pages.length)
  }

  function deletePage(idx: number) {
    if (pages.length === 1) return
    const next = pages.filter((_, i) => i !== idx)
    updatePages(next)
    setCurrentPageIdx(Math.min(idx, next.length - 1))
  }

  function renamePage(idx: number, label: string) {
    const next = pages.map((p, i) => (i === idx ? { ...p, label } : p))
    updatePages(next)
  }

  function updatePagePadding(idx: number, field: 'padding_l' | 'padding_r' | 'padding_v', value: string) {
    const next = pages.map((p, i) => (i === idx ? { ...p, [field]: value || undefined } : p))
    updatePages(next)
  }

  function toggleOrientation() {
    const current = currentPage?.orientation ?? 'portrait'
    const next = pages.map((p) => ({ ...p, orientation: (current === 'portrait' ? 'landscape' : 'portrait') as 'portrait' | 'landscape' }))
    updatePages(next)
  }

  function adjustFontSize(delta: number) {
    const current = currentPage?.font_size_px ?? 16
    const next = pages.map((p) => ({ ...p, font_size_px: Math.max(10, Math.min(28, current + delta)) }))
    updatePages(next)
  }



  function addBlock(type: Block['type']) {
    if (!currentPage) return
    const block = { type, id: nanoid(8), props: defaultProps(type, submissions) } as Block
    const updatedPage = { ...currentPage, blocks: [...currentPage.blocks, block] }
    const next = pages.map((p, i) => (i === currentPageIdx ? updatedPage : p))
    updatePages(next)
    setSelectedBlockId(block.id)
    setRightTab('inspector')
  }

  function deleteBlock(blockId: string) {
    if (!currentPage) return
    const updatedPage = { ...currentPage, blocks: currentPage.blocks.filter((b) => b.id !== blockId) }
    const next = pages.map((p, i) => (i === currentPageIdx ? updatedPage : p))
    updatePages(next)
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null)
      setRightTab('blocks')
    }
  }

  function updateBlock(blockId: string, updated: Block) {
    if (!currentPage) return
    const updatedPage = {
      ...currentPage,
      blocks: currentPage.blocks.map((b) => (b.id === blockId ? updated : b)),
    }
    const next = pages.map((p, i) => (i === currentPageIdx ? updatedPage : p))
    updatePages(next)
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !currentPage) return
    const oldIdx = currentPage.blocks.findIndex((b) => b.id === active.id)
    const newIdx = currentPage.blocks.findIndex((b) => b.id === over.id)
    const updatedPage = { ...currentPage, blocks: arrayMove(currentPage.blocks, oldIdx, newIdx) }
    const next = pages.map((p, i) => (i === currentPageIdx ? updatedPage : p))
    updatePages(next)
  }

  async function handleAutoLayout() {
    setSuggestLoading(true)
    setSuggestError(null)
    const result = await suggestLayout(publicationId)
    setSuggestLoading(false)
    if (result.error) {
      setSuggestError(result.error)
      return
    }
    if (!result.pages || result.pages.length === 0) {
      setSuggestError('Auto-layout returned no pages. Try again.')
      return
    }
    setSuggestedPages(result.pages)
  }

  function acceptSuggestion(mode: 'replace' | 'append') {
    if (!suggestedPages) return
    if (mode === 'replace') {
      updatePages(suggestedPages)
      setCurrentPageIdx(0)
    } else {
      updatePages([...pages, ...suggestedPages])
      setCurrentPageIdx(pages.length)
    }
    setSuggestedPages(null)
  }

  function previewCurrentPage() {
    if (!currentPage) return
    const html = renderPage(currentPage, tokens, media, submissions)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  async function handleMediaUpload(file: File) {
    const fd = new FormData()
    fd.append('cell_id', cellId)
    fd.append('cycle', String(cycle))
    fd.append('file', file)
    const result = await uploadMedia(fd)
    if (result.error || !result.media) return
    setMedia((prev) => [{
      id: result.media!.id,
      cell_id: cellId,
      cycle,
      uploader_id: null,
      filename: result.media!.filename,
      storage_url: result.media!.storage_url,
      width: null,
      height: null,
      alt_text: null,
      focal_point_x: 0.5,
      focal_point_y: 0.5,
      uploaded_at: new Date().toISOString(),
    }, ...prev])
  }

  const saveStatusLabel = saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? 'Saving…' : 'Unsaved changes'
  const saveStatusCls = saveStatus === 'unsaved' ? 'text-accent-red' : 'text-olive'

  return (
    <div className="flex h-full">
      {/* ── Left: Page list ── */}
      <div className="w-48 border-r border-near-black/20 flex flex-col shrink-0 bg-off-white overflow-y-auto">
        <div className="px-3 py-3 border-b border-near-black/10 flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-widest text-olive">Pages</p>
          <button type="button" onClick={addPage}
            className="font-mono text-xs text-olive hover:text-near-black transition-colors">+</button>
        </div>
        {pages.map((page, idx) => (
          <div
            key={page.id}
            className={`group flex items-center gap-2 px-3 py-2.5 border-b border-near-black/10 cursor-pointer hover:bg-near-black/5 ${idx === currentPageIdx ? 'bg-near-black/10' : ''}`}
            onClick={() => { setCurrentPageIdx(idx); setSelectedBlockId(null) }}
          >
            <span className="font-mono text-xs flex-1 truncate">{page.label}</span>
            <span className="font-mono text-[10px] text-olive/50 shrink-0">{page.blocks.length}b</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); deletePage(idx) }}
              className="font-mono text-xs text-olive/0 group-hover:text-olive/40 hover:!text-accent-red transition-colors shrink-0"
            >×</button>
          </div>
        ))}
        {pages.length === 0 && (
          <p className="font-mono text-xs text-olive/50 px-3 py-4 text-center">No pages yet</p>
        )}
        <div className="mt-auto px-3 py-3 border-t border-near-black/10 space-y-2">
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] text-olive flex-1">Font size</span>
            <button type="button" onClick={() => adjustFontSize(-1)}
              className="font-mono text-xs border border-near-black/20 w-6 h-6 flex items-center justify-center hover:bg-near-black hover:text-off-white transition-colors">−</button>
            <span className="font-mono text-xs w-8 text-center">{currentPage?.font_size_px ?? 16}px</span>
            <button type="button" onClick={() => adjustFontSize(+1)}
              className="font-mono text-xs border border-near-black/20 w-6 h-6 flex items-center justify-center hover:bg-near-black hover:text-off-white transition-colors">+</button>
          </div>
          <button
            type="button"
            onClick={handleAutoLayout}
            disabled={suggestLoading}
            className="w-full font-mono text-xs border border-near-black/20 px-2 py-1.5 hover:bg-near-black hover:text-off-white transition-colors disabled:opacity-40 text-left"
          >
            {suggestLoading ? 'Thinking…' : 'Auto-layout'}
          </button>
          {suggestError && (
            <p className="font-mono text-[10px] text-accent-red leading-relaxed">{suggestError}</p>
          )}
          <button
            type="button"
            onClick={() => doSave(pages)}
            className="w-full font-mono text-xs border border-near-black/20 px-2 py-1.5 hover:bg-near-black hover:text-off-white transition-colors text-left"
          >
            Save now
          </button>
          <p className={`font-mono text-[10px] ${saveStatusCls}`}>{saveStatusLabel}</p>
          {saveError && (
            <p className="font-mono text-[10px] text-accent-red leading-relaxed">{saveError}</p>
          )}
        </div>
      </div>

      {/* ── Centre: Canvas ── */}
      <div className="flex-1 overflow-auto bg-near-black/5 flex flex-col">
        {suggestedPages && (
          <div className="bg-near-black text-off-white px-4 py-2 flex items-center gap-4 shrink-0 flex-wrap">
            <span className="font-mono text-xs">AI suggested a {suggestedPages.length}-page layout.</span>
            <button onClick={() => acceptSuggestion('append')} className="font-mono text-xs border border-off-white/40 px-3 py-1 hover:bg-off-white/10 transition-colors">Append pages</button>
            <button onClick={() => acceptSuggestion('replace')} className="font-mono text-xs border border-off-white/20 px-3 py-1 text-off-white/60 hover:bg-off-white/10 transition-colors">Replace layout</button>
            <button onClick={() => setSuggestedPages(null)} className="font-mono text-xs text-off-white/40 hover:text-off-white transition-colors">Dismiss</button>
          </div>
        )}

        {/* Page label + margin editor */}
        {currentPage && (
          <div className="bg-off-white border-b border-near-black/20 px-4 py-2 flex items-center gap-3 shrink-0 flex-wrap">
            <span className="font-mono text-xs text-olive">Label:</span>
            <input
              type="text"
              value={currentPage.label}
              onChange={(e) => renamePage(currentPageIdx, e.target.value)}
              className="font-mono text-xs border border-near-black/20 bg-transparent px-2 py-1 focus:outline-none focus:border-near-black w-32"
            />
            <button
              type="button"
              onClick={toggleOrientation}
              className="font-mono text-xs border border-near-black/20 px-2 py-1 hover:bg-near-black hover:text-off-white transition-colors"
              title="Toggle all pages between portrait and landscape"
            >
              {(currentPage.orientation ?? 'portrait') === 'portrait' ? 'Portrait' : 'Landscape'}
            </button>
            <span className="font-mono text-xs text-olive/50">|</span>
            <span className="font-mono text-xs text-olive">Margins:</span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[10px] text-olive">L</span>
              <input
                type="text"
                value={currentPage.padding_l ?? ''}
                onChange={(e) => updatePagePadding(currentPageIdx, 'padding_l', e.target.value)}
                placeholder="e.g. 3rem"
                className="font-mono text-xs border border-near-black/20 bg-transparent px-2 py-1 focus:outline-none focus:border-near-black w-20"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[10px] text-olive">R</span>
              <input
                type="text"
                value={currentPage.padding_r ?? ''}
                onChange={(e) => updatePagePadding(currentPageIdx, 'padding_r', e.target.value)}
                placeholder="e.g. 3rem"
                className="font-mono text-xs border border-near-black/20 bg-transparent px-2 py-1 focus:outline-none focus:border-near-black w-20"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[10px] text-olive">V</span>
              <input
                type="text"
                value={currentPage.padding_v ?? ''}
                onChange={(e) => updatePagePadding(currentPageIdx, 'padding_v', e.target.value)}
                placeholder="e.g. 4rem"
                className="font-mono text-xs border border-near-black/20 bg-transparent px-2 py-1 focus:outline-none focus:border-near-black w-20"
              />
            </div>
            <button
              type="button"
              onClick={previewCurrentPage}
              className="ml-auto font-mono text-xs text-olive hover:text-near-black transition-colors"
            >
              Preview page ↗
            </button>
          </div>
        )}

        {currentPage ? (
          <iframe
            ref={iframeRef}
            title="Page canvas"
            className="flex-1 w-full border-none"
            style={{ minHeight: '600px' }}
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="font-mono text-xs text-olive mb-4">No pages yet.</p>
              <button type="button" onClick={addPage}
                className="font-mono text-xs border border-near-black/20 px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors">
                + Add first page
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Block palette + Inspector ── */}
      <div className="w-72 border-l border-near-black/20 flex flex-col shrink-0 bg-off-white">
        {/* Tab bar */}
        <div className="flex border-b border-near-black/20 shrink-0">
          {(['blocks', 'inspector'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setRightTab(tab)}
              className={`flex-1 font-mono text-xs py-2.5 transition-colors ${rightTab === tab ? 'bg-near-black text-off-white' : 'text-olive hover:text-near-black'}`}
            >
              {tab === 'blocks' ? 'Blocks' : 'Inspector'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {rightTab === 'blocks' && (
            <div className="p-3">
              <p className="font-mono text-xs uppercase tracking-widest text-olive mb-3">Add Block</p>

              {/* Block list for current page */}
              {currentPage && currentPage.blocks.length > 0 && (
                <div className="mb-4 border border-near-black/20">
                  <p className="font-mono text-xs uppercase tracking-widest text-olive px-3 py-2 border-b border-near-black/10">Current page</p>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={currentPage.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                      {currentPage.blocks.map((block) => (
                        <SortableBlockRow
                          key={block.id}
                          block={block}
                          isSelected={selectedBlockId === block.id}
                          onSelect={() => { setSelectedBlockId(block.id); setRightTab('inspector') }}
                          onDelete={() => deleteBlock(block.id)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}

              <p className="font-mono text-xs uppercase tracking-widest text-olive mb-2">Palette</p>
              <div className="space-y-1">
                {BLOCK_TYPES.map(({ type, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addBlock(type)}
                    disabled={!currentPage}
                    className="w-full text-left font-mono text-xs border border-near-black/20 px-3 py-2 hover:bg-near-black hover:text-off-white transition-colors disabled:opacity-40"
                  >
                    + {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {rightTab === 'inspector' && (
            selectedBlock && currentPage ? (
              <BlockInspector
                block={selectedBlock}
                tokens={tokens}
                submissions={submissions}
                media={media}
                onUpdate={(updated) => updateBlock(selectedBlock.id, updated)}
                onUploadMedia={handleMediaUpload}
              />
            ) : (
              <div className="p-4">
                <p className="font-mono text-xs text-olive">Select a block to inspect it.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
