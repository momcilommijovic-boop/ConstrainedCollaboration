-- ============================================================
-- Migration 006: Allow invitees to promote own role to WRITER
--
-- The invitation acceptance flow sets invitation.status = 'ACCEPTED'
-- and then needs to update cell_members.role from 'MEMBER' to 'WRITER'.
-- No UPDATE policy existed on cell_members for regular users.
--
-- Policy constraints:
--   USING:      user can only update their own row AND current role is MEMBER
--   WITH CHECK: new role must be WRITER AND an ACCEPTED invitation exists
--               for this user in this cell (prevents arbitrary role changes)
-- ============================================================

create policy "Invitee can set own role to WRITER on accepted invitation"
  on cell_members for update
  using (auth.uid() = user_id and role = 'MEMBER')
  with check (
    auth.uid() = user_id
    and role = 'WRITER'
    and exists (
      select 1
      from invitations i
      join briefs b on b.id = i.brief_id
      where i.invitee_id = auth.uid()
        and b.cell_id = cell_members.cell_id
        and i.status = 'ACCEPTED'
    )
  );
