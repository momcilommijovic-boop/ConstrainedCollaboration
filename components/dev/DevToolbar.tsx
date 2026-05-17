import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DevToolbarClient } from './DevToolbarClient'

type ProfileRow = { id: string; display_name: string | null; username: string }

export async function DevToolbar() {
  const isDev =
    process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEV_MODE === 'true'
  if (!isDev) return null

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Current user's display name
  let currentDisplayName = 'Not signed in'
  let currentUserId = ''
  if (user) {
    currentUserId = user.id
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .single() as { data: { display_name: string | null; username: string } | null; error: unknown }
    currentDisplayName = profile?.display_name ?? profile?.username ?? user.email ?? 'Unknown'
  }

  // Fetch seeded test users via admin client (bypass RLS, guarantees fresh list)
  const admin = createAdminClient()
  const { data: rawTestUsers } = await admin
    .from('profiles')
    .select('id, display_name, username')
    .ilike('username', 'testuser%')
    .order('username') as { data: ProfileRow[] | null; error: unknown }

  const testUsers = (rawTestUsers ?? []).map((u) => ({
    id: u.id,
    displayName: u.display_name ?? u.username,
  }))

  // Resolve the email for the current user so the toolbar can show it
  let currentEmail = ''
  if (user?.email) {
    currentEmail = user.email
  }

  return (
    <DevToolbarClient
      currentDisplayName={currentDisplayName}
      currentUserId={currentUserId}
      currentEmail={currentEmail}
      testUsers={testUsers}
    />
  )
}
