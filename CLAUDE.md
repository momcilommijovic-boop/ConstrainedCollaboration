# CLAUDE.md — Co-Operational Constraint Platform

You are building **Quorum** — a web application that runs structured, automated co-operation projects called **Cells**. Each Cell is a group of people bound by a constraint strategy: a set of rules, roles, deadlines, and automated consequences that govern how output is produced together.

The first constraint strategy to implement is the **E-zine Strategy** (a collaborative journalism/publishing flow), but the architecture must be generic enough to support other constraint strategies in future without major refactoring.

---

## Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend/DB**: Supabase (Postgres, Auth, Row-Level Security, Realtime, Storage)
- **Scheduler**: Supabase pg_cron (for deadline enforcement) + Supabase Edge Functions (for event handlers)
- **Email**: Resend (for notifications at key automated events)
- **File uploads**: Supabase Storage (article submissions, cover art)
- **Deployment**: Vercel

Do not use any other backend framework. All server logic lives in Next.js Server Actions or Supabase Edge Functions. Do not use client-side Supabase calls for anything that mutates state — use Server Actions only.

---

## Core Concepts (read carefully — these names are used everywhere)

| Term | Definition |
|---|---|
| **Cell** | A single instance of a co-operation project. Has a strategy, member cap, and lifecycle. |
| **Strategy** | The ruleset governing a Cell's flow: roles, stages, deadlines, and penalty rules. |
| **Stage** | A named phase within a Cell's lifecycle (e.g. `FORMING`, `BRIEFING`, `SUBMISSION`, `EDITING`, `PUBLICATION`, `PROMOTION`, `COMPLETE`). |
| **Member** | A user who has joined a Cell. Has a role within that Cell. |
| **Role** | A function assigned (or elected) within a Cell (e.g. `EDITOR`, `WRITER`, `ILLUSTRATOR`, `MEMBER`). |
| **Brief** | A structured document the Editor publishes to guide submissions. |
| **Submission** | An article or piece of content uploaded by a Writer in response to a Brief. |
| **Merit Score** | A per-user score updated by automated events (completion, penalties, quality signals). |
| **Penalty** | An automated consequence triggered by missed deadlines (warning → score deduction → kick). |
| **Publication** | The final assembled output of a Cell cycle. |

---

## Database Schema

Create all of these tables in Supabase. Use UUIDs for all primary keys. Enable RLS on all tables.

### `profiles`
```sql
id uuid references auth.users primary key,
username text unique not null,
display_name text,
bio text,
avatar_url text,
merit_score integer default 100,
merit_history jsonb default '[]',  -- array of {event, delta, ts}
created_at timestamptz default now()
```

### `cells`
```sql
id uuid primary key default gen_random_uuid(),
slug text unique not null,
title text not null,
description text,
strategy_id text not null,          -- e.g. 'EZINE_V1'
strategy_config jsonb not null,     -- strategy-specific settings (see below)
status text not null default 'FORMING',  -- FORMING | ACTIVE | COMPLETE | ABANDONED
owner_id uuid references profiles(id),
current_stage text not null default 'FORMING',
stage_deadline timestamptz,
member_cap integer not null default 8,
min_members integer not null default 4,
current_cycle integer default 1,
is_recurring boolean default true,
created_at timestamptz default now()
```

### `cell_members`
```sql
id uuid primary key default gen_random_uuid(),
cell_id uuid references cells(id) on delete cascade,
user_id uuid references profiles(id),
role text not null default 'MEMBER',   -- MEMBER | EDITOR | WRITER | ILLUSTRATOR
status text not null default 'ACTIVE', -- ACTIVE | WARNED | SUSPENDED | KICKED
joined_at timestamptz default now(),
unique(cell_id, user_id)
```

### `briefs`
```sql
id uuid primary key default gen_random_uuid(),
cell_id uuid references cells(id) on delete cascade,
cycle integer not null default 1,
editor_id uuid references profiles(id),
title text not null,
theme text not null,
guidance text not null,
word_count_min integer default 400,
word_count_max integer default 1200,
slots integer not null,             -- number of articles invited
published_at timestamptz default now(),
deadline timestamptz not null
```

