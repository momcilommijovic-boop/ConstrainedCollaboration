import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ImpersonateButton } from '@/components/admin/ImpersonateButton'
import { SeedUsersForm } from '@/components/admin/SeedUsersForm'
import { SignOutButton } from '@/components/admin/SignOutButton'
import { TEST_PASSWORD } from '@/lib/admin-constants'

export const metadata = { title: 'Test Users — Quorum Admin' }

type TestUser = {
  userId: string
  email: string
  username: string
  displayName: string
  meritScore: number
  activeCells: number
}

export default async function TestUsersPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/test-users')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, display_name, username')
    .eq('id', user.id)
    .single() as { data: { is_admin: boolean; display_name: string | null; username: string } | null; error: unknown }

  if (!profile?.is_admin) redirect('/admin/setup')

  const admin = createAdminClient()

  // Load all auth users, filter to testuser*@quorum.dev
  const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const testAuthUsers = (listData?.users ?? []).filter((u) =>
    /^testuser\d+@quorum\.dev$/.test(u.email ?? '')
  )

  const testUserIds = testAuthUsers.map((u) => u.id)

  // Load profiles + active cell membership counts in parallel
  const [profilesResult, membershipsResult] = await Promise.all([
    admin
      .from('profiles')
      .select('id, username, display_name, merit_score')
      .in('id', testUserIds.length > 0 ? testUserIds : ['00000000-0000-0000-0000-000000000000']),
    admin
      .from('cell_members')
      .select('user_id')
      .in('user_id', testUserIds.length > 0 ? testUserIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'ACTIVE'),
  ])

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  )
  const cellCountMap = new Map<string, number>()
  for (const m of membershipsResult.data ?? []) {
    cellCountMap.set(m.user_id, (cellCountMap.get(m.user_id) ?? 0) + 1)
  }

  // Build sorted list (testuser1 first)
  const testUsers: TestUser[] = testAuthUsers
    .map((authUser) => {
      const p = profileMap.get(authUser.id)
      return {
        userId: authUser.id,
        email: authUser.email ?? '',
        username: p?.username ?? '—',
        displayName: p?.display_name ?? '—',
        meritScore: p?.merit_score ?? 0,
        activeCells: cellCountMap.get(authUser.id) ?? 0,
      }
    })
    .sort((a, b) => a.email.localeCompare(b.email))

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <div className="flex items-center gap-6">
          <span className="font-mono text-xs text-accent-red uppercase tracking-widest">Admin</span>
          <Link
            href="/admin/users"
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            Users
          </Link>
          <Link
            href="/admin/cells"
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            Cells
          </Link>
          <Link
            href="/admin/log"
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            System Log
          </Link>
          <span className="font-mono text-xs text-olive">
            Signed in as{' '}
            <span className="text-near-black font-mono">
              {profile?.display_name ?? profile?.username ?? user.email}
            </span>
          </span>
          <Link
            href="/dashboard"
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            Dashboard
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-8 py-12 max-w-5xl">
        <div className="mb-8">
          <h1 className="font-serif-display text-4xl mb-1">Test Users</h1>
          <p className="font-mono text-xs text-olive">
            Seed and impersonate test accounts for end-to-end flow testing.
          </p>
        </div>

        {/* Credentials panel */}
        <div className="border border-near-black/20 px-5 py-4 mb-6 flex flex-col gap-1">
          <p className="font-mono text-xs text-olive uppercase tracking-widest mb-1">Credentials</p>
          <p className="font-mono text-xs text-near-black">
            Email pattern: <span className="text-accent-red">testuser1@quorum.dev</span> …{' '}
            <span className="text-accent-red">testuser10@quorum.dev</span>
          </p>
          <p className="font-mono text-xs text-near-black">
            Password: <span className="text-accent-red">{TEST_PASSWORD}</span>
          </p>
          <p className="font-mono text-xs text-olive mt-1">
            Impersonating opens a magic link — you are signed in as that user in the same tab.
            Return here by logging back in as yourself.
          </p>
        </div>

        {/* Seed action */}
        <div className="border border-near-black/20 px-5 py-4 mb-8">
          <p className="font-mono text-xs text-olive uppercase tracking-widest mb-3">Actions</p>
          <SeedUsersForm />
        </div>

        {/* User table */}
        {testUsers.length === 0 ? (
          <div className="border border-near-black/20 px-6 py-8">
            <p className="font-mono text-xs text-olive">
              No test users found. Click &ldquo;Seed / Refresh Test Users&rdquo; above to create them.
            </p>
          </div>
        ) : (
          <div className="border border-near-black/20 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-near-black/20 bg-near-black/[0.02]">
                  <th className="text-left font-mono text-xs text-olive uppercase tracking-widest px-4 py-2">
                    Email
                  </th>
                  <th className="text-left font-mono text-xs text-olive uppercase tracking-widest px-4 py-2">
                    Username
                  </th>
                  <th className="text-left font-mono text-xs text-olive uppercase tracking-widest px-4 py-2">
                    Display name
                  </th>
                  <th className="text-right font-mono text-xs text-olive uppercase tracking-widest px-4 py-2">
                    Merit
                  </th>
                  <th className="text-right font-mono text-xs text-olive uppercase tracking-widest px-4 py-2">
                    Cells
                  </th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {testUsers.map((u, i) => (
                  <tr
                    key={u.userId}
                    className={i < testUsers.length - 1 ? 'border-b border-near-black/10' : ''}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-near-black">{u.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      {u.username !== '—' ? (
                        <Link
                          href={`/profile/${u.username}`}
                          className="font-mono text-xs text-olive hover:text-near-black transition-colors"
                        >
                          @{u.username}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-near-black/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-body text-sm text-near-black">{u.displayName}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-xs text-near-black">{u.meritScore}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-xs text-olive">{u.activeCells}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ImpersonateButton userId={u.userId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
