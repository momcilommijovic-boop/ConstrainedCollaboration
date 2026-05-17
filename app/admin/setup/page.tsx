import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ClaimAdminForm } from '@/components/admin/ClaimAdminForm'
import { SignOutButton } from '@/components/admin/SignOutButton'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = { title: 'Admin Setup — Quorum' }

export default async function AdminSetupPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/setup')

  const admin = createAdminClient()
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin', true) as { count: number | null; error: unknown }

  const adminExists = (count ?? 0) > 0

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, display_name, username')
    .eq('id', user.id)
    .single() as { data: { is_admin: boolean; display_name: string | null; username: string } | null; error: unknown }

  if (profile?.is_admin) redirect('/admin/test-users')

  const displayName = profile?.display_name ?? profile?.username ?? user.email

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <div className="flex items-center gap-6">
          <span className="font-mono text-xs text-olive">
            Signed in as <span className="text-near-black">{displayName}</span>
          </span>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-8 py-12 max-w-lg">
        <h1 className="font-serif-display text-4xl mb-2">Admin Setup</h1>
        <p className="font-mono text-xs text-olive mb-10">
          One-time claim — only works if no admin exists yet.
        </p>

        {adminExists ? (
          <div className="border border-near-black/20 px-6 py-6 flex flex-col gap-4">
            <p className="font-mono text-xs text-olive">
              An admin account already exists. This account ({displayName}) is not an admin.
            </p>
            <p className="font-mono text-xs text-near-black/50">
              If you are testing via impersonation, sign out below to return to your own account.
            </p>
            <SignOutButton label="Sign out and return →" />
          </div>
        ) : (
          <ClaimAdminForm />
        )}
      </main>
    </div>
  )
}