### `invitations`
```sql
id uuid primary key default gen_random_uuid(),
brief_id uuid references briefs(id) on delete cascade,
cell_id uuid references cells(id),
invitee_id uuid references profiles(id),
status text default 'PENDING',      -- PENDING | ACCEPTED | DECLINED | EXPIRED
sent_at timestamptz default now(),
responded_at timestamptz
```

### `submissions`
```sql
id uuid primary key default gen_random_uuid(),
brief_id uuid references briefs(id) on delete cascade,
cell_id uuid references cells(id),
author_id uuid references profiles(id),
title text,
body text,
word_count integer,
file_url text,
status text default 'DRAFT',        -- DRAFT | SUBMITTED | ACCEPTED | REJECTED | REWORK_REQUESTED
editor_note text,                   -- populated on REJECTED or REWORK_REQUESTED
submitted_at timestamptz,
reviewed_at timestamptz,
cycle integer default 1
```

### `publications`
```sql
id uuid primary key default gen_random_uuid(),
cell_id uuid references cells(id),
cycle integer not null,
brief_id uuid references briefs(id),
cover_image_url text,
selected_submission_ids uuid[],
assembled_by uuid references profiles(id),  -- editor
published_at timestamptz,
promotion_deadline timestamptz,
status text default 'ASSEMBLING'    -- ASSEMBLING | PUBLISHED | PROMOTION_OPEN | ARCHIVED
```

### `promotion_records`
```sql
id uuid primary key default gen_random_uuid(),
publication_id uuid references publications(id),
user_id uuid references profiles(id),
evidence_url text,                  -- link to their social post
submitted_at timestamptz,
status text default 'PENDING'       -- PENDING | VERIFIED | MISSED
```

### `penalty_log`
```sql
id uuid primary key default gen_random_uuid(),
cell_id uuid references cells(id),
user_id uuid references profiles(id),
reason text not null,
merit_delta integer not null,
stage text,
cycle integer,
auto boolean default true,
created_at timestamptz default now()
```

### `strategy_templates`
```sql
id text primary key,                -- e.g. 'EZINE_V1'
name text not null,
description text,
default_config jsonb not null,
schema jsonb                        -- JSON Schema for validating config
```

---

## Strategy Config Shape (for EZINE_V1)

The `strategy_config` jsonb column on `cells` stores this object when strategy is `EZINE_V1`:

```json
{
  "forming_timeout_days": 14,
  "briefing_window_days": 3,
  "submission_window_days": 7,
  "editing_window_days": 4,
  "promotion_window_days": 5,
  "min_submissions_required": 3,
  "max_submissions_per_writer": 1,
  "editor_election_method": "random",
  "illustrator_required": false,
  "illustrator_dedicated": false,
  "word_count_min": 400,
  "word_count_max": 1200,
  "penalty_rules": {
    "missed_brief": { "action": "warn", "merit_delta": -5 },
    "missed_submission": { "action": "warn", "merit_delta": -10 },
    "missed_promotion": { "action": "warn_then_kick", "merit_delta": -15 },
    "second_offense": { "action": "kick", "merit_delta": -20 },
    "merit_kick_threshold": 60
  },
  "promotion_requirement": "social_link",
  "min_merit_to_join": 50,
  "recur_on_completion": true
}
```

---

## Application Flow (E-zine Strategy, one full cycle)

Implement each of these stages as a discrete, testable state in the Cell lifecycle.

### Stage 1: FORMING
- Cell is created by an owner, who sets title, description, member cap, min_members, and strategy config.
- Users browse available Cells and join (if merit ≥ `min_merit_to_join` and cap not reached).
- When `member_count >= min_members`, a countdown begins (pg_cron checks every hour).
- **Automatic trigger**: When countdown expires OR member_count hits cap → move to BRIEFING.
- Owner may also manually trigger if threshold met.

