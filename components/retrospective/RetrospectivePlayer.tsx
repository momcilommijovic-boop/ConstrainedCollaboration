'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { RetrospectiveRow, SegmentRow } from '@/lib/retrospective/types'
import { WEBSPEECH_VOICE_HINTS } from '@/lib/retrospective/voice-map'
import type { VoicePersona } from '@/lib/retrospective/types'

const INTER_SEGMENT_PAUSE_MS = 1500

const ROLE_COLOR: Record<string, string> = {
  EDITOR: 'text-accent-red border-accent-red',
  WRITER: 'text-near-black border-near-black/40',
  ILLUSTRATOR: 'text-olive border-olive/40',
  MEMBER: 'text-olive border-near-black/20',
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'text-olive',
  WARNED: 'text-accent-red',
  KICKED: 'text-accent-red',
}

interface Props {
  retrospective: RetrospectiveRow
  segments: SegmentRow[]
}

export function RetrospectivePlayer({ retrospective, segments }: Props) {
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [segmentProgress, setSegmentProgress] = useState(0) // 0–1 for current segment
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set())
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [hasWebSpeech, setHasWebSpeech] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const useElevenLabs = retrospective.tts_provider === 'elevenlabs'
  const sortedSegments = [...segments].sort((a, b) => a.segment_index - b.segment_index)

  // ── Web Speech setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    setHasWebSpeech(true)
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(progressIntervalRef.current!)
      clearTimeout(pauseTimeoutRef.current!)
      audioRef.current?.pause()
      if (hasWebSpeech) window.speechSynthesis.cancel()
    }
  }, [hasWebSpeech])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const clearTimers = () => {
    clearInterval(progressIntervalRef.current!)
    clearTimeout(pauseTimeoutRef.current!)
  }

  const getWebSpeechVoice = (persona: string): SpeechSynthesisVoice | undefined => {
    const hints = WEBSPEECH_VOICE_HINTS[persona as VoicePersona] ?? []
    for (const hint of hints) {
      const found = voices.find(
        (v) => v.voiceURI.includes(hint) || v.name.includes(hint) || v.lang.startsWith(hint)
      )
      if (found) return found
    }
    return voices.find((v) => v.lang.startsWith('en')) ?? voices[0]
  }

  // ── Advance to next segment ─────────────────────────────────────────────────
  const advance = useCallback((from: number) => {
    clearTimers()
    const next = from + 1
    if (next >= sortedSegments.length) {
      setIsPlaying(false)
      setCurrentIndex(-1)
      setSegmentProgress(0)
      return
    }
    pauseTimeoutRef.current = setTimeout(() => playIndex(next), INTER_SEGMENT_PAUSE_MS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedSegments.length])

  // ── Play a segment by index ─────────────────────────────────────────────────
  const playIndex = useCallback((index: number) => {
    clearTimers()
    const seg = sortedSegments[index]
    if (!seg) return

    setCurrentIndex(index)
    setSegmentProgress(0)
    setIsPlaying(true)

    const estimatedMs = (seg.duration_estimate_seconds ?? 60) * 1000
    const startTime = Date.now()

    // Shared progress updater (used for webspeech where we estimate time)
    const startProgressTimer = () => {
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime
        setSegmentProgress(Math.min(1, elapsed / estimatedMs))
      }, 200)
    }

    const hasAudioUrl = useElevenLabs && !!seg.audio_url

    if (hasAudioUrl) {
      // ── ElevenLabs audio from URL ──────────────────────────────────────────
      if (!audioRef.current) {
        audioRef.current = new Audio()
      }
      const audio = audioRef.current
      audio.src = seg.audio_url!
      audio.onloadedmetadata = () => {
        // Once we know the real duration, switch to time-based progress
        clearInterval(progressIntervalRef.current!)
        progressIntervalRef.current = setInterval(() => {
          setSegmentProgress(audio.duration ? audio.currentTime / audio.duration : 0)
        }, 200)
      }
      audio.onended = () => {
        clearTimers()
        setSegmentProgress(1)
        advance(index)
      }
      audio.onerror = () => {
        // Audio failed: fall through to Web Speech for this segment
        clearTimers()
        speakWithWebSpeech(seg, index, startProgressTimer)
      }
      audio.play().catch(() => {
        clearTimers()
        speakWithWebSpeech(seg, index, startProgressTimer)
      })
      startProgressTimer()
    } else {
      speakWithWebSpeech(seg, index, startProgressTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedSegments, useElevenLabs, advance])

  const speakWithWebSpeech = (
    seg: SegmentRow,
    index: number,
    startProgressTimer: () => void
  ) => {
    if (!hasWebSpeech) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(seg.text ?? '')
    utterance.voice = getWebSpeechVoice(seg.voice_persona ?? 'pragmatic') ?? null
    utterance.rate = 0.95
    utterance.onend = () => {
      clearTimers()
      setSegmentProgress(1)
      advance(index)
    }
    startProgressTimer()
    window.speechSynthesis.speak(utterance)
  }

  // ── Play/pause ──────────────────────────────────────────────────────────────
  const togglePlay = () => {
    if (isPlaying) {
      if (useElevenLabs && audioRef.current) {
        audioRef.current.pause()
      } else if (hasWebSpeech) {
        window.speechSynthesis.pause()
      }
      clearTimers()
      setIsPlaying(false)
    } else {
      if (currentIndex === -1) {
        playIndex(0)
      } else {
        if (useElevenLabs && audioRef.current) {
          audioRef.current.play()
        } else if (hasWebSpeech) {
          window.speechSynthesis.resume()
        }
        setIsPlaying(true)
      }
    }
  }

  const jumpTo = (index: number) => {
    if (useElevenLabs && audioRef.current) audioRef.current.pause()
    if (hasWebSpeech) window.speechSynthesis.cancel()
    clearTimers()
    playIndex(index)
  }

  const toggleTranscript = (index: number) => {
    setExpandedSegments((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // ── Overall episode progress ────────────────────────────────────────────────
  const totalSegments = sortedSegments.length
  const completedSegments = currentIndex === -1 ? 0 : currentIndex
  const overallProgress = totalSegments === 0
    ? 0
    : (completedSegments + segmentProgress) / totalSegments

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }
  const totalEstimatedSecs = sortedSegments.reduce((acc, s) => acc + (s.duration_estimate_seconds ?? 60), 0)

  return (
    <div className="flex flex-col gap-8">
      {/* Episode info */}
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-olive mb-2">
          Cycle {retrospective.cycle} · Retrospective Episode
        </p>
        <h1 className="font-serif-display text-4xl mb-4">{retrospective.episode_title ?? 'Untitled Episode'}</h1>
        {retrospective.episode_summary && (
          <p className="font-body text-base text-near-black/70 leading-relaxed max-w-2xl">
            {retrospective.episode_summary}
          </p>
        )}
      </div>

      {/* Player controls */}
      <div className="border border-near-black/20 px-6 py-5">
        <div className="flex items-center gap-5 mb-4">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-12 h-12 border border-near-black flex items-center justify-center hover:bg-near-black hover:text-off-white transition-colors shrink-0"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <span className="flex gap-1">
                <span className="w-1 h-4 bg-current" />
                <span className="w-1 h-4 bg-current" />
              </span>
            ) : (
              <span
                className="w-0 h-0 ml-1"
                style={{ borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '14px solid currentColor' }}
              />
            )}
          </button>

          {/* Episode info */}
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs text-near-black truncate">
              {currentIndex >= 0
                ? `${sortedSegments[currentIndex]?.speaker_name ?? '—'} — segment ${currentIndex + 1}/${totalSegments}`
                : 'Press play to begin'}
            </p>
            <p className="font-mono text-xs text-olive mt-0.5">
              {formatDuration(totalEstimatedSecs)} estimated · {totalSegments} segments ·{' '}
              <span className="uppercase">{retrospective.tts_provider ?? 'webspeech'}</span>
            </p>
          </div>
        </div>

        {/* Overall progress bar */}
        <div
          className="w-full h-1 bg-near-black/10 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = (e.clientX - rect.left) / rect.width
            const targetIndex = Math.floor(pct * totalSegments)
            jumpTo(Math.min(targetIndex, totalSegments - 1))
          }}
        >
          <div
            className="h-1 bg-near-black transition-all duration-200"
            style={{ width: `${overallProgress * 100}%` }}
          />
        </div>
      </div>

      {/* Segment list */}
      <div className="border border-near-black/20 flex flex-col gap-0">
        {sortedSegments.map((seg, i) => {
          const isActive = currentIndex === i
          const isExpanded = expandedSegments.has(i)
          const roleCls = ROLE_COLOR[seg.speaker_role ?? 'MEMBER'] ?? 'text-olive border-near-black/20'
          const statusCls = STATUS_COLOR[seg.speaker_status ?? 'ACTIVE'] ?? 'text-olive'
          const isLast = i === sortedSegments.length - 1

          return (
            <div
              key={seg.id}
              className={`px-5 py-4 ${!isLast ? 'border-b border-near-black/10' : ''} ${isActive ? 'bg-accent-red/5 border-l-2 border-l-accent-red' : ''}`}
            >
              <div className="flex items-start gap-4">
                {/* Segment number */}
                <span className="font-mono text-xs text-olive/50 shrink-0 mt-0.5 w-5 text-right">
                  {i + 1}
                </span>

                {/* Speaker info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <button
                      onClick={() => jumpTo(i)}
                      className="font-serif-display text-lg hover:text-accent-red transition-colors text-left"
                    >
                      {seg.speaker_name}
                    </button>
                    <span className={`font-mono text-[10px] border px-1.5 py-px ${roleCls}`}>
                      {seg.speaker_role}
                    </span>
                    {seg.speaker_status !== 'ACTIVE' && (
                      <span className={`font-mono text-[10px] ${statusCls}`}>
                        {seg.speaker_status}
                      </span>
                    )}
                    {isActive && (
                      <span className="font-mono text-[10px] text-accent-red">
                        ▶ playing
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-olive/60 italic">
                      {seg.voice_persona}
                    </span>
                    <span className="font-mono text-xs text-olive/40">
                      ~{formatDuration(seg.duration_estimate_seconds ?? 60)}
                    </span>
                    {seg.audio_url && (
                      <span className="font-mono text-[10px] text-olive/40 uppercase">mp3</span>
                    )}
                  </div>

                  {/* Segment progress bar (active only) */}
                  {isActive && (
                    <div className="w-full h-px bg-accent-red/20 mt-2">
                      <div
                        className="h-px bg-accent-red transition-all duration-200"
                        style={{ width: `${segmentProgress * 100}%` }}
                      />
                    </div>
                  )}

                  {/* Transcript */}
                  <button
                    onClick={() => toggleTranscript(i)}
                    className="font-mono text-xs text-olive/50 hover:text-olive transition-colors mt-2"
                  >
                    {isExpanded ? '▲ hide transcript' : '▼ show transcript'}
                  </button>

                  {isExpanded && (
                    <p className="font-body text-sm text-near-black/70 leading-relaxed mt-3 whitespace-pre-wrap border-l border-near-black/10 pl-4">
                      {seg.text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
