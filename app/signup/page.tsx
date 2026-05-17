'use client'

import { useFormState } from 'react-dom'
import Link from 'next/link'
import { signUp } from '@/app/actions/auth'
import { Input } from '@/components/ui/Input'
import { SubmitButton } from '@/components/ui/Button'

export default function SignupPage() {
  const [state, action] = useFormState(signUp, { error: null })

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl text-near-black tracking-tight">
          Quorum
        </Link>
        <span className="font-mono text-xs text-olive">
          Already have an account?{' '}
          <Link href="/login" className="text-near-black underline underline-offset-4 hover:text-accent-red">
            Sign in
          </Link>
        </span>
      </header>

      <main className="flex-1 flex items-start justify-center pt-20 px-4">
        <div className="w-full max-w-sm">
          <h1 className="font-serif-display text-3xl mb-1">Create account</h1>
          <p className="font-mono text-xs text-olive mb-8">
            You need an account to join or start a Cell.
          </p>

          <form action={action} className="flex flex-col gap-5">
            <Input
              label="Username"
              name="username"
              type="text"
              autoComplete="username"
              hint="Lowercase letters, numbers, _ and - only."
              required
            />
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters."
              required
            />

            {state.error && (
              <p className="font-mono text-xs text-accent-red border border-accent-red px-3 py-2">
                {state.error}
              </p>
            )}

            <SubmitButton className="w-full justify-center mt-2">
              Create account →
            </SubmitButton>
          </form>

          <p className="font-mono text-xs text-olive mt-6 border-t border-near-black/10 pt-6">
            By creating an account you accept that deadlines are enforced automatically
            and penalties are final.
          </p>
        </div>
      </main>
    </div>
  )
}
