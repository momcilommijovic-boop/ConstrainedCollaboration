import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CellCard } from '@/components/cell/CellCard'
import type { EzineStrategyConfig } from '@/lib/strategies/ezine'

export const metadata = { title: 'Browse Cells — Quorum' }

type RawCell = {
  id: string
  slug: string
  title: string
  description: string | null
  strategy_id: string
  strategy_config: unknown
  status: string
  member_cap: number
  min_members: number
  stage_deadline: string | null
}

export default async function BrowseCellsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch all FORMING cells
  const { data: rawCells } = await supabase
    .from('cells')
    .select('id, slug, title, description, strategy_id, strategy_config, status, member_cap, min_members, stage_deadline')
    .eq('status', 'FORMING')
    .order('created_at', { ascending: false }) as { data: RawCell[] | null; error: unknown }

  const cells = rawCells ?? []

  // Fetch member counts in one query
  const cellIds = cells.map((c) => c.id)
  const memberCountMap: Record<string, number> = {}
  if (cellIds.length > 0) {
    const { data: memberRows } = await supabase
      .from('cell_members')
      .select('cell_id')
      .in('cell_id', cellIds)
      .eq('status', 'ACTIVE') as { data: { cell_id: string }[] | null; error: unknown }

    for (const row of memberRows ?? []) {
      memberCountMap[row.cell_id] = (memberCountMap[row.cell_id] ?? 0) + 1
    }
  }

  // Current user's display name for the header
  let userDisplayName: string | null = null
  if (user) {
    const { data: p } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .single() as { data: { display_name: string | null; username: string } | null; error: unknown }
    userDisplayName = p?.display_name ?? p?.username ?? null
  }

  // Fetch which cells the current user has already joined
  const memberCellIds = new Set<string>()
  if (user && cellIds.length > 0) {
    const { data: myMemberships } = await supabase
      .from('cell_members')
      .select('cell_id')
      .eq('user_id', user.id)
      .in('cell_id', cellIds) as { data: { cell_id: string }[] | null; error: unknown }

    for (const m of myMemberships ?? []) memberCellIds.add(m.cell_id)
  }

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <div className="flex items-center gap-6">
          {user ? (
            <>
              {userDisplayName && (
                <span className="font-mono text-xs text-olive">
                  {userDisplayName}
                </span>
              )}
              <Link
                href="/dashboard"
                className="font-mono text-xs text-olive hover:text-near-black transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/cells/new"
                className="font-mono text-xs bg-near-black text-off-white border border-near-black px-4 py-2 hover:bg-accent-red hover:border-accent-red transition-colors"
              >
                Start a Cell →
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="font-mono text-xs text-olive hover:text-near-black transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="font-mono text-xs bg-near-black text-off-white border border-near-black px-4 py-2 hover:bg-accent-red hover:border-accent-red transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 px-8 py-12 max-w-4xl">
        <div className="flex items-baseline justify-between mb-8">
          <h1 className="font-serif-display text-4xl">Open Cells</h1>
          <span className="font-mono text-xs text-olive">
            {cells.length} forming
          </span>
        </div>

        {cells.length === 0 ? (
          <div className="border border-near-black/20 px-6 py-10 text-center">
            <p className="font-body text-base text-olive mb-4">No Cells are currently forming.</p>
            {user && (
              <Link
                href="/cells/new"
                className="font-mono text-xs bg-near-black text-off-white border border-near-black px-5 py-2 hover:bg-accent-red hover:border-accent-red transition-colors"
              >
                Start the first one →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cells.map((cell) => (
              <CellCard
                key={cell.id}
                id={cell.id}
                slug={cell.slug}
                title={cell.title}
                description={cell.description}
                memberCount={memberCountMap[cell.id] ?? 0}
                memberCap={cell.member_cap}
                minMembers={cell.min_members}
                stageDeadline={cell.stage_deadline}
                strategyConfig={cell.strategy_config as EzineStrategyConfig}
                isMember={memberCellIds.has(cell.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
