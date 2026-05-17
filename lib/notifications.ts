import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Quorum <notifications@quorum.so>'
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.auth.admin.getUserById(userId)
    return data.user?.email ?? null
  } catch {
    return null
  }
}

async function getUserEmails(userIds: string[]): Promise<string[]> {
  const results = await Promise.all(userIds.map(getUserEmail))
  return results.filter((e): e is string => e !== null)
}

function emailHtml(title: string, body: string, ctaLabel?: string, ctaUrl?: string): string {
  const cta = ctaLabel && ctaUrl
    ? `<p style="margin:28px 0 0;">
        <a href="${ctaUrl}" style="font-family:monospace;font-size:13px;background:#1A1A18;color:#F5F2EC;padding:10px 20px;text-decoration:none;display:inline-block;">
          ${ctaLabel} →
        </a>
      </p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#F5F2EC;margin:0;padding:40px 24px;font-family:Georgia,serif;">
  <div style="max-width:520px;margin:0 auto;border:1px solid rgba(26,26,24,0.2);padding:40px;background:#F5F2EC;">
    <p style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#7A7A5A;margin:0 0 24px;">Quorum</p>
    <h1 style="font-size:24px;margin:0 0 20px;color:#1A1A18;font-weight:normal;">${title}</h1>
    <div style="font-size:15px;line-height:1.7;color:#1A1A18;">${body}</div>
    ${cta}
    <p style="margin:40px 0 0;font-family:monospace;font-size:11px;color:#7A7A5A;border-top:1px solid rgba(26,26,24,0.1);padding-top:20px;">
      This is an automated message from Quorum. Deadlines are enforced automatically.
    </p>
  </div>
</body>
</html>`
}

// ── Editor elected ────────────────────────────────────────────────────────────

export async function notifyEditorElected({
  editorId,
  cellTitle,
  cellSlug,
  deadline,
}: {
  editorId: string
  cellTitle: string
  cellSlug: string
  deadline: string | null
}): Promise<void> {
  const email = await getUserEmail(editorId)
  if (!email) return

  const deadlineStr = deadline
    ? `<strong>${new Date(deadline).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>`
    : 'soon'

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `You've been elected Editor — ${cellTitle}`,
    html: emailHtml(
      `You've been elected Editor`,
      `<p>You have been randomly elected as Editor for <strong>${cellTitle}</strong>.</p>
       <p>You must publish a Brief by ${deadlineStr}. The Brief sets the theme, editorial guidance, word count limits, and invites writers.</p>
       <p>If you miss the deadline, a penalty will be applied and a new Editor will be elected.</p>`,
      'Publish Brief',
      `${SITE}/cells/${cellSlug}/brief`
    ),
  })
}

// ── Writer invited ────────────────────────────────────────────────────────────

export async function notifyWritersInvited({
  inviteeIds,
  editorName,
  cellTitle,
  cellSlug,
  briefTitle,
  deadline,
}: {
  inviteeIds: string[]
  editorName: string
  cellTitle: string
  cellSlug: string
  briefTitle: string
  deadline: string
}): Promise<void> {
  const emails = await getUserEmails(inviteeIds)
  if (emails.length === 0) return

  const deadlineStr = new Date(deadline).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  await Promise.all(
    emails.map((email) =>
      resend.emails.send({
        from: FROM,
        to: email,
        subject: `You've been invited to submit — ${cellTitle}`,
        html: emailHtml(
          `Invitation to submit`,
          `<p>Editor <strong>${editorName}</strong> has invited you to submit an article for <strong>${cellTitle}</strong>.</p>
           <p>Brief: <strong>${briefTitle}</strong></p>
           <p>Submission deadline: <strong>${deadlineStr}</strong></p>
           <p>Accept or decline your invitation, then submit your article before the deadline. Missing the deadline results in a merit penalty.</p>`,
          'View Brief',
          `${SITE}/cells/${cellSlug}/brief`
        ),
      })
    )
  )
}

// ── Submission accepted ───────────────────────────────────────────────────────