### Stage 2: BRIEFING
- **Automatic**: Editor is elected from current members by `editor_election_method` (default: random weighted by merit).
- If `illustrator_required: true`, an Illustrator is also elected or volunteered.
- Elected Editor receives a notification and gains the EDITOR role for this cycle.
- Editor must publish a Brief within `briefing_window_days`. Brief includes: title, theme, editorial guidance, word limits, number of article slots.
- Editor invites specific members to fill the slots (must invite at least `min_submissions_required` members).
- **Deadline miss**: If Editor fails to publish Brief → penalty applied to Editor → new Editor elected, clock reset.
- Stage deadline stored in `cells.stage_deadline`.

### Stage 3: SUBMISSION
- Invited Writers receive notification. They must submit within `submission_window_days`.
- Writers upload article (text body or file). Word count is validated client-side and server-side.
- Writers who decline invitation or miss deadline → penalty applied.
- Non-invited members may not submit unless Editor extends an additional invitation.
- **Automatic transition**: When deadline passes → move to EDITING regardless of submission count.
- If fewer than `min_submissions_required` received → Cell is flagged, owner notified. Editor may be penalised.

### Stage 4: EDITING
- Editor reviews each SUBMITTED article.
- Editor may: ACCEPT it (added to publication), REJECT it (with mandatory editor_note), or mark REWORK_REQUESTED (with guidance — writer gets 48h to resubmit once).
- Editor assembles Publication: selects cover image (or delegates to Illustrator), orders articles.
- Editor must publish within `editing_window_days`.
- **Deadline miss**: Penalty to Editor. If still no publication after grace period → Cell is ABANDONED for this cycle, new cycle starts.
- **Automatic transition**: When Editor marks publication as PUBLISHED → move to PROMOTION.

### Stage 5: PROMOTION
- Publication is now visible on the platform.
- All active Cell members are required to promote the publication on their social channels within `promotion_window_days`.
- Members submit evidence: a URL to their social post.
- **Deadline miss**: Members who fail to submit evidence → `missed_promotion` penalty.
- **Automatic transition**: When deadline passes → move to COMPLETE.

### Stage 6: COMPLETE
- Merit scores are updated for all members based on their performance this cycle.
- Cycle counter incremented.
- If `recur_on_completion: true` → a new cycle begins automatically (back to BRIEFING, new Editor elected).
- Summary page shows cycle results, merit changes, published articles.

---

## Automatic Event Engine

Use **Supabase pg_cron** for deadline enforcement. Create a cron job that runs every 30 minutes:

```sql
select cron.schedule('check-cell-deadlines', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://[PROJECT_REF].supabase.co/functions/v1/process-deadlines',
    headers := '{"Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb
  )
$$);
```

The Edge Function `process-deadlines` should:
1. Query all Cells where `stage_deadline < now()` and `status = 'ACTIVE'`
2. For each, call the appropriate stage-transition handler
3. Apply penalties, update roles, send notifications
4. Log all automated actions

Also create Edge Functions for:
- `elect-editor` — weighted random selection from `cell_members`
- `apply-penalty` — updates `merit_score`, logs to `penalty_log`, checks kick threshold
- `advance-stage` — transitions Cell to next stage, sets new deadline
- `send-notification` — sends email via Resend

---

## Role-Based Access Control

Enforce these rules at the database level (RLS) AND in Server Actions:

| Action | Who can do it |
|---|---|
| Create Cell | Any authenticated user |
| Join Cell | Any user with merit ≥ threshold |
| Publish Brief | Only current cycle EDITOR of that Cell |
| Invite to Brief | Only current cycle EDITOR |
| Submit article | Only invited WRITER for that brief |
| Review/accept submission | Only current cycle EDITOR |
| Assemble publication | Only current cycle EDITOR |
| Submit promotion evidence | Any ACTIVE member of that Cell |
| View Cell details | Any member; public summary for non-members |
| Edit strategy config | Only Cell owner (and only during FORMING) |
| Apply penalties | Only automated system (service role) |
| Override penalties | Nobody — penalties are automatic and final |

