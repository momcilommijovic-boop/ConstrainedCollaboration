'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
