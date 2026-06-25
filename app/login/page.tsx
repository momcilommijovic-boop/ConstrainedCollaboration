'use client'

import { useFormState } from 'react-dom'
import { useState } from 'react'
import Link from 'next/link'
import { signIn, signInWithMagicLink, signInWithGoogle } from '@/app/actions/auth'
import { Input } from '@/components/ui/Input'
import { SubmitButton } from '@/components/ui/Button'

export default function LoginPage() {
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [passwordState, passwordAction] = useFormState(signIn, { error: null })
  const [magicState, magicAction] = useFormState(signInWithMagicLink, { error: null })
  const [googleState, googleAction] = useFormState(signInWithGoogle, { error: null })
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

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-near-black/20" />
            <span className="font-mono text-xs text-olive">or</span>
            <div className="flex-1 h-px bg-near-black/20" />
          </div>

          <a
            href="/api/auth/google"
            className="w-full font-mono text-xs py-3 px-4 border border-near-black/30 text-near-black hover:bg-near-black hover:text-off-white transition-colors flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>
        </div>
      </main>
    </div>
  )
}
