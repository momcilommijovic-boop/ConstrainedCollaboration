-- ============================================================
-- Migration 007: Retrospective episode tables + storage bucket
-- ============================================================

create table retrospectives (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references cells(id) on delete cascade,
  cycle integer not null,
  episode_title text,
  episode_summary text,
  status text not null default 'GENERATING'
    check (status in ('GENERATING', 'READY', 'FAILED')),
  generated_at timestamptz not null default now(),
  tts_provider text,
  unique(cell_id, cycle)
);

alter table retrospectives enable row level security;

create table retrospective_segments (
  id uuid primary key default gen_random_uuid(),
  retrospective_id uuid not null references retrospectives(id) on delete cascade,
  segment_index integer not null,
  speaker_name text,
  speaker_role text,
  speaker_status text,
  voice_persona text,
  text text,
  duration_estimate_seconds integer,
  audio_url text,
  created_at timestamptz not null default now()
);

alter table retrospective_segments enable row level security;

-- Anyone can read retrospectives and their segments
create policy "Retrospectives are publicly readable"
  on retrospectives for select using (true);

create policy "Retrospective segments are publicly readable"
  on retrospective_segments for select using (true);

-- Storage bucket for audio files
insert into storage.buckets (id, name, public)
values ('retrospectives', 'retrospectives', true)
on conflict (id) do nothing;

create policy "Retrospective audio files are publicly readable"
  on storage.objects for select
  using (bucket_id = 'retrospectives');

create policy "Service role can upload retrospective audio"
  on storage.objects for insert
  with check (bucket_id = 'retrospectives');
