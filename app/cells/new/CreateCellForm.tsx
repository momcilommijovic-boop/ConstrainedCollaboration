'use client'

import { useFormState } from 'react-dom'
import { createCell } from '@/app/actions/cells'
import { Input } from '@/components/ui/Input'
import { SubmitButton } from '@/components/ui/Button'

export function CreateCellForm() {
  const [state, action] = useFormState(createCell, { error: null })

  return (
    <form action={action} className="flex flex-col gap-6">
      {/* ── Identity ──────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-5 border border-near-black/20 px-5 py-5">
        <legend className="font-mono text-xs uppercase tracking-widest text-olive px-1">
          Identity
        </legend>
        <Input
          label="Title"
          name="title"
          type="text"
          placeholder="e.g. The Obsidian Review"
          required
        />
        <div className="flex flex-col gap-1">
          <label
            htmlFor="description"
            className="font-mono text-xs uppercase tracking-widest text-olive"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={500}
            placeholder="What is this Cell about? What kind of writing are you after?"
            className="border border-near-black/30 focus:border-near-black font-body text-sm px-3 py-2 bg-off-white text-near-black placeholder:text-olive/60 resize-y transition-colors duration-100"
          />
        </div>
      </fieldset>

      {/* ── Membership ────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-5 border border-near-black/20 px-5 py-5">
        <legend className="font-mono text-xs uppercase tracking-widest text-olive px-1">
          Membership
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Member cap"
            name="member_cap"
            type="number"
            min={2}
            max={20}
            defaultValue={8}
            hint="Max members (2–20)"
            required
          />
          <Input
            label="Min to start"
            name="min_members"
            type="number"
            min={2}
            max={20}
            defaultValue={4}
            hint="Minimum to begin"
            required
          />
        </div>
        <Input
          label="Min merit to join"
          name="min_merit_to_join"
          type="number"
          min={0}
          max={100}
          defaultValue={50}
          hint="Merit score required (0 = open to all)"
          required
        />
      </fieldset>

      {/* ── Content rules ─────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-5 border border-near-black/20 px-5 py-5">
        <legend className="font-mono text-xs uppercase tracking-widest text-olive px-1">
          Content rules
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Min word count"
            name="word_count_min"
            type="number"
            min={50}
            max={5000}
            defaultValue={400}
            required
          />
          <Input
            label="Max word count"
            name="word_count_max"
            type="number"
            min={100}
            max={10000}
            defaultValue={1200}
            required
          />
        </div>
      </fieldset>

      {/* ── Timing ────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-5 border border-near-black/20 px-5 py-5">
        <legend className="font-mono text-xs uppercase tracking-widest text-olive px-1">
          Timing
        </legend>
        <Input
          label="Forming timeout (days)"
          name="forming_timeout_days"
          type="number"
          min={1}
          max={60}
          defaultValue={14}
          hint="Cell is abandoned if not filled within this window"
          required
        />
        <p className="font-mono text-xs text-olive">
          Briefing, submission, editing, and promotion windows can be adjusted in Cell settings
          after creation.
        </p>
      </fieldset>

      {state?.error && (
        <p className="font-mono text-xs text-accent-red border border-accent-red px-3 py-2">
          {state?.error}
        </p>
      )}

      <SubmitButton className="self-start px-8">Create Cell →</SubmitButton>
    </form>
  )
}
