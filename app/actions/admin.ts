'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { TEST_PASSWORD } from '@/lib/admin-constants'

async function requireAdmin(): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/test-users')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single() as { data: { is_admin: boolean } | null; error: unknown }

  if (!profile?.is_admin) redirect('/')
}

// ── claimAdmin ────────────────────────────────────────────────────────────────

export type AdminActionState = { error: string | null }

export async function claimAdmin(
  prevState: AdminActionState,
  _formData: FormData
): Promise<AdminActionState> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()

  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin', true) as { count: number | null; error: unknown }

  if ((count ?? 0) > 0) {
    return { error: 'An admin already exists. Ask them to grant you access.' }
  }

  const { error } = await admin
    .from('profiles')
    .update({ is_admin: true } as never)
    .eq('id', user.id)

  if (error) return { error: error.message }

  redirect('/admin/test-users')
}

// ── seedTestUsers ─────────────────────────────────────────────────────────────

export type SeedState = { error: string | null; created: number; done: boolean }

export async function seedTestUsers(
  prevState: SeedState,
  _formData: FormData
): Promise<SeedState> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existingByEmail = new Map(
    (listData?.users ?? []).filter((u) => u.email).map((u) => [u.email!, u.id])
  )

  let created = 0

  for (let n = 1; n <= 10; n++) {
    const email = `testuser${n}@quorum.dev`
    const username = `testuser${n}`
    const displayName = `Test User ${n}`

    let userId: string

    if (existingByEmail.has(email)) {
      userId = existingByEmail.get(email)!
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { username, display_name: displayName },
      })
      if (error || !data.user) continue
      userId = data.user.id
      created++
    }

    await admin.from('profiles').upsert(
      {
        id: userId,
        username,
        display_name: displayName,
        merit_score: 100,
        merit_history: [],
      } as never,
      { onConflict: 'id' }
    )
  }

  return { error: null, created, done: true }
}

// ── getTestUserEmail ──────────────────────────────────────────────────────────
// Returns the email for a test user so the client can sign in with the known
// shared password. Magic-link impersonation doesn't work reliably because
// admin-generated links use implicit flow (hash fragment tokens), which
// server-side route handlers never receive.

export async function getTestUserEmail(userId: string): Promise<string | null> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data: userRecord } = await admin.auth.admin.getUserById(userId)
  return userRecord?.user?.email ?? null
}

// ── deleteCell ────────────────────────────────────────────────────────────────

export async function deleteCell(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const admin = createAdminClient()

  const cellId = formData.get('cell_id') as string
  const confirmSlug = formData.get('confirm_slug') as string
  const expectedSlug = formData.get('expected_slug') as string

  if (!cellId) return { error: 'Missing cell ID.' }
  if (confirmSlug !== expectedSlug) return { error: 'Slug confirmation does not match.' }

  // Verify cell exists
  const { data: cell } = await admin
    .from('cells')
    .select('id, slug')
    .eq('id', cellId)
    .single() as { data: { id: string; slug: string } | null; error: unknown }

  if (!cell) return { error: 'Cell not found.' }

  // Delete in FK order
  // retrospective_segments → retrospectives
  const { data: retros } = await admin
    .from('retrospectives' as never)
    .select('id')
    .eq('cell_id' as never, cellId) as { data: { id: string }[] | null; error: unknown }

  if (retros && retros.length > 0) {
    const retroIds = retros.map((r) => r.id)
    await admin
      .from('retrospective_segments' as never)
      .delete()
      .in('retrospective_id' as never, retroIds)
    await admin
      .from('retrospectives' as never)
      .delete()
      .in('id' as never, retroIds)
  }

  // promotion_records → publications
  const { data: pubs } = await admin
    .from('publications')
    .select('id')
    .eq('cell_id', cellId) as { data: { id: string }[] | null; error: unknown }

  if (pubs && pubs.length > 0) {
    const pubIds = pubs.map((p) => p.id)
    await admin.from('promotion_records').delete().in('publication_id', pubIds)
    await admin.from('publications').delete().in('id', pubIds)
  }

  await admin.from('penalty_log').delete().eq('cell_id', cellId)

  // submissions + invitations → briefs
  const { data: briefs } = await admin
    .from('briefs')
    .select('id')
    .eq('cell_id', cellId) as { data: { id: string }[] | null; error: unknown }

  if (briefs && briefs.length > 0) {
    const briefIds = briefs.map((b) => b.id)
    await admin.from('submissions').delete().in('brief_id', briefIds)
    await admin.from('invitations').delete().in('brief_id', briefIds)
    await admin.from('briefs').delete().in('id', briefIds)
  }

  await admin.from('cell_members').delete().eq('cell_id', cellId)

  // Storage cleanup: retrospectives bucket
  const { data: storageList } = await admin.storage.from('retrospectives').list(cellId)
  if (storageList && storageList.length > 0) {
    const filePaths = storageList.map((f) => `${cellId}/${f.name}`)
    await admin.storage.from('retrospectives').remove(filePaths)
  }

  // Delete cell (cascade will not fire since we already deleted children above, but safe)
  const { error: deleteErr } = await admin.from('cells').delete().eq('id', cellId)
  if (deleteErr) return { error: deleteErr.message }

  await admin.from('system_log').insert({
    event: 'admin_cell_delete',
    details: { cell_id: cellId, slug: cell.slug },
  } as never)

  redirect('/admin/cells')
}

