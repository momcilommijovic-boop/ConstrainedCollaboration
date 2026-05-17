import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CellSettingsForm } from '@/components/cell/CellSettingsForm'
import type { EzineStrategyConfig } from '@/lib/strategies/ezine'

export default async function CellSettingsPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/cells/${params.slug}/settings`)

  const { data: cp } = await supabase
    .from('profiles').select('display_name, username').eq('id', user.id).single() as
    { data: { display_name: string | null; username: string } | null; error: unknown }
  const userDisplayName = cp?.display_name ?? cp?.username ?? null

  type CellRow = {
    id: string
    slug: string
    title: string
    description: string | null
    owner_id: string
    current_stage: string
    member_cap: number
    min_members: number
    strategy_config: EzineStrategyConfig
  }
  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title, description, owner_id, current_stage, member_cap, min_members, strategy_config')
    .eq('slug', params.slug)
    .single() as { data: CellRow | null; error: unknown }

  if (!cell || cell.owner_id !== user.id) redirect(`/cells/${params.slug}`)
  if (cell.current_stage !== 'FORMING') redirect(`/cells/${params.slug}`)

  const { count: memberCount } = await supabase
    .from('cell_members')
    .select('id', { count: 'exact', head: true })
    .eq('cell_id', cell.id)
    .eq('status', 'ACTIVE')

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
            href={`/cells/${params.slug}`}
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            ← {cell.title}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-8 py-12 max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">Settings</p>
        <h1 className="font-serif-display text-4xl mb-2">Cell Settings</h1>
        <p className="font-mono text-xs text-olive mb-10">
          Settings can only be changed while the Cell is in the Forming stage.
        </p>

        <CellSettingsForm
          cellId={cell.id}
          title={cell.title}
          description={cell.description}
          memberCap={cell.member_cap}
          minMembers={cell.min_members}
          currentMemberCount={memberCount ?? 0}
          config={cell.strategy_config}
        />
      </main>
    </div>
  )
}
