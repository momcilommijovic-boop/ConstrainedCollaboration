-- ============================================================
-- Migration 008: Profile extensions, admin cell delete, avatars
-- ============================================================

-- Additional profile columns
alter table profiles
  add column if not exists location text,
  add column if not exists platforms jsonb default '[]',
  add column if not exists suspended_at timestamptz;

-- Admins can delete cells (FK cascade handles children)
create policy "Admins can delete cells"
  on cells for delete using (is_admin());

-- ── Avatars storage bucket ────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
