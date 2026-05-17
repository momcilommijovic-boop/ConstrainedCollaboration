-- ============================================================
-- Migration 004: Fix RLS policies to allow Server-Action-driven
--                stage transitions by cell owner and editor.
--
-- The original cells UPDATE policy restricted updates to the
-- FORMING stage only, with no explicit WITH CHECK — so PostgreSQL
-- defaulted WITH CHECK to the same predicate, blocking any update
-- that changed current_stage away from 'FORMING'.
--
-- All Server Actions validate ownership / role / stage before
-- writing, so the RLS here is defence-in-depth only.
-- ============================================================

-- ── cells ────────────────────────────────────────────────────────────────────

drop policy if exists "Cell owner can update cell (FORMING stage only)" on cells;

create policy "Cell owner or editor can update cell"
  on cells for update
  using  (auth.uid() = owner_id or is_cell_editor(id))
  with check (auth.uid() = owner_id or is_cell_editor(id));

-- ── cell_members ─────────────────────────────────────────────────────────────
-- The original migration had no UPDATE policy for cell_members (only service
-- role was expected to do this). Server Actions also need to assign the EDITOR
-- role during triggerBriefing, so allow the cell owner to update member rows.

create policy "Cell owner can update member records"
  on cell_members for update
  using (is_cell_owner(cell_id));
