'use client'

import { useFormState } from 'react-dom'
import { updateCellSettings } from '@/app/actions/cells'
import { Input } from '@/components/ui/Input'
import { SubmitButton } from '@/components/ui/Button'
import type { EzineStrategyConfig } from '@/lib/strategies/ezine'

type Props = {
  cellId: string
  title: string
  description: string | null
  memberCap: number
  minMembers: number
  currentMemberCount: number
  config: EzineStrategyConfig
}

export function CellSettingsForm({
  cellId,
  title,
  description,
  memberCap,
  minMembers,
  currentMemberCount,
  config,
}: Props) {
  const [state, action] = useFormState(updateCellSettings, { error: null })

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="cell_id" value={cellId} />

      {/* ── Identity ─────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-5 border border-near-black/20 px-5 py-5">
        <legend className="font-mono text-xs uppercase tracking-widest text-olive px-1">
          Identity
        </legend>
        <Input label="Title" name="title" type="text" defaultValue={title} required />
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
            defaultValue={description ?? ''}
            className="border border-near-black/30 focus:border-near-black font-body text-sm px-3 py-2 bg-off-white text-near-black placeholder:text-olive/60 resize-y transition-colors duration-100"
          />
        </div>
      </fieldset>

      {/* ── Membership ───────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-5 border border-near-black/20 px-5 py-5">
        <legend className="font-mono text-xs uppercase tracking-widest text-olive px-1">
          Membership
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Member cap"
            name="member_cap"
            type="number"
            min={Math.max(2, currentMemberCount)}
            max={20}
            defaultValue={memberCap}
            hint={`Current members: ${currentMemberCount}`}
            required
          />
          <Input
            label="Min to start"
            name="min_members"
            type="number"
            min={2}
            max={20}
            defaultValue={minMembers}
            hint="Minimum to begin Briefing"
            required
          />
        </div>
        <Input
          label="Min merit to join"
          name="min_merit_to_join"
          type="number"
          min={0}
          max={100}
          defaultValue={config.min_merit_to_join}
          hint="Merit score required (0 = open to all)"
          required
        />
      </fieldset>

      {/* ── Content rules ────────────────────────────────────── */}
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
            defaultValue={config.word_count_min}
            required
          />
          <Input
            label="Max word count"
            name="word_count_max"
            type="number"
            min={100}
            max={10000}
            defaultValue={config.word_count_max}
            required
          />
        </div>
      </fieldset>

      {/* ── Timing ───────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-5 border border-near-black/20 px-5 py-5">
        <legend className="font-mono text-xs uppercase tracking-widest text-olive px-1">
          Stage windows (days)
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Forming timeout"
            name="forming_timeout_days"
            type="number"
            min={1}
            max={60}
            defaultValue={config.forming_timeout_days}
            hint="Resets the forming deadline"
            required
          />
          <Input
            label="Briefing window"
            name="briefing_window_days"
            type="number"
            min={1}
            max={30}
            defaultValue={config.briefing_window_days}
            required
          />
          <Input
            label="Submission window"
            name="submission_window_days"
            type="number"
            min={1}
            max={30}
            defaultValue={config.submission_window_days}
            required
          />
          <Input
            label="Editing window"
            name="editing_window_days"
            type="number"
            min={1}
            max={30}
            defaultValue={config.editing_window_days}
            required
          />
          <Input
            label="Promotion window"
            name="promotion_window_days"
            type="number"
            min={1}
            max={30}
            defaultValue={config.promotion_window_days}
            required
          />
        </div>
      </fieldset>

      {state?.error && (
        <p className="font-mono text-xs text-accent-red border border-accent-red px-3 py-2">
          {state?.error}
        </p>
      )}

      <SubmitButton className="self-start px-8">Save settings →</SubmitButton>
    </form>
  )
}
