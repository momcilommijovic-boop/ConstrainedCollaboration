'use client'

import { useTransition } from 'react'
import { switchToTestUser } from '@/app/actions/dev'
import { signOut } from '@/app/actions/auth'

type TestUser = { id: string; displayName: string }

export function DevToolbarClient({
  currentDisplayName,
  currentUserId,
  currentEmail,
  testUsers,
}: {
  currentDisplayName: string
  currentUserId: string
  currentEmail: string
  testUsers: TestUser[]
}) {
  const [switching, startSwitch] = useTransition()
  const [signingOut, startSignOut] = useTransition()

  function handleSwitch(e: React.ChangeEvent<HTMLSelectElement>) {
    const userId = e.target.value
    if (!userId || userId === currentUserId) return
    startSwitch(async () => {
      const { error } = await switchToTestUser(userId)
      if (error) {
        alert(`Switch failed: ${error}`)
        return
      }
      // Full reload forces Next.js to re-render all RSCs with the new session
      // cookie — router.refresh() alone may serve a cached RSC payload.
      window.location.reload()
    })
  }

  function handleSignOut() {
    startSignOut(async () => {
      await signOut()
    })
  }

  const busy = switching || signingOut
  // Show the local-part of the email (e.g. "testuser3") for clear identification.
  // Fall back to a truncated UUID if no email is available.
  const identity = currentEmail
    ? currentEmail.split('@')[0]
    : currentUserId
      ? currentUserId.slice(0, 8)
      : '—'

  return (
    <div className="bg-near-black text-off-white flex items-center gap-4 px-4 py-1.5 text-xs font-mono shrink-0">
      {/* DEV badge */}
      <span className="bg-accent-red text-off-white px-1.5 py-px text-[10px] uppercase tracking-widest select-none">
        DEV
      </span>

      {/* Current user — show display name AND identity token so isolation is verifiable */}
      <span className="text-off-white/50">
        Signed in as{' '}
        <span className="text-off-white">{currentDisplayName}</span>
        <span className="text-off-white/30 ml-1">({identity})</span>
      </span>

      {/* Spacer */}
      <span className="flex-1" />

      {/* Test user switcher */}
      {testUsers.length > 0 && (
        <label className="flex items-center gap-2">
          <span className="text-off-white/40">Switch to:</span>
          <select
            value={currentUserId}
            onChange={handleSwitch}
            disabled={busy}
            className="bg-near-black border border-off-white/20 text-off-white/80 text-xs font-mono px-2 py-px disabled:opacity-40 cursor-pointer"
          >
            {testUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </label>
      )}

      {busy && (
        <span className="text-off-white/40">{switching ? 'Switching…' : 'Signing out…'}</span>
      )}

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        disabled={busy}
        className="text-off-white/40 hover:text-off-white transition-colors disabled:opacity-30 text-xs font-mono"
      >
        Sign out
      </button>
    </div>
  )
}
