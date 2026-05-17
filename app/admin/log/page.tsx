import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const metadata = { title: 'System Log — Quorum Admin' }

const PAGE_SIZE = 50

type LogRow = {
  id: string
  event_type: string
  cell_id: string | null
  user_id: string | null
  payload: unknown
  error: string | null
  created_at: string
  cells: { slug: string; title: string } | null
  profiles: { username: string } | null
}

export default async function AdminLogPage({
  searchParams,
}: {
  searchParams: { page?: string; event?: string; errors?: string }
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/log')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single() as { data: { is_admin: boolean } | null; error: unknown }

  if (!profile?.is_admin) redirect('/')

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10))
  const eventFilter = searchParams.event ?? ''
  const errorsOnly = searchParams.errors === '1'

  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('system_log')
    .select('id, event_type, cell_id, user_id, payload, error, created_at, cells(slug, title), profiles(username)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (eventFilter) {
    query = query.eq('event_type', eventFilter)
  }
  if (errorsOnly) {
    query = query.not('error', 'is', null)
  }

  const logQuery = query as unknown as Promise<{
    data: LogRow[] | null
    count: number | null
    error: unknown
  }>
  const { data: logs, count } = await logQuery

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  // Load distinct event types for the filter dropdown
  const eventTypesQuery = supabase
    .from('system_log')
    .select('event_type') as unknown as Promise<{
    data: { event_type: string }[] | null
    error: unknown
  }>
  const { data: rawEventTypes } = await eventTypesQuery
  const seen = new Set<string>()
  const eventTypes: string[] = []
  for (const r of rawEventTypes ?? []) {
    if (!seen.has(r.event_type)) { seen.add(r.event_type); eventTypes.push(r.event_type) }
  }
  eventTypes.sort()

  function buildUrl(params: Record<string, string | undefined>) {
    const base: Record<string, string> = {}
    if (eventFilter) base.event = eventFilter
    if (errorsOnly) base.errors = '1'
    if (page > 1) base.page = String(page)
    Object.assign(base, params)
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined && v !== ''))
    ).toString()
    return `/admin/log${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <div className="flex items-center gap-6">
          <span className="font-mono text-xs text-accent-red uppercase tracking-widest">Admin</span>
          <Link
            href="/admin/test-users"
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            Test Users
          </Link>
          <Link
            href="/dashboard"
            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="flex-1 px-8 py-12 max-w-6xl">
        <div className="mb-8">
          <h1 className="font-serif-display text-4xl mb-1">System Log</h1>
          <p className="font-mono text-xs text-olive">
            Automated event log · {count ?? 0} entries
          </p>
        </div>

        {/* Filters */}
        <div className="border border-near-black/20 px-5 py-4 mb-6 flex items-center gap-6 flex-wrap">
          <p className="font-mono text-xs text-olive uppercase tracking-widest">Filter</p>

          <div className="flex items-center gap-2">
            <label className="font-mono text-xs text-olive" htmlFor="event-filter">
              Event
            </label>
            <form method="get" action="/admin/log">
              {errorsOnly && <input type="hidden" name="errors" value="1" />}
              <select
                id="event-filter"
                name="event"
                defaultValue={eventFilter}
                className="font-mono text-xs border border-near-black/20 bg-off-white px-2 py-1 text-near-black"
              >
                <option value="">All events</option>
                {eventTypes.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="ml-2 font-mono text-xs border border-near-black px-3 py-1 hover:bg-near-black hover:text-off-white transition-colors"
              >
                Apply
              </button>
            </form>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={buildUrl({ errors: errorsOnly ? undefined : '1', page: '1' })}
              className={`font-mono text-xs border px-3 py-1 transition-colors ${
                errorsOnly
                  ? 'border-accent-red text-accent-red'
                  : 'border-near-black/20 text-olive hover:border-near-black hover:text-near-black'
              }`}
            >
              Errors only
            </Link>

            {(eventFilter || errorsOnly) && (
              <Link
                href="/admin/log"
                className="font-mono text-xs text-olive hover:text-near-black transition-colors"
              >
                Clear filters ×
              </Link>
            )}
          </div>
        </div>

        {/* Log table */}
        {!logs || logs.length === 0 ? (
          <div className="border border-near-black/20 px-6 py-8">
            <p className="font-mono text-xs text-olive">No log entries match your filters.</p>
          </div>
        ) : (
          <div className="border border-near-black/20 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-near-black/20 bg-near-black/[0.02]">
                  <th className="text-left font-mono text-xs text-olive uppercase tracking-widest px-4 py-2 whitespace-nowrap">
                    Timestamp
                  </th>
                  <th className="text-left font-mono text-xs text-olive uppercase tracking-widest px-4 py-2 whitespace-nowrap">
                    Event
                  </th>
                  <th className="text-left font-mono text-xs text-olive uppercase tracking-widest px-4 py-2">
                    Cell
                  </th>
                  <th className="text-left font-mono text-xs text-olive uppercase tracking-widest px-4 py-2">
                    User
                  </th>
                  <th className="text-left font-mono text-xs text-olive uppercase tracking-widest px-4 py-2">
                    Payload / Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row, i) => {
                  const isLast = i === logs.length - 1
                  const hasError = !!row.error
                  return (
                    <tr
                      key={row.id}
                      className={`${!isLast ? 'border-b border-near-black/10' : ''} ${
                        hasError ? 'bg-accent-red/5' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="font-mono text-xs text-olive">
                          {new Date(row.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Link
                          href={buildUrl({ event: row.event_type, page: '1' })}
                          className={`font-mono text-xs hover:underline ${
                            hasError ? 'text-accent-red' : 'text-near-black'
                          }`}
                        >
                          {row.event_type}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.cells ? (
                          <Link
                            href={`/cells/${row.cells.slug}`}
                            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
                          >
                            {row.cells.title}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-near-black/20">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.profiles ? (
                          <Link
                            href={`/profile/${row.profiles.username}`}
                            className="font-mono text-xs text-olive hover:text-near-black transition-colors"
                          >
                            @{row.profiles.username}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-near-black/20">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 max-w-xs">
                        {hasError && (
                          <p className="font-mono text-xs text-accent-red mb-1 break-words">
                            {row.error}
                          </p>
                        )}
                        {row.payload !== null && row.payload !== undefined && (
                          <p className="font-mono text-xs text-olive/70 break-words whitespace-pre-wrap truncate max-w-[320px]">
                            {JSON.stringify(row.payload)}
                          </p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center gap-3">
            {page > 1 && (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="font-mono text-xs border border-near-black px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors"
              >
                ← Prev
              </Link>
            )}
            <span className="font-mono text-xs text-olive">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="font-mono text-xs border border-near-black px-4 py-2 hover:bg-near-black hover:text-off-white transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
