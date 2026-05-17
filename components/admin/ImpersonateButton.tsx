'use client'

import { useState } from 'react'
import { getTestUserEmail } from '@/app/actions/admin'
import { createClient } from '@/lib/supabase/client'
import { TEST_PASSWORD } from '@/lib/admin-constants'

export function ImpersonateButton({ userId }: { userId: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)
    try {
      const email = await getTestUserEmail(userId)
      if (!email) {
        setError('Could not find user email.')
        setPending(false)
        return
      }

      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: TEST_PASSWORD,
      })

      if (signInError) {
        setError(signInError.message)
        setPending(false)
        return
      }

      window.location.href = '/dashboard'
    } catch {
      setError('Unexpected error.')
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <button
        onClick={handleClick}
        disabled={pending}
        className="font-mono text-xs border border-near-black px-3 py-1 hover:bg-near-black hover:text-off-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {pending ? 'Signing in…' : 'Impersonate →'}
      </button>
      {error && <p className="font-mono text-xs text-accent-red">{error}</p>}
    </div>
  )
}
