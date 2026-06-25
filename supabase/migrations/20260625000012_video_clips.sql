-- ============================================================
-- Migration 012: Video clips + YouTube URL on publications
-- ============================================================

-- Storage bucket for member video clips (private, 100MB max, video types only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'video-clips',
  'video-clips',
  false,
  104857600,
  array['video/mp4', 'video/quicktime', 'video/webm']
) on conflict (id) do nothing;

-- Storage RLS: members can upload to their own folder ({cell_id}/{user_id}/...)
create policy "Members can upload their own clips"
  on storage.objects for insert
  with check (
    bucket_id = 'video-clips'
    and auth.uid() is not null
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ============================================================
-- video_clips
-- ============================================================
create table if not exists video_clips (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid references cells(id) on delete cascade not null,
  brief_id uuid references briefs(id) on delete cascade,
  user_id uuid references profiles(id) not null,
  cycle integer not null default 1,
  storage_path text not null,
  file_name text,
  file_size_bytes bigint,
  status text not null default 'PENDING',   -- PENDING | APPROVED | REJECTED
  editor_note text,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique(cell_id, user_id, cycle)           -- one clip per member per cycle
);

alter table video_clips enable row level security;

-- Members can insert their own clips
create policy "Members can insert their own clips"
  on video_clips for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from cell_members
      where cell_members.cell_id = video_clips.cell_id
        and cell_members.user_id = auth.uid()
        and cell_members.status = 'ACTIVE'
    )
  );

-- Members can read clips in cells they belong to
create policy "Members can read clips in their cells"
  on video_clips for select
  using (
    exists (
      select 1 from cell_members
      where cell_members.cell_id = video_clips.cell_id
        and cell_members.user_id = auth.uid()
    )
  );

-- Editor can update (approve/reject) clips
create policy "Editor can update clips"
  on video_clips for update
  using (
    exists (
      select 1 from cell_members
      where cell_members.cell_id = video_clips.cell_id
        and cell_members.user_id = auth.uid()
        and cell_members.role = 'EDITOR'
    )
  );

-- ============================================================
-- Add youtube_url to publications
-- ============================================================
alter table publications add column if not exists youtube_url text;
