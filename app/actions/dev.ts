'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TEST_PASSWORD } from '@/lib/admin-constants'

export async function switchToTestUser(userId: string): Promise<{ error: string | null }> {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEV_MODE !== 'true') {
    return { error: 'Not available in production.' }
  }

  const admin = createAdminClient()
  const { data: userRecord } = await admin.auth.admin.getUserById(userId)
  const email = userRecord?.user?.email
  if (!email) return { error: 'User not found.' }

  // Only allow switching to test accounts
  if (!email.endsWith('@quorum.dev')) return { error: 'Not a test user.' }

  const supabase = createClient()

  // Sign out the current session completely before establishing a new one.
  // Without this, old auth cookies linger and the middleware re-validates
  // the previous user's token on the next request, breaking session isolation.
  await supabase.auth.signOut()

  const { error } = await supabase.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  if (error) return { error: error.message }

  return { error: null }
}