---

## Merit System

Merit is a single integer on `profiles.merit_score`, starting at 100.

**Merit gains:**
- +10 per accepted submission
- +5 per on-time promotion
- +15 for completing a cycle as Editor
- +3 per cycle completed as any role

**Merit losses (from `penalty_rules` in strategy_config):**
- Configurable per Cell, but defaults above in strategy config section

**Merit effects:**
- Below 60: Cannot join new Cells (configurable per Cell via `min_merit_to_join`)
- Below 40: Account flagged; can only participate in open/unrestricted Cells
- Displayed publicly on profile

Show merit history as a log (`merit_history` jsonb array) on the user's profile.

---

## Pages to Build

### Public / Auth
- `/` — Landing page. Explain the concept. CTA to sign up.
- `/login` and `/signup` — Supabase Auth (email/password + magic link)

### Dashboard (authenticated)
- `/dashboard` — User's active Cells, pending actions, merit score, notifications
- `/cells` — Browse all FORMING cells (joinable)
- `/cells/new` — Create a new Cell (choose strategy, configure it)

### Cell Pages
- `/cells/[slug]` — Cell overview: current stage, members, timeline, public publication feed
- `/cells/[slug]/brief` — Current Brief (visible to members)
- `/cells/[slug]/submit` — Submission form (Writers only, during SUBMISSION stage)
- `/cells/[slug]/edit` — Editorial workspace (Editor only, during EDITING stage): review submissions, assemble publication
- `/cells/[slug]/publication/[cycle]` — Published e-zine for that cycle
- `/cells/[slug]/promote` — Promotion evidence submission (during PROMOTION stage)
- `/cells/[slug]/settings` — Strategy config editor (owner only, during FORMING)

### Profile
- `/profile/[username]` — Public profile: merit score, history, cells participated in, publications contributed to

---

## UI Design Direction

The aesthetic is **editorial brutalism** — think a serious, slightly austere editorial tool. Not sterile, not playful. Purposeful. Like the inside of a well-designed independent magazine's CMS crossed with a constraint-based game.

- **Font pairing**: `DM Serif Display` for headings + `IBM Plex Mono` for UI labels and metadata. Body text in `Source Serif 4`.
- **Colour palette**: Off-white `#F5F2EC` background. Near-black `#1A1A18` text. A single accent: deep red `#C0392B` for deadlines, warnings, active states. Muted olive `#7A7A5A` for secondary UI.
- **Layout**: Generous white space. Strong typographic hierarchy. No rounded corners. Borders, not shadows. Tables for data.
- **Stage indicator**: A horizontal timeline bar at the top of every Cell page showing the current stage. Past stages greyed. Current stage in accent red. Future stages outlined only.
- **Deadline counter**: Always visible when a stage is active. Show days/hours remaining. Turn red below 24h. Pulse animation when under 6h.
- **Penalty/merit indicators**: Show merit score as a number with a small trend indicator (↑↓). Penalty log in monospace table.
- **No modals for critical actions** — use full-page or dedicated route instead.
- Use Tailwind CSS throughout. No component library.

---

## Key Implementation Notes

1. **Strategy abstraction**: Define a `StrategyEngine` interface in `/lib/strategies/types.ts`. Implement `EzineStrategy` in `/lib/strategies/ezine.ts`. The Cell lifecycle runner calls `strategy.getNextStage()`, `strategy.applyDeadlinePenalty()`, etc. This makes adding new strategies clean.

2. **Automated events are immutable**: Once a penalty is applied or an editor elected, it cannot be reversed through the UI. The owner has no override. This is by design and enforces the platform's philosophy.

3. **Server Actions for all mutations**: Put all mutation logic in `/app/actions/`. Validate input with Zod. Check RLS and role inside every action before touching the DB.

