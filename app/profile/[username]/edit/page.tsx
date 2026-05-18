import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ProfileEditForm } from '@/components/profile/ProfileEditForm'
import type { Platform } from '@/lib/profile'

export default async function ProfileEditPage({
  params,
}: {
  params: { username: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/profile/${params.username}/edit`)

  type ProfileRow = {
    id: string
    username: string
    display_name: string | null
    bio: string | null
    avatar_url: string | null
    location: string | null
    platforms: unknown
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, location, platforms')
    .eq('username', params.username)
    .single() as { data: ProfileRow | null; error: unknown }

  if (!profile) notFound()
  if (profile.id !== user.id) redirect(`/profile/${params.username}`)

  const platforms: Platform[] = Array.isArray(profile.platforms)
    ? (profile.platforms as Platform[])
    : []

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl tracking-tight">
          Quorum
        </Link>
        <Link
          href={`/profile/${profile.username}`}
          className="font-mono text-xs text-olive hover:text-near-black transition-colors"
        >
          ← Back to profile
        </Link>
      </header>

      <main className="flex-1 px-8 py-12 max-w-xl">
        <h1 className="font-serif-display text-3xl mb-8">Edit Profile</h1>
        <ProfileEditForm
          username={profile.username}
          displayName={profile.display_name ?? ''}
          bio={profile.bio ?? ''}
          avatarUrl={profile.avatar_url ?? null}
          location={profile.location ?? ''}
          platforms={platforms}
        />
      </main>
    </div>
  )
}
