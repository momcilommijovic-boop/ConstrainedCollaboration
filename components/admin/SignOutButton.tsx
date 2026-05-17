'use client'

import { signOut } from '@/app/actions/auth'

export function SignOutButton({ label = 'Sign out' }: { label?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="font-mono text-xs border border-near-black/30 px-3 py-1 hover:border-near-black hover:bg-near-black hover:text-off-white transition-colors"
      >
        {label}
      </button>
    </form>
  )
}
