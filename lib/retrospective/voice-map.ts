import type { VoicePersona } from './types'

// ElevenLabs voice IDs — update these to match voices in your ElevenLabs account.
// Defaults use widely-available starter voices from the ElevenLabs voice library.
export const ELEVENLABS_VOICE_MAP: Record<VoicePersona, string> = {
  measured:     '21m00Tcm4TlvDq8ikWAM', // Rachel — calm, authoritative
  defensive:    'yoZ06aMxZJJ28mfd3POQ', // Sam    — faster, slightly tense
  enthusiastic: 'MF3mGyEYCl7XYWbV9V6O', // Elli   — upbeat, warmer
  regretful:    'TxGEqnHWrfWFTfGW9XjX', // Josh   — slower, quieter
  pragmatic:    'ErXwobaYiN019PkySvjV',  // Antoni — neutral, matter-of-fact
  bitter:       'VR6AewLTigWG4xSOukaG',  // Arnold — flat, clipped
  proud:        'AZnzlk1XvdvUeBnXmlld',  // Domi   — confident, strong
}

// Web Speech API voice selection — preference order for each persona.
// Matched by voiceURI substring or lang; first match wins.
export const WEBSPEECH_VOICE_HINTS: Record<VoicePersona, string[]> = {
  measured:     ['Samantha', 'Karen', 'Victoria', 'en-US'],
  defensive:    ['Alex', 'Daniel', 'en-GB'],
  enthusiastic: ['Ava', 'Siri', 'Tessa', 'en-AU'],
  regretful:    ['Tom', 'Fred', 'en'],
  pragmatic:    ['Albert', 'Moira', 'en-IE'],
  bitter:       ['Bad News', 'Bahh', 'Boing'],
  proud:        ['Shelley', 'Fiona', 'Zoe'],
}

// ElevenLabs TTS settings
export const ELEVENLABS_MODEL = 'eleven_turbo_v2'
export const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1'
