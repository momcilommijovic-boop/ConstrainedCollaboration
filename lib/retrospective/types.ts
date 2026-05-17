export type VoicePersona =
  | 'measured'
  | 'defensive'
  | 'enthusiastic'
  | 'regretful'
  | 'pragmatic'
  | 'bitter'
  | 'proud'

export type InterviewSegment = {
  speaker_name: string
  speaker_role: string
  speaker_status: string
  voice_persona: VoicePersona
  text: string
  duration_estimate_seconds: number
}

export type EpisodeScript = {
  episode_title: string
  episode_summary: string
  segments: InterviewSegment[]
}

export type CycleMember = {
  user_id: string
  display_name: string
  role: string
  status: string
  merit_score: number
  merit_history: Array<{ event: string; delta: number; ts: string }>
}

export type CycleContext = {
  cell: {
    id: string
    title: string
    description: string | null
    slug: string
    cycle: number
  }
  members: CycleMember[]
  brief: {
    title: string
    theme: string
    guidance: string
    published_at: string
    deadline: string
  } | null
  invitations: Array<{
    invitee_name: string
    status: string
  }>
  submissions: Array<{
    author_name: string
    title: string | null
    status: string
    editor_note: string | null
    submitted_at: string | null
  }>
  publication: {
    published_at: string | null
    promotion_deadline: string | null
    status: string
    article_count: number
  } | null
  promotionRecords: Array<{
    member_name: string
    status: string
    evidence_url: string | null
  }>
  penalties: Array<{
    member_name: string
    reason: string
    merit_delta: number
    stage: string | null
  }>
}

export type RetrospectiveRow = {
  id: string
  cell_id: string
  cycle: number
  episode_title: string | null
  episode_summary: string | null
  status: 'GENERATING' | 'READY' | 'FAILED'
  generated_at: string
  tts_provider: string | null
}

export type SegmentRow = {
  id: string
  retrospective_id: string
  segment_index: number
  speaker_name: string | null
  speaker_role: string | null
  speaker_status: string | null
  voice_persona: string | null
  text: string | null
  duration_estimate_seconds: number | null
  audio_url: string | null
  created_at: string
}
