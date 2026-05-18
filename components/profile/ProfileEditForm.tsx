'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useRef, useState } from 'react'
import { updateProfile } from '@/app/actions/profile'
import type { Platform } from '@/lib/profile'

const PLATFORM_OPTIONS = [
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'bluesky', label: 'Bluesky' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'github', label: 'GitHub' },
  { value: 'mastodon', label: 'Mastodon' },
  { value: 'substack', label: 'Substack' },
  { value: 'website', label: 'Website' },
]

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="font-mono text-xs bg-near-black text-off-white px-6 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40"
    >
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  )
}

interface Props {
  username: string
  displayName: string
  bio: string
  avatarUrl: string | null
  location: string
  platforms: Platform[]
}

export function ProfileEditForm({
  username,
  displayName,
  bio,
  avatarUrl,
  location,
  platforms: initialPlatforms,
}: Props) {
  const [state, formAction] = useFormState(updateProfile, { error: null })
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(avatarUrl)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function addPlatform() {
    setPlatforms((prev) => [...prev, { name: 'website', url: '' }])
  }

  function updatePlatform(i: number, field: keyof Platform, value: string) {
    setPlatforms((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)))
  }

  function removePlatform(i: number) {
    setPlatforms((prev) => prev.filter((_, idx) => idx !== i))
  }

  // We serialize platforms into a hidden input as JSON before submit
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const hidden = form.querySelector<HTMLInputElement>('input[name="platforms"]')
    if (hidden) hidden.value = JSON.stringify(platforms)
  }

  const displayName_current = displayName

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      {state.error && (
        <p className="font-mono text-xs text-accent-red border border-accent-red px-4 py-2">
          {state.error}
        </p>
      )}

      {/* Avatar */}
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-olive mb-3">Avatar</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-20 h-20 border border-near-black/20 overflow-hidden hover:border-near-black transition-colors flex items-center justify-center bg-near-black/5"
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="font-serif-display text-3xl text-near-black/30">
                {(displayName_current || username).charAt(0).toUpperCase()}
              </span>
            )}
          </button>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="font-mono text-xs border border-near-black/20 px-3 py-1.5 hover:bg-near-black hover:text-off-white transition-colors block"
            >
              Choose image
            </button>
            <p className="font-mono text-xs text-olive">JPG, PNG, WebP or GIF. Max 2 MB.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Display name */}
      <div>
        <label className="font-mono text-xs uppercase tracking-widest text-olive mb-2 block">
          Display Name
        </label>
        <input
          type="text"
          name="display_name"
          defaultValue={displayName}
          maxLength={60}
          placeholder={username}
          className="w-full border border-near-black/20 bg-transparent px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-near-black"
        />
      </div>

      {/* Bio */}
      <div>
        <label className="font-mono text-xs uppercase tracking-widest text-olive mb-2 block">
          Bio <span className="normal-case tracking-normal">(max 300 chars)</span>
        </label>
        <textarea
          name="bio"
          defaultValue={bio}
          maxLength={300}
          rows={3}
          className="w-full border border-near-black/20 bg-transparent px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-near-black resize-none"
        />
      </div>

      {/* Location */}
      <div>
        <label className="font-mono text-xs uppercase tracking-widest text-olive mb-2 block">
          Location
        </label>
        <input
          type="text"
          name="location"
          defaultValue={location}
          maxLength={60}
          placeholder="City, Country"
          className="w-full border border-near-black/20 bg-transparent px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-near-black"
        />
      </div>

      {/* Platforms */}
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-olive mb-3">Platforms</p>
        <div className="space-y-2">
          {platforms.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={p.name}
                onChange={(e) => updatePlatform(i, 'name', e.target.value)}
                className="border border-near-black/20 bg-off-white px-3 py-2 font-mono text-xs focus:outline-none focus:border-near-black"
              >
                {PLATFORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="url"
                value={p.url}
                onChange={(e) => updatePlatform(i, 'url', e.target.value)}
                placeholder="https://"
                className="flex-1 border border-near-black/20 bg-transparent px-3 py-2 font-mono text-xs focus:outline-none focus:border-near-black"
              />
              <button
                type="button"
                onClick={() => removePlatform(i)}
                className="font-mono text-xs text-accent-red hover:text-near-black transition-colors px-2 py-2"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {platforms.length < 6 && (
          <button
            type="button"
            onClick={addPlatform}
            className="mt-2 font-mono text-xs text-olive hover:text-near-black transition-colors"
          >
            + Add platform
          </button>
        )}
        {/* Serialized platforms — populated by onSubmit handler */}
        <input type="hidden" name="platforms" defaultValue={JSON.stringify(initialPlatforms)} />
      </div>

      <SubmitButton />
    </form>
  )
}
