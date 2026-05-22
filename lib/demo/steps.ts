import type { DemoStep, DemoContext } from './types'
import { DEMO_ACCOUNTS, DEMO_CELL_SLUG } from './constants'

const EDITOR = DEMO_ACCOUNTS.find((a) => a.role === 'editor')!
const WRITER1 = DEMO_ACCOUNTS.find((a) => a.role === 'writer1')!
const WRITER2 = DEMO_ACCOUNTS.find((a) => a.role === 'writer2')!
const WRITER3 = DEMO_ACCOUNTS.find((a) => a.role === 'writer3')!
const ILLUSTRATOR = DEMO_ACCOUNTS.find((a) => a.role === 'illustrator')!

export const DEMO_STEPS: DemoStep[] = [
  {
    id: 'landing',
    label: 'The Quorum platform',
    narration:
      'Quorum is a constraint-based co-operation platform. Groups form into Cells, governed by automated rules, to produce collaborative publications.',
    route: '/',
    durationMs: 5000,
    action: async (ctx: DemoContext) => {
      ctx.highlight('hero-cta')
    },
  },
  {
    id: 'signin-elena',
    label: 'Elena creates an account',
    narration:
      'Elena Vasquez, our editor, joins the platform. Merit starts at 95 — she has a track record.',
    route: '/dashboard',
    durationMs: 3000,
    action: async (ctx: DemoContext) => {
      await ctx.signIn(EDITOR.email)
      const state = await ctx.callApi('get-state')
      if (state.users) ctx.users = state.users as typeof ctx.users
    },
  },
  {
    id: 'dashboard',
    label: "Elena's dashboard",
    narration:
      'The dashboard shows active Cells, pending actions, and merit score. Elena has no active Cells yet.',
    route: '/dashboard',
    durationMs: 4000,
    action: async (ctx: DemoContext) => {
      ctx.highlight('create-cell-cta')
    },
  },
  {
    id: 'create-cell',
    label: 'Elena creates The Marginal Review',
    narration:
      'Elena creates a new Cell. She selects the E-zine strategy, sets a cap of 6 members, and names the publication.',
    route: `/dashboard`,
    durationMs: 5000,
    action: async (ctx: DemoContext) => {
      const editorId = ctx.users[EDITOR.username]?.id
      if (!editorId) throw new Error('Editor user not found')
      // Wipe any previous demo run so every run starts from a clean slate
      await ctx.callApi('reset')
      const result = await ctx.callApi('create-cell', { asUserId: editorId })
      ctx.cellId = result.cellId as string
      ctx.push(`/cells/${DEMO_CELL_SLUG}`)
    },
  },
  {
    id: 'forming-stage',
    label: 'The Cell is open — waiting for members',
    narration:
      'The Cell is now in the FORMING stage. The stage timeline shows where we are. Four members must join before the clock starts.',
    route: `/cells/${DEMO_CELL_SLUG}`,
    durationMs: 5000,
    action: async (ctx: DemoContext) => {
      ctx.highlight('stage-timeline')
    },
  },
  {
    id: 'members-join',
    label: 'Four writers join the Cell',
    narration:
      "James, Priya, Leo, and Sara discover the Cell and join. When the fourth joins, the countdown begins automatically.",
    route: `/cells/${DEMO_CELL_SLUG}`,
    durationMs: 8000,
    action: async (ctx: DemoContext) => {
      const joiners = [WRITER1, WRITER2, WRITER3, ILLUSTRATOR]
      for (const acc of joiners) {
        const userId = ctx.users[acc.username]?.id
        if (userId) {
          await ctx.callApi('join-cell', { asUserId: userId, cellSlug: DEMO_CELL_SLUG })
          await new Promise<void>((r) => setTimeout(r, 1200))
        }
      }
    },
  },
  {
    id: 'editor-elected',
    label: 'Elena is elected Editor',
    narration:
      'The constraint engine automatically elects an Editor by merit-weighted random selection. Elena is chosen. Her role badge appears.',
    route: `/cells/${DEMO_CELL_SLUG}`,
    durationMs: 5000,
    action: async (ctx: DemoContext) => {
      const editorId = ctx.users[EDITOR.username]?.id
      if (editorId) await ctx.callApi('trigger-briefing', { asUserId: editorId, cellSlug: DEMO_CELL_SLUG })
      ctx.highlight('editor-badge')
    },
  },
  {
    id: 'publish-brief',
    label: 'Elena writes the editorial brief',
    narration:
      'As Editor, Elena publishes the brief. She sets the theme, writes editorial guidance, sets the word limit, and invites three writers.',
    route: `/cells/${DEMO_CELL_SLUG}/brief`,
    durationMs: 7000,
    action: async (ctx: DemoContext) => {
      await ctx.signIn(EDITOR.email)
      const editorId = ctx.users[EDITOR.username]?.id
      const writer1Id = ctx.users[WRITER1.username]?.id
      const writer2Id = ctx.users[WRITER2.username]?.id
      const writer3Id = ctx.users[WRITER3.username]?.id
      if (!editorId || !ctx.cellId) return
      const result = await ctx.callApi('publish-brief', {
        asUserId: editorId,
        cellId: ctx.cellId,
        editorId,
        title: 'Issue I: The Infrastructure of Everything',
        theme: 'The hidden systems that shape daily life',
        guidance:
          'We want long-form pieces that take an ordinary system — a road, a water supply, a housing queue — and reveal the human and political story inside it. No jargon. 600–900 words.',
        word_count_min: 600,
        word_count_max: 900,
        slots: 3,
        inviteeIds: [writer1Id, writer2Id, writer3Id].filter(Boolean),
      })
      ctx.briefId = result.briefId as string
    },
  },
  {
    id: 'accept-invitations',
    label: 'Writers accept their invitations',
    narration:
      'James, Priya, and Leo each receive an invitation. They accept it — which assigns them the WRITER role and unlocks the submission form.',
    route: `/cells/${DEMO_CELL_SLUG}`,
    durationMs: 6000,
    action: async (ctx: DemoContext) => {
      const writers = [WRITER1, WRITER2, WRITER3]
      for (const acc of writers) {
        const userId = ctx.users[acc.username]?.id
        if (userId && ctx.briefId) {
          await ctx.callApi('respond-invitation', { asUserId: userId, briefId: ctx.briefId })
          await new Promise<void>((r) => setTimeout(r, 1000))
        }
      }
    },
  },
  {
    id: 'james-submits',
    label: 'James submits his article',
    narration:
      'James navigates to the submission form. He pastes his article — 720 words on the politics of bus routes. The word counter confirms he is within limits.',
    route: `/dashboard`,
    durationMs: 10000,
    action: async (ctx: DemoContext) => {
      await ctx.signIn(WRITER1.email)
      const userId = ctx.users[WRITER1.username]?.id
      if (!userId || !ctx.briefId || !ctx.cellId) throw new Error('Missing userId, briefId, or cellId')
      const content = await ctx.callApi('get-demo-content', { authorEmail: WRITER1.email })
      // Navigate to submit page as James — form will be visible
      ctx.push(`/cells/${DEMO_CELL_SLUG}/submit`)
      await new Promise<void>((r) => setTimeout(r, 1800))
      // Fill the form visually
      ctx.fillForm('input[name="title"]', (content.title as string) ?? '')
      await new Promise<void>((r) => setTimeout(r, 600))
      ctx.fillForm('textarea[name="body"]', (content.body as string) ?? '')
      await new Promise<void>((r) => setTimeout(r, 1500))
      // Submit via API (bypasses RLS, records submission in DB)
      await ctx.callApi('submit-article', {
        asUserId: userId,
        cellId: ctx.cellId,
        briefId: ctx.briefId,
        title: content.title as string,
        body: content.body as string,
      })
      ctx.highlight('submission-count')
    },
  },
  {
    id: 'others-submit',
    label: 'Priya and Leo submit their pieces',
    narration:
      "Priya submits on climate infrastructure. Leo submits on housing policy. Three submissions received — the editor's queue is full.",
    route: `/cells/${DEMO_CELL_SLUG}`,
    durationMs: 6000,
    action: async (ctx: DemoContext) => {
      for (const acc of [WRITER2, WRITER3]) {
        const userId = ctx.users[acc.username]?.id
        if (!userId || !ctx.briefId || !ctx.cellId) continue
        const content = await ctx.callApi('get-demo-content', { authorEmail: acc.email })
        await ctx.callApi('submit-article', {
          asUserId: userId,
          cellId: ctx.cellId,
          briefId: ctx.briefId,
          title: content.title as string,
          body: content.body as string,
        })
        await new Promise<void>((r) => setTimeout(r, 1200))
      }
    },
  },
  {
    id: 'editing-opens',
    label: 'Elena reviews the submissions',
    narration:
      'The submission deadline passes. The cell advances to EDITING automatically. Elena opens the editorial workspace.',
    route: `/cells/${DEMO_CELL_SLUG}/edit`,
    durationMs: 5000,
    action: async (ctx: DemoContext) => {
      if (ctx.cellId) await ctx.callApi('advance-to-editing', { cellId: ctx.cellId })
      await ctx.signIn(EDITOR.email)
      ctx.highlight('submission-review-panel')
    },
  },
  {
    id: 'elena-reviews',
    label: 'Elena accepts all three articles',
    narration:
      "Elena reviews each piece. She accepts James's and Priya's articles. She accepts Leo's too. Three articles confirmed for the issue.",
    route: `/cells/${DEMO_CELL_SLUG}/edit`,
    durationMs: 8000,
    action: async (ctx: DemoContext) => {
      if (!ctx.cellId) throw new Error('Missing cellId — previous step failed')
      const subs = await ctx.callApi('get-submissions', { cellId: ctx.cellId })
      const submissions = subs.submissions as Array<{ id: string; authorEmail: string }>
      if (!submissions?.length) throw new Error('No submissions found — submit-article steps failed')

      const jamesSub = submissions.find((s) => s.authorEmail === WRITER1.email)
      const priyaSub = submissions.find((s) => s.authorEmail === WRITER2.email)
      const leoSub = submissions.find((s) => s.authorEmail === WRITER3.email)

      if (jamesSub) {
        await ctx.callApi('review-submission', { submissionId: jamesSub.id, status: 'ACCEPTED' })
        await new Promise<void>((r) => setTimeout(r, 1000))
      }
      if (priyaSub) {
        await ctx.callApi('review-submission', { submissionId: priyaSub.id, status: 'ACCEPTED' })
        await new Promise<void>((r) => setTimeout(r, 1000))
      }
      if (leoSub) {
        await ctx.callApi('review-submission', { submissionId: leoSub.id, status: 'ACCEPTED' })
        await new Promise<void>((r) => setTimeout(r, 1000))
      }

      // Seed house style and layout while still on edit page
      await ctx.callApi('seed-design-tokens', { cellId: ctx.cellId })
      await ctx.callApi('seed-layout', { cellId: ctx.cellId, cycle: 1 })
    },
  },
  {
    id: 'house-styles',
    label: 'Elena sets the house style',
    narration:
      "The Cell's visual identity is defined by its house style — fonts, colours, typographic scale. Elena extracts these from reference publications. The tokens govern every issue.",
    route: `/cells/${DEMO_CELL_SLUG}/settings/design`,
    durationMs: 8000,
    action: async (ctx: DemoContext) => {
      ctx.highlight('design-preview')
    },
  },
  {
    id: 'layout-editor',
    label: 'The issue — rendered',
    narration:
      'The layout engine has assembled the issue from the accepted articles. Cover, bylines, body copy, colophon — all governed by the house style tokens. This is what readers see.',
    route: `/cells/${DEMO_CELL_SLUG}/publication/1`,
    durationMs: 10000,
    action: async (ctx: DemoContext) => {
      ctx.highlight('layout-canvas')
    },
  },
  {
    id: 'publish-publication',
    label: 'Elena publishes the issue',
    narration:
      'Elena reviews the rendered issue and confirms publication. The cell advances to the PROMOTION stage automatically. All members must now share the issue.',
    route: `/cells/${DEMO_CELL_SLUG}/publication/1`,
    durationMs: 8000,
    action: async (ctx: DemoContext) => {
      if (!ctx.cellId) return
      const result = await ctx.callApi('publish-publication', { cellId: ctx.cellId })
      ctx.publicationId = result.publicationId as string
    },
  },
  {
    id: 'promotion',
    label: 'Members promote the issue',
    narration:
      'All members are now required to promote the publication on their channels. They submit evidence links. Anyone who misses the deadline receives a merit penalty.',
    route: `/cells/${DEMO_CELL_SLUG}`,
    durationMs: 7000,
    action: async (ctx: DemoContext) => {
      // Re-establish Elena's session and navigate to the promote page
      await ctx.signIn(EDITOR.email)
      ctx.push(`/cells/${DEMO_CELL_SLUG}/promote`)
      await new Promise<void>((r) => setTimeout(r, 1200))

      const members = [EDITOR, WRITER1, WRITER2, WRITER3, ILLUSTRATOR]
      for (const acc of members) {
        const userId = ctx.users[acc.username]?.id
        if (userId && ctx.publicationId) {
          await ctx.callApi('submit-promotion', {
            asUserId: userId,
            publicationId: ctx.publicationId,
            evidenceUrl: `https://twitter.com/demo/status/${Date.now()}`,
          })
          await new Promise<void>((r) => setTimeout(r, 800))
        }
      }
    },
  },
  {
    id: 'cycle-complete',
    label: 'Cycle complete — merit scores update',
    narration:
      'The promotion window closes. The cycle completes. Merit scores update automatically — writers who delivered gain points. The constraint engine has done its job.',
    route: `/cells/${DEMO_CELL_SLUG}`,
    durationMs: 8000,
    action: async (ctx: DemoContext) => {
      if (ctx.publicationId) {
        await ctx.callApi('complete-cycle', {
          publicationId: ctx.publicationId,
          cellId: ctx.cellId,
        })
      }
      ctx.highlight('merit-scores')
    },
  },
  {
    id: 'profile',
    label: 'The record is permanent',
    narration:
      "Every contribution is recorded. James's profile shows his accepted article, his merit history, and his role in this cycle. The platform remembers.",
    route: '/profile/james-okafor',
    durationMs: 8000,
    action: async (ctx: DemoContext) => {
      ctx.highlight('merit-score')
      ctx.highlight('contribution-history')
    },
  },
]
