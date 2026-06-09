'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

export type AuthState = { error: string | null }

const signUpSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z0-9_-]+$/, 'Username may only contain lowercase letters, numbers, _ and -'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

const magicLinkSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function signUp(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { username, email, password } = parsed.data
  const supabase = createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: username },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/callback`,
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'An account with this email already exists.' }
    }
    return { error: error.message }
  }

  return redirect('/signup/confirm')
}

export async function signIn(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { email, password } = parsed.data
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Invalid email or password.' }
  }

  return redirect('/dashboard')
}

export async function signInWithMagicLink(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get('email') })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}

export async function signInWithGoogle(): Promise<never> {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
      skipBrowserRedirect: true,
    },
  })

  if (error || !data.url) {
    throw new Error(error?.message ?? 'Failed to initialise Google sign-in')
  }

  redirect(data.url)
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/')
}
