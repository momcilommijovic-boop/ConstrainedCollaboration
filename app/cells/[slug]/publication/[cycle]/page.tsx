import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function PublicationPage({
  params,
}: {
  params: { slug: string; cycle: string }
}) {
  const cycle = parseInt(params.cycle, 10)
  if (isNaN(cycle)) notFound()

  const supabase = createClient()

  type CellRow = { id: string; slug: string; title: string }
  const { data: cell } = await supabase
    .from('cells')
    .select('id, slug, title')
    .eq('slug', params.slug)
    .single() as { data: CellRow | null; error: unknown }

  if (!cell) notFound()

  type PublicationRow = {
    id: string
    cycle: number
    cover_image_url: string | null
    selected_submission_ids: string[] | null
    published_at: string | null
    status: string
    brief_id: string
    assembled_by: string
  }
  const { data: publication } = await supabase
    .from('publications')
    .select(
      'id, cycle, cover_image_url, selected_submission_ids, published_at, status, brief_id, assembled_by'
    )
    .eq('cell_id', cell.id)
    .eq('cycle', cycle)
    .maybeSingle() as { data: PublicationRow | null; error: unknown }

  if (!publication) notFound()

  type BriefRow = {
    id: string
    title: string
    theme: string
    word_count_min: number
    word_count_max: number
  }
  const { data: brief } = await supabase
    .from('briefs')
    .select('id, title, theme, word_count_min, word_count_max')
    .eq('id', publication.brief_id)
    .single() as { data: BriefRow | null; error: unknown }

  // Load editor profile
  const { data: editorProfile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', publication.assembled_by)
    .single() as { data: { username: string; display_name: string | null } | null; error: unknown }

  // Load submissions in published order
  const orderedIds = publication.selected_submission_ids ?? []

  type SubmissionRow = {
    id: string
    title: string | null
    body: string | null
    word_count: number | null
    author_id: string
    profiles: { username: string; display_name: string | null } | null
  }

  let articles: (SubmissionRow & { username: string; display_name: string | null })[] = []

  if (orderedIds.length > 0) {
    const subQuery = supabase
      .from('submissions')
      .select('id, title, body, word_count, author_id, profiles(username, display_name)')
      .in('id', orderedIds) as unknown as Promise<{ data: SubmissionRow[] | null; error: unknown }>
    const { data: rawSubs } = await subQuery

    const subMap = new Map(
      (rawSubs ?? []).map((s: SubmissionRow) => [s.id, s])
    )
    articles = orderedIds
      .map((id) => subMap.get(id))
      .filter((s): s is SubmissionRow => !!s)
      .map((s: SubmissionRow) => ({
        ...s,
        username: s.profiles?.username ?? s.author_id,
        display_name: s.profiles?.display_name ?? null,
      }))
  }

  const publishedDate = publication.published_at
    ? new Date(publication.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const totalWords = articles.reduce((sum, a) => sum + (a.word_count ?? 0), 0)

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <Link
          href={`/cells/${params.slug}`}
          className="font-mono text-xs text-olive hover:text-near-black transition-colors"
        >
          ← {cell.title}
        </Link>
      </header>

      <main className="flex-1 px-8 py-12 max-w-3xl">
        {/* Cover image */}
        {publication.cover_image_url && (
          <div className="mb-10 border border-near-black/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={publication.cover_image_url}
              alt="Cover"
              className="w-full object-cover max-h-96"
            />
          </div>
        )}

        {/* Publication header */}
        <p className="font-mono text-xs uppercase tracking-widest text-olive mb-2">
          {cell.title} · Cycle {cycle}
        </p>
        <h1 className="font-serif-display text-5xl leading-tight mb-3">
          {brief?.title ?? 'Publication'}
        </h1>
        {brief?.theme && (
          <p className="font-body text-lg text-near-black/70 mb-6 leading-relaxed">
            {brief.theme}
          </p>
        )}

        <div className="border-t border-near-black/20 pt-5 mb-10">
          <div className="flex flex-wrap gap-6">
            {publishedDate && (
              <div>
                <p className="font-mono text-xs text-olive mb-0.5">Published</p>
                <p className="font-mono text-xs text-near-black">{publishedDate}</p>
              </div>
            )}
            <div>
              <p className="font-mono text-xs text-olive mb-0.5">Editor</p>
              <p className="font-mono text-xs text-near-black">
                {editorProfile?.display_name ?? editorProfile?.username ?? '—'}
              </p>
            </div>
            <div>
              <p className="font-mono text-xs text-olive mb-0.5">Articles</p>
              <p className="font-mono text-xs text-near-black">{articles.length}</p>
            </div>
            {totalWords > 0 && (
              <div>
                <p className="font-mono text-xs text-olive mb-0.5">Total words</p>
                <p className="font-mono text-xs text-near-black">{totalWords.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Table of contents */}
        {articles.length > 1 && (
          <div className="border border-near-black/20 px-6 py-5 mb-10">
            <p className="font-mono text-xs uppercase tracking-widest text-olive mb-4">
              Contents
            </p>
            <ol className="flex flex-col gap-2">
              {articles.map((article, i) => (
                <li key={article.id} className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-olive shrink-0">{i + 1}</span>
                  <a
                    href={`#article-${i + 1}`}
                    className="font-serif-display text-base hover:text-accent-red transition-colors"
                  >
                    {article.title ?? '(untitled)'}
                  </a>
                  <span className="font-mono text-xs text-olive shrink-0">
                    {article.display_name ?? article.username}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Articles */}
        {articles.length === 0 && (
          <div className="border border-near-black/20 px-6 py-6">
            <p className="font-mono text-xs text-olive">No articles in this publication.</p>
          </div>
        )}

        <div className="flex flex-col gap-16">
          {articles.map((article, i) => (
            <article key={article.id} id={`article-${i + 1}`}>
              <div className="border-t-2 border-near-black pt-8 mb-6">
                <p className="font-mono text-xs text-olive mb-2">{i + 1}</p>
                <h2 className="font-serif-display text-3xl mb-1">
                  {article.title ?? '(untitled)'}
                </h2>
                <p className="font-mono text-xs text-olive">
                  by {article.display_name ?? article.username}
                  {article.word_count != null ? ` · ${article.word_count} words` : ''}
                </p>
              </div>
              <div className="font-body text-base leading-relaxed text-near-black whitespace-pre-wrap">
                {article.body}
              </div>
            </article>
          ))}
        </div>

        {/* Footer */}
        {articles.length > 0 && (
          <div className="border-t border-near-black/20 mt-16 pt-8">
            <p className="font-mono text-xs text-olive text-center">
              {cell.title} · Issue {cycle} · {publishedDate}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
