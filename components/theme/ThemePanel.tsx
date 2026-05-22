'use client'

import { useState, useEffect, useCallback } from 'react'
import { extractThemeFromUrl, getDefaultLLMProvider, type LLMProvider } from '@/app/actions/theme'
import {
  applyTheme, resetTheme, getPersistedTheme,
  getUserPresets, saveUserPreset, deleteUserPreset,
  type UserPreset,
} from '@/lib/theme/apply'
import { PRESETS, type Preset } from '@/lib/theme/presets'
import type { ThemeTokens } from '@/lib/theme/types'

type ExtractStep = 'idle' | 'fetching' | 'asking' | 'applying' | 'done' | 'error'

function ColourSwatch({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-5 h-5 border border-[var(--color-border)] flex-shrink-0"
        style={{ background: hex }}
      />
      <span className="font-mono text-[11px] text-[var(--color-muted)]">{label}</span>
      <span className="font-mono text-[11px] ml-auto">{hex}</span>
    </div>
  )
}

function PresetButton({ preset, onApply }: { preset: Preset | UserPreset; onApply: (t: ThemeTokens) => void }) {
  return (
    <button
      onClick={() => onApply(preset.tokens)}
      className="w-full text-left px-3 py-2 border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface)] transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[12px]">{preset.label}</span>
        <div className="flex gap-1 flex-shrink-0">
          {Object.values(preset.tokens.colours).slice(0, 5).map((hex, i) => (
            <div key={i} className="w-3 h-3" style={{ background: hex }} />
          ))}
        </div>
      </div>
    </button>
  )
}

