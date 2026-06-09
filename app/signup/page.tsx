'use client'

import { useFormState } from 'react-dom'
import Link from 'next/link'
import { signUp, signInWithGoogle } from '@/app/actions/auth'
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

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-near-black/20" />
            <span className="font-mono text-xs text-olive">or</span>
            <div className="flex-1 h-px bg-near-black/20" />
          </div>

          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="w-full font-mono text-xs py-3 px-4 border border-near-black/30 text-near-black hover:bg-near-black hover:text-off-white transition-colors flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
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
