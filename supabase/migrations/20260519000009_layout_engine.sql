-- ============================================================
-- Migration 009: Layout Engine — design tokens, layouts, media
-- ============================================================

create table cell_design_tokens (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid references cells(id) on delete cascade unique,
  inspiration_sources jsonb default '[]',
  tokens jsonb not null,
  generated_at timestamptz default now(),
  generated_by uuid references profiles(id),
  manually_edited boolean default false
);

create table publication_layouts (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references publications(id) on delete cascade unique,
  cell_id uuid references cells(id),
  cycle integer not null,
  pages jsonb not null default '[]',
  design_token_id uuid references cell_design_tokens(id),
  status text default 'DRAFT',
  last_edited_at timestamptz default now(),
  last_edited_by uuid references profiles(id)
);

create table publication_media (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid references cells(id),
  cycle integer not null,
  uploader_id uuid references profiles(id),
  filename text,
  storage_url text not null,
  width integer,
  height integer,
  alt_text text,
  focal_point_x float default 0.5,
  focal_point_y float default 0.5,
  uploaded_at timestamptz default now()
);

-- Enable RLS
alter table cell_design_tokens enable row level security;
alter table publication_layouts enable row level security;
alter table publication_media enable row level security;

-- Design tokens RLS
create policy "design_tokens_read"
  on cell_design_tokens for select using (true);

create policy "design_tokens_insert"
  on cell_design_tokens for insert
  with check (
    exists (select 1 from cells where id = cell_id and owner_id = auth.uid())
    or exists (select 1 from cell_members where cell_id = cell_design_tokens.cell_id and user_id = auth.uid() and role = 'EDITOR' and status = 'ACTIVE')
  );

create policy "design_tokens_update"
  on cell_design_tokens for update
  using (
    exists (select 1 from cells where id = cell_id and owner_id = auth.uid())
    or exists (select 1 from cell_members where cell_id = cell_design_tokens.cell_id and user_id = auth.uid() and role = 'EDITOR' and status = 'ACTIVE')
  );

-- Publication layouts RLS
create policy "layouts_read"
  on publication_layouts for select using (
    status = 'PUBLISHED'
    or exists (select 1 from cell_members where cell_id = publication_layouts.cell_id and user_id = auth.uid())
    or is_admin()
  );

create policy "layouts_insert"
  on publication_layouts for insert
  with check (
    exists (select 1 from cell_members where cell_id = publication_layouts.cell_id and user_id = auth.uid() and role = 'EDITOR' and status = 'ACTIVE')
  );

create policy "layouts_update"
  on publication_layouts for update
  using (
    exists (select 1 from cell_members where cell_id = publication_layouts.cell_id and user_id = auth.uid() and role = 'EDITOR' and status = 'ACTIVE')
    or is_admin()
  );

-- Media RLS
create policy "media_read"
  on publication_media for select using (true);

create policy "media_insert"
  on publication_media for insert
  with check (
    exists (select 1 from cell_members where cell_id = publication_media.cell_id and user_id = auth.uid() and status = 'ACTIVE')
  );

-- Storage buckets
insert into storage.buckets (id, name, public)
values
  ('publications', 'publications', true),
  ('design-analysis', 'design-analysis', false)
on conflict (id) do nothing;

-- publications bucket: public read, members upload
create policy "publications_media_read"
  on storage.objects for select
  using (bucket_id = 'publications');

create policy "publications_media_insert"
  on storage.objects for insert
  with check (bucket_id = 'publications' and auth.uid() is not null);

-- design-analysis bucket: admin-managed (uploaded via service role in action)
create policy "design_analysis_read"
  on storage.objects for select
  using (bucket_id = 'design-analysis' and auth.uid() is not null);
