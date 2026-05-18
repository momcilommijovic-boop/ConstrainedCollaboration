'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useState } from 'react'
import { adjustMeritManually, toggleAdmin, suspendUser, deleteAccount } from '@/app/actions/admin'

function ActionButton({
  label,
  pendingLabel,
  danger,
}: {
  label: string
  pendingLabel: string
  danger?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`font-mono text-xs px-4 py-2 transition-colors disabled:opacity-40 ${
        danger
          ? 'bg-accent-red text-off-white hover:opacity-80'
          : 'border border-near-black/20 hover:bg-near-black hover:text-off-white'
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  )
}

interface Props {
  userId: string
  username: string
  isAdmin: boolean
  isSuspended: boolean
  showDelete?: boolean
}

export function AdminUserActions({
  userId,
  username,
  isAdmin,
  isSuspended,
  showDelete = false,
}: Props) {
  const [meritState, meritAction] = useFormState(adjustMeritManually, { error: null })
  const [adminState, adminAction] = useFormState(toggleAdmin, { error: null })
  const [suspendState, suspendAction] = useFormState(suspendUser, { error: null })
  const [deleteState, deleteAction] = useFormState(deleteAccount, { error: null })
  const [deleteConfirm, setDeleteConfirm] = useState('')

  if (showDelete) {
    return (
      <div className="space-y-4">
        {deleteState.error && (
          <p className="font-mono text-xs text-accent-red">{deleteState.error}</p>
        )}
        <form action={deleteAction} className="space-y-3">
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="expected_username" value={username} />
          <div>
            <label className="font-mono text-xs text-olive mb-2 block">
              Type <span className="text-near-black">{username}</span> to permanently delete this account
            </label>
            <input
              type="text"
              name="confirm_username"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={username}
              autoComplete="off"
              className="w-full max-w-xs border border-near-black/20 bg-transparent px-3 py-2 font-mono text-xs focus:outline-none focus:border-accent-red"
            />
          </div>
          <button
            type="submit"
            disabled={deleteConfirm !== username}
            className="font-mono text-xs bg-accent-red text-off-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            Delete account permanently
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Merit adjustment */}
      <div>
        <p className="font-mono text-xs text-olive mb-3">Adjust Merit</p>
        {meritState.error && (
          <p className="font-mono text-xs text-accent-red mb-2">{meritState.error}</p>
        )}
        {meritState.error === null && meritState !== null && (
          <p className="font-mono text-xs text-olive mb-2">Saved.</p>
        )}
        <form action={meritAction} className="flex items-start gap-2">
          <input type="hidden" name="user_id" value={userId} />
          <input
            type="number"
            name="delta"
            placeholder="±pts"
            min={-100}
            max={100}
            className="w-20 border border-near-black/20 bg-transparent px-3 py-2 font-mono text-xs focus:outline-none focus:border-near-black"
          />
          <input
            type="text"
            name="reason"
            placeholder="Reason (required)"
            maxLength={120}
            className="flex-1 border border-near-black/20 bg-transparent px-3 py-2 font-mono text-xs focus:outline-none focus:border-near-black"
          />
          <ActionButton label="Apply" pendingLabel="Applying…" />
        </form>
      </div>

      {/* Toggle admin */}
      <div className="flex items-center gap-4">
        {adminState.error && (
          <p className="font-mono text-xs text-accent-red">{adminState.error}</p>
        )}
        <form action={adminAction}>
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="make_admin" value={isAdmin ? 'false' : 'true'} />
          <ActionButton
            label={isAdmin ? 'Revoke admin' : 'Grant admin'}
            pendingLabel="Updating…"
          />
        </form>

        {/* Suspend/unsuspend */}
        {suspendState.error && (
          <p className="font-mono text-xs text-accent-red">{suspendState.error}</p>
        )}
        <form action={suspendAction}>
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="unsuspend" value={isSuspended ? 'true' : 'false'} />
          <ActionButton
            label={isSuspended ? 'Unsuspend' : 'Suspend'}
            pendingLabel="Updating…"
            danger={!isSuspended}
          />
        </form>
      </div>
    </div>
  )
}
