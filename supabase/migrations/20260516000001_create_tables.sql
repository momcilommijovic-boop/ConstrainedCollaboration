-- ============================================================
-- Migration 001: Create all core tables
-- ============================================================

-- Enable pg_cron and http extensions (must be done in Dashboard UI or here)
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

-- ============================================================
-- profiles
-- ============================================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  merit_score integer not null default 100,
  merit_history jsonb not null default '[]',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- strategy_templates
-- ============================================================
create table if not exists strategy_templates (
  id text primary key,
  name text not null,
  description text,
  default_config jsonb not null,
  schema jsonb
);

-- ============================================================
-- cells
-- ============================================================
create table if not exists cells (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  strategy_id text not null references strategy_templates(id),
  strategy_config jsonb not null,
  status text not null default 'FORMING'
    check (status in ('FORMING', 'ACTIVE', 'COMPLETE', 'ABANDONED')),
  owner_id uuid not null references profiles(id),
  current_stage text not null default 'FORMING'
    check (current_stage in ('FORMING','BRIEFING','SUBMISSION','EDITING','PUBLICATION','PROMOTION','COMPLETE')),
  stage_deadline timestamptz,
  member_cap integer not null default 8,
  min_members integer not null default 4,
  current_cycle integer not null default 1,
  is_recurring boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- cell_members
-- ============================================================
create table if not exists cell_members (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references cells(id) on delete cascade,
  user_id uuid not null references profiles(id),
  role text not null default 'MEMBER'
    check (role in ('MEMBER','EDITOR','WRITER','ILLUSTRATOR')),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','WARNED','SUSPENDED','KICKED')),
  joined_at timestamptz not null default now(),
  unique(cell_id, user_id)
);

-- ============================================================
-- briefs
-- ============================================================
create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references cells(id) on delete cascade,
  cycle integer not null default 1,
  editor_id uuid not null references profiles(id),
  title text not null,
  theme text not null,
  guidance text not null,
  word_count_min integer not null default 400,
  word_count_max integer not null default 1200,
  slots integer not null,
  published_at timestamptz not null default now(),
  deadline timestamptz not null
);

-- ============================================================
-- invitations
-- ============================================================
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references briefs(id) on delete cascade,
  cell_id uuid not null references cells(id),
  invitee_id uuid not null references profiles(id),
  status text not null default 'PENDING'
    check (status in ('PENDING','ACCEPTED','DECLINED','EXPIRED')),
  sent_at timestamptz not null default now(),
  responded_at timestamptz
);

-- ============================================================
-- submissions
-- ============================================================
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references briefs(id) on delete cascade,
  cell_id uuid not null references cells(id),
  author_id uuid not null references profiles(id),
  title text,
  body text,
  word_count integer,
  file_url text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','SUBMITTED','ACCEPTED','REJECTED','REWORK_REQUESTED')),
  editor_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  cycle integer not null default 1
);

-- ============================================================
-- publications
-- ============================================================
create table if not exists publications (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references cells(id),
  cycle integer not null,
  brief_id uuid not null references briefs(id),
  cover_image_url text,
  selected_submission_ids uuid[] not null default '{}',
  assembled_by uuid not null references profiles(id),
  published_at timestamptz,
  promotion_deadline timestamptz,
  status text not null default 'ASSEMBLING'
    check (status in ('ASSEMBLING','PUBLISHED','PROMOTION_OPEN','ARCHIVED'))
);

-- ============================================================
-- promotion_records
-- ============================================================
create table if not exists promotion_records (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references publications(id),
  user_id uuid not null references profiles(id),
  evidence_url text,
  submitted_at timestamptz,
  status text not null default 'PENDING'
    check (status in ('PENDING','VERIFIED','MISSED'))
);

-- ============================================================
-- penalty_log
-- ============================================================
create table if not exists penalty_log (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references cells(id),
  user_id uuid not null references profiles(id),
  reason text not null,
  merit_delta integer not null,
  stage text,
  cycle integer,
  auto boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- system_log (for failed automated actions)
-- ============================================================
create table if not exists system_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  cell_id uuid references cells(id),
  user_id uuid references profiles(id),
  payload jsonb,
  error text,
  created_at timestamptz not null default now()
);
