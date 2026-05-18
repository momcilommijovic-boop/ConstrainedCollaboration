'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { Platform } from '@/lib/profile'

export type ProfileActionState = { error: string | null }

const platformSchema = z.object({
  name: z.string().min(1),
  url: z.string().url('Platform URL must be a valid URL'),
})

const updateProfileSchema = z.object({
  display_name: z.string().max(60, 'Display name too long').optional(),
  bio: z.string().max(300, 'Bio must be 300 characters or fewer').optional(),
  location: z.string().max(60, 'Location too long').optional(),
})

export async function updateProfile(
  prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const parsed = updateProfileSchema.safeParse({
    display_name: formData.get('display_name'),
    bio: formData.get('bio'),
    location: formData.get('location'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Parse platforms JSON array from form
  let platforms: Platform[] = []
  const platformsRaw = formData.get('platforms') as string | null
  if (platformsRaw) {
    try {
      const arr = JSON.parse(platformsRaw)
      if (Array.isArray(arr)) {
        const validations = arr.map((p: unknown) => platformSchema.safeParse(p))
        const invalid = validations.find((v) => !v.success)
        if (invalid && !invalid.success) return { error: invalid.error.issues[0].message }
        platforms = validations.map((v) => (v.success ? v.data : null)).filter(Boolean) as Platform[]
      }
    } catch {
      return { error: 'Invalid platforms data.' }
    }
  }

  // Handle avatar upload
  let avatarUrl: string | undefined
  const avatarFile = formData.get('avatar') as File | null
  if (avatarFile && avatarFile.size > 0) {
    if (avatarFile.size > 2 * 1024 * 1024) return { error: 'Avatar must be under 2 MB.' }
    const ext = avatarFile.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return { error: 'Avatar must be a JPG, PNG, WebP, or GIF.' }
    }
    const path = `${user.id}/avatar.${ext}`
    const bytes = await avatarFile.arrayBuffer()
    // Use admin client for upload — bypasses storage RLS policies which can vary by Supabase version
    const admin = createAdminClient()
    const { error: uploadErr } = await admin.storage
      .from('avatars')
      .upload(path, Buffer.from(bytes), { contentType: avatarFile.type, upsert: true })
    if (uploadErr) return { error: `Avatar upload failed: ${uploadErr.message}` }
    const { data: urlData } = admin.storage.from('avatars').getPublicUrl(path)
    // Cache-bust so browsers reload the new image immediately
    avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`
  }

  const updates: Record<string, unknown> = {
    display_name: parsed.data.display_name || null,
    bio: parsed.data.bio || null,
    location: parsed.data.location || null,
    platforms,
  }
  if (avatarUrl) updates.avatar_url = avatarUrl

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single() as { data: { username: string } | null; error: unknown }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update(updates as never)
    .eq('id', user.id)

  if (updateErr) return { error: updateErr.message }

  revalidatePath(`/profile/${currentProfile?.username ?? ''}`)
  redirect(`/profile/${currentProfile?.username ?? ''}`)
}

// ── Avatar removal ────────────────────────────────────────────────────────────

export async function removeAvatar(
  prevState: ProfileActionState,
  _formData: FormData
): Promise<ProfileActionState> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', user.id)
    .single() as { data: { username: string; avatar_url: string | null } | null; error: unknown }

  if (profile?.avatar_url) {
    const url = profile.avatar_url.split('?')[0]
    const parts = url.split('/avatars/')
    if (parts[1]) {
      await admin.storage.from('avatars').remove([parts[1]])
    }
  }

  await supabase
    .from('profiles')
    .update({ avatar_url: null } as never)
    .eq('id', user.id)

  revalidatePath(`/profile/${profile?.username ?? ''}`)
  redirect(`/profile/${profile?.username ?? ''}`)
}
