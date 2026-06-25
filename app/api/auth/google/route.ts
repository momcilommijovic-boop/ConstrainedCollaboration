import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
      skipBrowserRedirect: true,
    },
  })

  if (error || !data.url) {
    const msg = encodeURIComponent(error?.message ?? 'Google sign-in unavailable')
    return NextResponse.redirect(new URL(`/login?google_error=${msg}`, process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'))
  }

  return NextResponse.redirect(data.url)
}