// ── adjustMeritManually ───────────────────────────────────────────────────────

export async function adjustMeritManually(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const admin = createAdminClient()

  const userId = formData.get('user_id') as string
  const deltaStr = formData.get('delta') as string
  const reason = (formData.get('reason') as string)?.trim()

  const delta = parseInt(deltaStr, 10)
  if (!userId || isNaN(delta) || delta === 0) return { error: 'Invalid adjustment.' }
  if (!reason) return { error: 'Reason is required.' }

  const { data: profile } = await admin
    .from('profiles')
    .select('merit_score, merit_history, username')
    .eq('id', userId)
    .single() as { data: { merit_score: number; merit_history: unknown; username: string } | null; error: unknown }

  if (!profile) return { error: 'User not found.' }

  const newScore = Math.max(0, Math.min(200, (profile.merit_score ?? 100) + delta))
  const history = Array.isArray(profile.merit_history) ? profile.merit_history : []
  const newEntry = { event: 'admin_adjustment', delta, reason, ts: new Date().toISOString() }

  await admin
    .from('profiles')
    .update({ merit_score: newScore, merit_history: [...history, newEntry] } as never)
    .eq('id', userId)

  await admin.from('penalty_log').insert({
    cell_id: null,
    user_id: userId,
    reason: `Admin adjustment: ${reason}`,
    merit_delta: delta,
    auto: false,
  } as never)

  revalidatePath(`/admin/users/${profile.username}`)
  return { error: null }
}

// ── toggleAdmin ───────────────────────────────────────────────────────────────

export async function toggleAdmin(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const admin = createAdminClient()

  const userId = formData.get('user_id') as string
  const makeAdmin = formData.get('make_admin') === 'true'
  if (!userId) return { error: 'Missing user ID.' }

  const { error } = await admin
    .from('profiles')
    .update({ is_admin: makeAdmin } as never)
    .eq('id', userId)

  if (error) return { error: error.message }

  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single() as { data: { username: string } | null; error: unknown }

  revalidatePath(`/admin/users/${profile?.username ?? ''}`)
  return { error: null }
}

// ── suspendUser ───────────────────────────────────────────────────────────────

export async function suspendUser(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const admin = createAdminClient()

  const userId = formData.get('user_id') as string
  const unsuspend = formData.get('unsuspend') === 'true'
  if (!userId) return { error: 'Missing user ID.' }

  const { error } = await admin
    .from('profiles')
    .update({ suspended_at: unsuspend ? null : new Date().toISOString() } as never)
    .eq('id', userId)

  if (error) return { error: error.message }

  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single() as { data: { username: string } | null; error: unknown }

  revalidatePath(`/admin/users/${profile?.username ?? ''}`)
  return { error: null }
}

// ── deleteAccount ─────────────────────────────────────────────────────────────

export async function deleteAccount(
  prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const admin = createAdminClient()

  const userId = formData.get('user_id') as string
  const confirmUsername = formData.get('confirm_username') as string
  const expectedUsername = formData.get('expected_username') as string

  if (!userId) return { error: 'Missing user ID.' }
  if (confirmUsername !== expectedUsername) return { error: 'Username confirmation does not match.' }

  // Remove from cell_members and nullify authored content
  await admin.from('cell_members').delete().eq('user_id', userId)
  await admin
    .from('submissions')
    .update({ author_id: null } as never)
    .eq('author_id', userId)
  await admin
    .from('promotion_records')
    .update({ user_id: null } as never)
    .eq('user_id', userId)

  // Delete avatar from storage
  const { data: storageList } = await admin.storage.from('avatars').list(userId)
  if (storageList && storageList.length > 0) {
    await admin.storage.from('avatars').remove(storageList.map((f) => `${userId}/${f.name}`))
  }

  // Delete auth user (cascade deletes profile via trigger/FK)
  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr) return { error: authErr.message }

  redirect('/admin/users')
}