4. **Optimistic UI is fine for reads**: Cell members list, submission status, etc. can use Supabase Realtime subscriptions on the client for live updates.

5. **Notifications are non-blocking**: Email sends (via Resend) happen in Edge Functions after state transitions, never in the critical path of a Server Action.

6. **File uploads**: Submissions may be uploaded as `.txt`, `.md`, or `.docx` files OR pasted as rich text in a textarea. Store body as plain text in the DB. File URL is supplementary.

7. **Word count**: Enforce min/max on client (live counter) and server (reject submission if outside bounds).

8. **Cycle history**: Every cycle's brief, submissions, and publication are preserved and browseable. Never delete historical data.

9. **Error states**: Every automated action that fails (e.g. email bounce) must be logged to a `system_log` table and surfaced in an admin view at `/admin/log` (accessible only to users where `profiles.is_admin = true`).

10. **Environment variables needed**:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
```

---

## File Structure

```
/app
  /actions          — Server Actions (cells, briefs, submissions, publications, members)
  /admin
  /cells
    /[slug]
      /brief
      /edit
      /promote
      /publication/[cycle]
      /settings
      /submit
  /dashboard
  /login
  /profile/[username]
  /signup
/components
  /cell             — CellCard, StageTimeline, MemberList, DeadlineCounter
  /brief            — BriefCard, BriefForm
  /submission       — SubmissionForm, SubmissionCard, EditorReviewPanel
  /publication      — PublicationView, ArticleCard, CoverImage
  /ui               — Button, Input, Badge, Table, Toast (no library — hand-built)
/lib
  /strategies
    types.ts         — StrategyEngine interface
    ezine.ts         — EzineStrategy implementation
    index.ts         — registry of all strategies
  /supabase
    client.ts        — browser client
    server.ts        — server client (for Server Actions)
    admin.ts         — service role client (for Edge Functions only)
  /merit.ts          — merit calculation helpers
  /notifications.ts  — Resend email helpers
/supabase
  /functions
    process-deadlines/
    elect-editor/
    apply-penalty/
    advance-stage/
    send-notification/
  /migrations        — all SQL migrations in order
```

---

## What to Build First (in order)

1. **Supabase project setup**: All migrations, RLS policies, pg_cron job, seed the `strategy_templates` table with EZINE_V1.
2. **Auth**: Signup, login, profile creation on first login.
3. **Strategy engine**: `StrategyEngine` interface + `EzineStrategy` class.
4. **Cell CRUD**: Create cell, browse cells, join cell.
5. **Stage machine**: `advance-stage` Edge Function + deadline checker cron.
6. **Editor election**: `elect-editor` Edge Function.
7. **Brief + Invitation flow**: Editor publishes brief, invites members.
8. **Submission flow**: Writer submits article, editor reviews.
9. **Publication assembly**: Editor accepts/rejects, assembles publication, publishes.
10. **Promotion flow**: Members submit evidence links.
11. **Merit system**: Apply gains/penalties, display on profile.
12. **UI polish**: Stage timeline, deadline counter, merit indicators.
13. **Notifications**: Email triggers on key events.
14. **Admin log view**.

---

## Philosophy (read this — it should inform every design decision)

The platform is built around **constraint as a feature, not a limitation**. The automated system is the authority. No member, including the Cell owner, can override an automated penalty or deadline. The UI should communicate this clearly and unapologetically. There is no "are you sure?" when a deadline passes and a penalty fires. It simply happens, is logged, and is visible to all.

Discussion between members is not facilitated by the platform. There is no group chat, no comment thread on submissions (except the Editor's note on a returned submission). The only communication channel is the structured one: Brief → Submission → Editor note → Resubmission. This is deliberate.

The Editor is not a manager. They are a servant of the brief. Their authority is real but narrow: they can shape the brief, select submissions, and return work with guidance. They cannot extend their own deadline or escape their own penalty obligations.

Every UI decision should reinforce this: the process is larger than any individual. The deadlines are not suggestions. The merit system is memory.