function ProviderToggle({
  value,
  onChange,
}: {
  value: LLMProvider
  onChange: (p: LLMProvider) => void
}) {
  return (
    <div className="flex border border-[var(--color-border)] overflow-hidden">
      {(['ollama', 'anthropic'] as LLMProvider[]).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`flex-1 font-mono text-[11px] py-1.5 transition-colors ${
            value === p
              ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
              : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          {p === 'ollama' ? 'Local' : 'Anthropic'}
        </button>
      ))}
    </div>
  )
}

export function ThemePanel() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [step, setStep] = useState<ExtractStep>('idle')
  const [stepMsg, setStepMsg] = useState('')
  const [provider, setProvider] = useState<LLMProvider>('anthropic')
  const [currentTokens, setCurrentTokens] = useState<ThemeTokens | null>(null)
  const [userPresets, setUserPresets] = useState<UserPreset[]>([])
  const [saveLabel, setSaveLabel] = useState('')

  const refreshUserPresets = useCallback(() => {
    setUserPresets(getUserPresets())
  }, [])

  useEffect(() => {
    setCurrentTokens(getPersistedTheme())
    refreshUserPresets()
    // Load default provider from server env on mount
    getDefaultLLMProvider().then(setProvider)
  }, [refreshUserPresets])

  const handleApply = useCallback((tokens: ThemeTokens) => {
    applyTheme(tokens)
    setCurrentTokens(tokens)
  }, [])

  const handleReset = useCallback(() => {
    resetTheme()
    setCurrentTokens(null)
  }, [])

  const handleExtract = useCallback(async () => {
    if (!url.trim()) return
    setStep('fetching')
    setStepMsg('Fetching CSS from page…')
    try {
      setStep('asking')
      const modelLabel = provider === 'ollama'
        ? `Local (${process.env.NEXT_PUBLIC_OLLAMA_MODEL ?? 'ollama'})`
        : 'Claude'
      setStepMsg(`Asking ${modelLabel} to extract tokens…`)
      const { tokens, error, debug } = await extractThemeFromUrl(url.trim(), provider)
      if (error || !tokens) {
        setStep('error')
        setStepMsg(error ?? 'Unknown error')
        if (debug) console.warn('[theme] debug:', debug)
        return
      }
      setStep('applying')
      setStepMsg('Applying theme…')
      handleApply(tokens)
      setStep('done')
      setStepMsg(`Applied: ${tokens.source_name}${debug ? ` — ${debug.split('|')[0].trim()}` : ''}`)
    } catch (e) {
      setStep('error')
      setStepMsg(e instanceof Error ? e.message : String(e))
    }
  }, [url, provider, handleApply])

  const handleSavePreset = useCallback(() => {
    if (!saveLabel.trim() || !currentTokens) return
    saveUserPreset(saveLabel.trim(), currentTokens)
    setSaveLabel('')
    refreshUserPresets()
  }, [saveLabel, currentTokens, refreshUserPresets])

  const handleDeletePreset = useCallback((id: string) => {
    deleteUserPreset(id)
    refreshUserPresets()
  }, [refreshUserPresets])

  const isBusy = step === 'fetching' || step === 'asking' || step === 'applying'
  const stepColour = step === 'error'
    ? 'text-[var(--color-accent)]'
    : step === 'done'
      ? 'text-green-700'
      : 'text-[var(--color-muted)]'

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Theme switcher"
        className="fixed bottom-20 left-4 z-50 w-10 h-10 border border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors flex items-center justify-center shadow-md"
        aria-label="Open theme switcher"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/>
          <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/>
          <path d="M14.5 17.5 4.5 15"/>
        </svg>
      </button>

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 left-0 h-full w-80 z-50 border-r border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <span className="font-mono text-[13px] font-medium uppercase tracking-widest">Theme</span>
          <button
            onClick={() => setOpen(false)}
            className="font-mono text-[18px] leading-none text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            aria-label="Close"
          >×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

          {/* URL extractor */}
          <section>
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)] mb-2">Extract from URL</h3>
            <input
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setStep('idle'); setStepMsg('') }}
              placeholder="https://example.com"
              className="w-full font-mono text-[12px] px-3 py-2 border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:border-[var(--color-accent)] mb-2"
            />
            <ProviderToggle value={provider} onChange={setProvider} />
            <button
              onClick={handleExtract}
              disabled={!url.trim() || isBusy}
              className="mt-2 w-full font-mono text-[12px] px-3 py-2 border border-[var(--color-border)] hover:border-[var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isBusy ? '…' : 'Extract & Apply'}
            </button>
            {stepMsg && (
              <p className={`mt-1 font-mono text-[11px] ${stepColour}`}>{stepMsg}</p>
            )}
          </section>

          {/* Built-in presets */}
          <section>
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)] mb-2">Presets</h3>
            <div className="space-y-1">
              {PRESETS.map(p => (
                <PresetButton key={p.id} preset={p} onApply={handleApply} />
              ))}
            </div>
          </section>

          {/* User-saved presets */}
          {userPresets.length > 0 && (
            <section>
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)] mb-2">Saved</h3>
              <div className="space-y-1">
                {userPresets.map(p => (
                  <div key={p.id} className="flex items-center gap-1">
                    <div className="flex-1">
                      <PresetButton preset={p} onApply={handleApply} />
                    </div>
                    <button
                      onClick={() => handleDeletePreset(p.id)}
                      className="font-mono text-[11px] text-[var(--color-muted)] hover:text-[var(--color-accent)] px-1 flex-shrink-0"
                      title="Delete"
                    >×</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Save current */}
          {currentTokens && (
            <section>
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)] mb-2">Save Current</h3>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={saveLabel}
                  onChange={e => setSaveLabel(e.target.value)}
                  placeholder="Name"
                  className="flex-1 font-mono text-[12px] px-3 py-2 border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:border-[var(--color-accent)]"
                />
                <button
                  onClick={handleSavePreset}
                  disabled={!saveLabel.trim()}
                  className="font-mono text-[12px] px-3 py-2 border border-[var(--color-border)] hover:border-[var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >Save</button>
              </div>
            </section>
          )}

          {/* Current theme display */}
          {currentTokens && (
            <section>
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)] mb-2">
                Current — {currentTokens.source_name}
              </h3>
              <div className="space-y-1 mb-3">
                <ColourSwatch hex={currentTokens.colours.background} label="bg" />
                <ColourSwatch hex={currentTokens.colours.surface}    label="surface" />
                <ColourSwatch hex={currentTokens.colours.text}       label="text" />
                <ColourSwatch hex={currentTokens.colours.muted}      label="muted" />
                <ColourSwatch hex={currentTokens.colours.accent}     label="accent" />
                <ColourSwatch hex={currentTokens.colours.border}     label="border" />
              </div>
              <div className="space-y-0.5 font-mono text-[11px] text-[var(--color-muted)]">
                <p>Heading: {currentTokens.fonts.heading.family}</p>
                <p>Body: {currentTokens.fonts.body.family}</p>
                <p>UI: {currentTokens.fonts.ui.family}</p>
                <p>Scale: {currentTokens.scale.h1} / {currentTokens.scale.body} / {currentTokens.scale.line_height}</p>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--color-border)]">
          <button
            onClick={handleReset}
            className="w-full font-mono text-[12px] px-3 py-2 border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          >Reset to Default</button>
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}
