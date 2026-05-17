// send-notification — sends transactional email via Resend HTTP API.
// Called by other Edge Functions for automated event emails.
//
// POST body: { to: string | string[], subject: string, html: string, from?: string }

import { logSystem } from '../_shared/operations.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const FROM = 'Quorum <notifications@quorum.so>'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

Deno.serve(async (req: Request) => {
  const auth = req.headers.get('Authorization') ?? ''
  if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { to?: unknown; subject?: string; html?: string; from?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { to, subject, html, from = FROM } = body

  if (!to || !subject || !html) {
    return new Response('Missing required fields: to, subject, html', { status: 400 })
  }

  if (!RESEND_API_KEY) {
    await logSystem(supabase, 'notification_skipped_no_key', { to: String(to), subject })
    return new Response(JSON.stringify({ ok: false, reason: 'RESEND_API_KEY not set' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!res.ok) {
    const text = await res.text()
    await logSystem(supabase, 'notification_send_error', { to: String(to), subject }, text)
    return new Response(JSON.stringify({ ok: false, error: text }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const data = await res.json()
  await logSystem(supabase, 'notification_sent', { to: String(to), subject, resend_id: data.id ?? null })

  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
