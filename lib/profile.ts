import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export type Platform = {
  name: string   // 'twitter' | 'bluesky' | 'instagram' | 'linkedin' | 'github' | 'website'
  url: string
}

export type UserProfile = {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  location: string | null
  platforms: Platform[]
  merit_score: number
  merit_history: unknown
  suspended_at: string | null
  is_admin: boolean
  created_at: string
}

export function getUserProfile(username: string): Promise<UserProfile | null> {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()
      const { data } = await (admin
        .from('profiles')
        .select(
          'id, username, display_name, bio, avatar_url, location, platforms, merit_score, merit_history, suspended_at, is_admin, created_at'
        )
        .eq('username', username)
        .single() as unknown as Promise<{ data: UserProfile | null; error: unknown }>)
      if (!data) return null
      return {
        ...data,
        platforms: Array.isArray(data.platforms) ? (data.platforms as Platform[]) : [],
      }
    },
    [`profile-${username}`],
    { revalidate: 60 }
  )()
}
