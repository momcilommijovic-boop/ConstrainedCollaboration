-- ============================================================
-- Migration 002: Row-Level Security policies
-- ============================================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table strategy_templates enable row level security;
alter table cells enable row level security;
alter table cell_members enable row level security;
alter table briefs enable row level security;
alter table invitations enable row level security;
alter table submissions enable row level security;
alter table publications enable row level security;
alter table promotion_records enable row level security;
alter table penalty_log enable row level security;
alter table system_log enable row level security;

-- ============================================================
-- Helper functions
-- ============================================================

-- Is the current user a member of a cell?
create or replace function is_cell_member(p_cell_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from cell_members
    where cell_id = p_cell_id
      and user_id = auth.uid()
      and status = 'ACTIVE'
  )
$$;

-- Is the current user the editor of a cell for the current cycle?
create or replace function is_cell_editor(p_cell_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from cell_members
    where cell_id = p_cell_id
      and user_id = auth.uid()
      and role = 'EDITOR'
      and status = 'ACTIVE'
  )
$$;

-- Is the current user the owner of a cell?
create or replace function is_cell_owner(p_cell_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from cells
    where id = p_cell_id
      and owner_id = auth.uid()
  )
$$;

-- Is the current user an admin?
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and is_admin = true
  )
$$;

-- ============================================================
-- profiles
-- ============================================================
create policy "Profiles are publicly readable"
  on profiles for select using (true);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- profiles are created by the trigger (security definer), not by users directly

-- ============================================================
-- strategy_templates
-- ============================================================
create policy "Strategy templates are publicly readable"
  on strategy_templates for select using (true);

create policy "Only admins can modify strategy templates"
  on strategy_templates for all using (is_admin());

-- ============================================================
-- cells
-- ============================================================
create policy "Cells are publicly readable"
  on cells for select using (true);

create policy "Authenticated users can create cells"
  on cells for insert with check (auth.uid() is not null and auth.uid() = owner_id);

create policy "Cell owner can update cell (FORMING stage only)"
  on cells for update using (
    auth.uid() = owner_id and current_stage = 'FORMING'
  );

-- Stage transitions are performed by service role (Edge Functions) — no policy needed for service role

-- ============================================================
-- cell_members
-- ============================================================
create policy "Cell members list is readable by cell members and public"
  on cell_members for select using (true);

create policy "Authenticated users can join cells"
  on cell_members for insert with check (
    auth.uid() is not null
    and auth.uid() = user_id
    -- merit check handled in Server Action
  );

-- Kicks/role changes done by service role only

-- ============================================================
-- briefs
-- ============================================================
create policy "Briefs readable by cell members; summary readable by all"
  on briefs for select using (
    is_cell_member(cell_id) or true  -- public read for now; restrict to members if needed
  );

create policy "Only cell editor can insert brief"
  on briefs for insert with check (is_cell_editor(cell_id) and auth.uid() = editor_id);

create policy "Only cell editor can update brief"
  on briefs for update using (is_cell_editor(cell_id) and auth.uid() = editor_id);

-- ============================================================
-- invitations
-- ============================================================
create policy "Members can read their own invitations"
  on invitations for select using (
    auth.uid() = invitee_id or is_cell_editor(cell_id)
  );

create policy "Only cell editor can create invitations"
  on invitations for insert with check (is_cell_editor(cell_id));

create policy "Invitee can update (accept/decline) their invitation"
  on invitations for update using (auth.uid() = invitee_id);

-- ============================================================
-- submissions
-- ============================================================
create policy "Editor and author can read submissions"
  on submissions for select using (
    auth.uid() = author_id or is_cell_editor(cell_id)
  );

create policy "Invited writer can insert submission"
  on submissions for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from invitations
      where brief_id = submissions.brief_id
        and invitee_id = auth.uid()
        and status = 'ACCEPTED'
    )
  );

create policy "Author can update draft submission; editor can update status"
  on submissions for update using (
    (auth.uid() = author_id and status in ('DRAFT','REWORK_REQUESTED'))
    or is_cell_editor(cell_id)
  );

-- ============================================================
-- publications
-- ============================================================
create policy "Published publications are publicly readable"
  on publications for select using (
    status in ('PUBLISHED','PROMOTION_OPEN','ARCHIVED') or is_cell_member(cell_id)
  );

create policy "Editor can create/update publication"
  on publications for insert with check (is_cell_editor(cell_id) and auth.uid() = assembled_by);

create policy "Editor can update publication"
  on publications for update using (is_cell_editor(cell_id) and auth.uid() = assembled_by);

-- ============================================================
-- promotion_records
-- ============================================================
create policy "Cell members can read promotion records"
  on promotion_records for select using (is_cell_member(
    (select cell_id from publications where id = publication_id)
  ));

create policy "Active members can submit promotion evidence"
  on promotion_records for insert with check (
    auth.uid() = user_id
    and is_cell_member(
      (select cell_id from publications where id = publication_id)
    )
  );

create policy "Users can update their own promotion record"
  on promotion_records for update using (auth.uid() = user_id);

-- ============================================================
-- penalty_log
-- ============================================================
create policy "Cell members can view penalty log for their cell"
  on penalty_log for select using (is_cell_member(cell_id) or auth.uid() = user_id);

-- Inserts performed only by service role (no insert policy for authenticated users)

-- ============================================================
-- system_log
-- ============================================================
create policy "Admins can view system log"
  on system_log for select using (is_admin());

-- Inserts performed only by service role
