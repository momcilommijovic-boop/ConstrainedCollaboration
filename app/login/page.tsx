'use client'

import { useFormState } from 'react-dom'
import { useState } from 'react'
import Link from 'next/link'
import { signIn, signInWithMagicLink } from '@/app/actions/auth'
import { Input } from '@/components/ui/Input'
import { SubmitButton } from '@/components/ui/Button'

export default function LoginPage() {
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [passwordState, passwordAction] = useFormState(signIn, { error: null })
  const [magicState, magicAction] = useFormState(signInWithMagicLink, { error: null })
  const magicSent = !magicState.error && mode === 'magic'

  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="border-b border-near-black/20 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif-display text-xl text-near-black tracking-tight">
          Quorum
        </Link>
        <span className="font-mono text-xs text-olive">
          No account?{' '}
          <Link href="/signup" className="text-near-black underline underline-offset-4 hover:text-accent-red">
            Sign up
          </Link>
        </span>
      </header>

      <main className="flex-1 flex items-start justify-center pt-20 px-4">
        <div className="w-full max-w-sm">
          <h1 className="font-serif-display text-3xl mb-8">Sign in</h1>

          {/* Mode toggle */}
          <div className="flex mb-6 border border-near-black/20">
            <button
              onClick={() => setMode('password')}
              className={`flex-1 font-mono text-xs py-2 transition-colors ${
                mode === 'password'
                  ? 'bg-near-black text-off-white'
                  : 'bg-transparent text-olive hover:text-near-black'
              }`}
            >
              Password
            </button>
            <button
              onClick={() => setMode('magic')}
              className={`flex-1 font-mono text-xs py-2 transition-colors border-l border-near-black/20 ${
                mode === 'magic'
                  ? 'bg-near-black text-off-white'
                  : 'bg-transparent text-olive hover:text-near-black'
              }`}
            >
              Magic link
            </button>
          </div>

          {mode === 'password' && (
            <form action={passwordAction} className="flex flex-col gap-5">
              <Input label="Email" name="email" type="email" autoComplete="email" required />
              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />

              {passwordState.error && (
                <p className="font-mono text-xs text-accent-red border border-accent-red px-3 py-2">
                  {passwordState.error}
                </p>
              )}

              <SubmitButton className="w-full mt-2">Sign in →</SubmitButton>
            </form>
          )}

          {mode === 'magic' && !magicSent && (
            <form action={magicAction} className="flex flex-col gap-5">
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                hint="We'll send a one-time sign-in link."
                required
              />

              {magicState.error && (
                <p className="font-mono text-xs text-accent-red border border-accent-red px-3 py-2">
                  {magicState.error}
                </p>
              )}

              <SubmitButton className="w-full mt-2">Send link →</SubmitButton>
            </form>
          )}

          {mode === 'magic' && magicSent && (
            <div className="border border-near-black/20 px-4 py-5">
              <p className="font-body text-sm mb-2">Link sent.</p>
              <p className="font-mono text-xs text-olive">
                Check your email. The link expires in 1 hour.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
