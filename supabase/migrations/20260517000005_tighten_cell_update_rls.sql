-- ============================================================
-- Migration 005: Tighten cells UPDATE RLS to enforce editor-only
--                access for stage-advancing writes.
--
-- Previous policy: owner OR editor can update in any stage.
-- New policies split by stage:
--   • FORMING + PROMOTION  → owner only
--     (FORMING: settings edits + triggering briefing)
--     (PROMOTION: owner closes cycle via advanceToComplete)
--   • BRIEFING + SUBMISSION + EDITING → editor only
--     (these are the active editorial stage advances)
--
-- Automated transitions (pg_cron / Edge Functions) run under
-- the service role which bypasses RLS entirely.
-- ============================================================

drop policy if exists "Cell owner or editor can update cell" on cells;

-- Owner can update cells only in stages they legitimately control
create policy "Cell owner can update cell (owner stages)"
  on cells for update
  using  (auth.uid() = owner_id and current_stage in ('FORMING', 'PROMOTION'))
  with check (auth.uid() = owner_id);

-- Editor can update cells only in active editorial stages
create policy "Cell editor can update cell (editor stages)"
  on cells for update
  using  (is_cell_editor(id) and current_stage in ('BRIEFING', 'SUBMISSION', 'EDITING'))
  with check (is_cell_editor(id));
