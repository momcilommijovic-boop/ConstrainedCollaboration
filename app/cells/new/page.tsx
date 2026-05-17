import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CreateCellForm } from './CreateCellForm'

export const metadata = { title: 'New Cell — Quorum' }

export default async function NewCellPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/cells/new')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', user.id)
    .single() as { data: { display_name: string | null; username: string } | null; error: unknown }
  const userDisplayName = profile?.display_name ?? profile?.username ?? null

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <div className="flex items-center gap-6">
          {userDisplayName && (
            <span className="font-mono text-xs text-olive">{userDisplayName}</span>
          )}
          <Link
            href="/dashboard"
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="flex-1 px-8 py-12 max-w-2xl">
        <div className="mb-10">
          <h1 className="font-serif-display text-4xl mb-2">Start a Cell</h1>
          <p className="font-mono text-xs text-olive">
            Strategy:{' '}
            <span className="text-near-black">E-Zine (EZINE_V1)</span>
            {' '}— the only available strategy.
          </p>
        </div>

        <CreateCellForm />
      </main>
    </div>
  )
}