export async function notifySubmissionAccepted({
  authorId,
  cellTitle,
  cellSlug,
  articleTitle,
}: {
  authorId: string
  cellTitle: string
  cellSlug: string
  articleTitle: string | null
}): Promise<void> {
  const email = await getUserEmail(authorId)
  if (!email) return

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Submission accepted — ${cellTitle}`,
    html: emailHtml(
      `Your submission was accepted`,
      `<p>Your article <strong>${articleTitle ?? '(untitled)'}</strong> has been accepted for <strong>${cellTitle}</strong>.</p>
       <p>It will appear in the published issue. You'll receive another notification when the issue goes live.</p>`,
      'View Cell',
      `${SITE}/cells/${cellSlug}`
    ),
  })
}

// ── Rework requested ──────────────────────────────────────────────────────────

export async function notifyReworkRequested({
  authorId,
  cellTitle,
  cellSlug,
  editorNote,
}: {
  authorId: string
  cellTitle: string
  cellSlug: string
  editorNote: string
}): Promise<void> {
  const email = await getUserEmail(authorId)
  if (!email) return

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Rework requested — ${cellTitle}`,
    html: emailHtml(
      `Your submission needs revision`,
      `<p>The Editor has requested changes to your submission for <strong>${cellTitle}</strong>.</p>
       <p style="background:rgba(26,26,24,0.04);padding:16px;font-family:monospace;font-size:13px;">${editorNote}</p>
       <p>You have 48 hours to revise and resubmit. This is your one opportunity to rework this submission.</p>`,
      'Revise Submission',
      `${SITE}/cells/${cellSlug}/submit`
    ),
  })
}

// ── Submission stage opened (editor) ──────────────────────────────────────────

export async function notifySubmissionsOpen({
  editorId,
  cellTitle,
  cellSlug,
  deadline,
}: {
  editorId: string
  cellTitle: string
  cellSlug: string
  deadline: string
}): Promise<void> {
  const email = await getUserEmail(editorId)
  if (!email) return

  const deadlineStr = new Date(deadline).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Submissions closed — review now — ${cellTitle}`,
    html: emailHtml(
      `Time to review submissions`,
      `<p>The submission window for <strong>${cellTitle}</strong> has closed. Review all submitted articles and publish the issue by <strong>${deadlineStr}</strong>.</p>
       <p>You may accept, reject, or request one round of rework per submission. Missing the editing deadline results in a merit penalty.</p>`,
      'Open Editorial Workspace',
      `${SITE}/cells/${cellSlug}/edit`
    ),
  })
}

// ── Publication published ──────────────────────────────────────────────────────

export async function notifyPublicationPublished({
  memberIds,
  cellTitle,
  cellSlug,
  cycle,
  promotionDeadline,
}: {
  memberIds: string[]
  cellTitle: string
  cellSlug: string
  cycle: number
  promotionDeadline: string
}): Promise<void> {
  const emails = await getUserEmails(memberIds)
  if (emails.length === 0) return

  const deadlineStr = new Date(promotionDeadline).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  await Promise.all(
    emails.map((email) =>
      resend.emails.send({
        from: FROM,
        to: email,
        subject: `Issue ${cycle} is live — ${cellTitle}`,
        html: emailHtml(
          `The issue is published`,
          `<p><strong>${cellTitle}</strong> — Issue ${cycle} is now live.</p>
           <p>All members must share the publication on their social channels and submit evidence by <strong>${deadlineStr}</strong>.</p>
           <p>Missing the promotion deadline results in a merit penalty.</p>`,
          'Read & Promote',
          `${SITE}/cells/${cellSlug}/promote`
        ),
      })
    )
  )
}

// ── Cycle complete ─────────────────────────────────────────────────────────────

export async function notifyCycleComplete({
  memberIds,
  cellTitle,
  cellSlug,
  cycle,
}: {
  memberIds: string[]
  cellTitle: string
  cellSlug: string
  cycle: number
}): Promise<void> {
  const emails = await getUserEmails(memberIds)
  if (emails.length === 0) return

  await Promise.all(
    emails.map((email) =>
      resend.emails.send({
        from: FROM,
        to: email,
        subject: `Cycle ${cycle} complete — ${cellTitle}`,
        html: emailHtml(
          `Cycle ${cycle} is complete`,
          `<p><strong>${cellTitle}</strong> has completed its ${cycle === 1 ? 'first' : `cycle ${cycle}`} cycle.</p>
           <p>Merit scores have been updated based on your participation. Check your profile to see your updated score and history.</p>`,
          'View Publication',
          `${SITE}/cells/${cellSlug}/publication/${cycle}`
        ),
      })
    )
  )
}
