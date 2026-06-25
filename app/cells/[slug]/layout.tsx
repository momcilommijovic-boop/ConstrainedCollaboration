import { createClient } from '@/lib/supabase/server'
import { CellNav } from '@/components/cell/CellNav'
import { DeadlineCounter } from '@/components/cell/DeadlineCounter'
import Link from 'next/link'

const STAGE_LABELS: Record<string, string> = {
  FORMING: 'Forming',
  BRIEFING: 'Briefing',
  SUBMISSION: 'Submission',
  EDITING: 'Editing',
  PROMOTION: 'Promotion',
  COMPLETE: 'Complete',
}

export default async function CellLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  type CellRow = {
    id: string
    slug: string
    title: string
    current_stage: string
    stage_deadline: string | null
    current_cycle: number
    member_cap: number
    owner_id: string
  }

  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title, current_stage, stage_deadline, current_cycle, member_cap, owner_id')
    .eq('slug', params.slug)
    .single() as { data: CellRow | null; error: unknown }

  if (!cell) return <>{children}</>

  const { data: members } = await supabase
    .from('cell_members')
    .select('user_id, role, status')
    .eq('cell_id', cell.id)
    .eq('status', 'ACTIVE') as {
    data: { user_id: string; role: string; status: string }[] | null
    error: unknown
  }

  const memberCount = (members ?? []).length
  const currentMember = (members ?? []).find((m) => m.user_id === user?.id)
  const isEditor = currentMember?.role === 'EDITOR'
  const isOwner = user?.id === cell.owner_id
  const isMember = !!currentMember

  let userDisplayName: string | null = null
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, username, is_admin')
      .eq('id', user.id)
      .single() as {
      data: { display_name: string | null; username: string; is_admin: boolean } | null
      error: unknown
    }
    userDisplayName = profile?.display_name ?? profile?.username ?? null
    isAdmin = profile?.is_admin ?? false
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-off-white">
      {/* Top bar */}
      <header className="shrink-0 h-11 border-b border-near-black/20 flex items-center">
        <div className="w-56 shrink-0 border-r border-near-black/20 px-5 h-full flex items-center">
          <Link href="/" className="font-serif-display text-base tracking-tight text-near-black">
            Quorum
          </Link>
        </div>
        <div className="flex-1 px-6 flex items-center">
          <Link
            href={`/cells/${params.slug}`}
            className="font-mono text-xs text-near-black hover:text-accent-red transition-colors"
          >
            {cell.title}
          </Link>
        </div>
        <div className="px-6 flex items-center gap-5">
          {userDisplayName && (
            <span className="font-mono text-xs text-olive">{userDisplayName}</span>
          )}
          <Link
            href="/dashboard"
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/cells"
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            Browse
          </Link>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-row flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-near-black/20 flex flex-col overflow-y-auto">
          {/* Stage */}
          <div className="px-5 py-4 border-b border-near-black/20">
            <p className="font-mono text-[10px] uppercase tracking-widest text-olive mb-1">Stage</p>
            <p className="font-serif-display text-xl leading-tight">
              {STAGE_LABELS[cell.current_stage] ?? cell.current_stage}
            </p>
            {cell.stage_deadline && (
              <div className="mt-1.5">
                <DeadlineCounter deadline={cell.stage_deadline} />
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="px-2 py-3 flex-1">
            <CellNav
              slug={params.slug}
              cycle={cell.current_cycle}
              stage={cell.current_stage}
              isMember={isMember}
              isEditor={isEditor}
              isOwner={isOwner}
              isAdmin={isAdmin}
            />
          </nav>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-near-black/20 shrink-0">
            <p className="font-mono text-[10px] text-olive">
              {memberCount}/{cell.member_cap} members
            </p>
            <p className="font-mono text-[10px] text-olive/60">Cycle {cell.current_cycle}</p>
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
