import { useMemo, useState } from 'react'
import { push, ref, remove, set } from 'firebase/database'
import { useAuth } from '../context/AuthContext'
import { useStatuses } from '../hooks/useStatuses'
import { ROLES } from '../constants'
import { db } from '../lib/firebase'

export default function AdminStatuses() {
  const { user, profile } = useAuth()
  const { statuses, loading, error } = useStatuses()

  const isAdmin =
    String(profile?.role ?? '').trim().toLowerCase() === ROLES.ADMIN

  const [statusLabel, setStatusLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingStatusId, setDeletingStatusId] = useState('')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')

  const statusesTable = useMemo(() => statuses ?? [], [statuses])

  async function handleCreate(e) {
    e.preventDefault()
    setMessage('')
    setFormError('')

    if (!user) {
      setFormError('You must be logged in.')
      return
    }
    if (!isAdmin) {
      setFormError(
        `Current role is "${profile?.role ?? 'missing'}". Set users/${user.uid}/role to "admin" and sign out/in.`,
      )
      return
    }

    const label = statusLabel.trim()
    if (!label) {
      setFormError('Status label is required.')
      return
    }

    setSubmitting(true)
    try {
      const newRef = push(ref(db, 'statuses'))
      await set(newRef, {
        label,
        createdAt: Date.now(),
        createdByAdminUid: user.uid,
      })
      setStatusLabel('')
      setMessage('Status added.')
    } catch (err) {
      setFormError(err?.message ?? 'Could not add status.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(statusId, statusLabelValue) {
    setMessage('')
    setFormError('')
    if (!isAdmin) {
      setFormError('Only admin can delete statuses.')
      return
    }
    const ok = window.confirm(
      `Delete status "${statusLabelValue || statusId}"? This cannot be undone.`,
    )
    if (!ok) return

    setDeletingStatusId(statusId)
    try {
      await remove(ref(db, `statuses/${statusId}`))
      setMessage('Status deleted.')
    } catch (err) {
      setFormError(err?.message ?? 'Could not delete status.')
    } finally {
      setDeletingStatusId('')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Status master</h1>
        <p className="mt-1 text-sm text-slate-400">
          Admin adds lead statuses here. Teams will use these while creating
          and updating leads.
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm">
        <p className="text-slate-400">
          Current UID:{' '}
          <code className="font-mono text-blue-300">{user?.uid || '-'}</code>
        </p>
        <p className="mt-1 text-slate-400">
          Current role:{' '}
          <code className="text-blue-300">{profile?.role || 'missing'}</code>
        </p>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-medium text-white">Add status</h2>

        <form onSubmit={handleCreate} className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300">
              Status label
            </label>
            <input
              type="text"
              required
              value={statusLabel}
              onChange={(e) => setStatusLabel(e.target.value)}
              placeholder="e.g. In Process"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              disabled={!isAdmin || submitting}
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3">
            {formError && <p className="text-sm text-red-300">{formError}</p>}
            {message && <p className="text-sm text-emerald-300">{message}</p>}
            <button
              type="submit"
              disabled={!isAdmin || submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add status'}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-auto text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Label</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">UID</th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Loading statuses...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Could not read statuses.
                  </td>
                </tr>
              ) : statusesTable.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    No statuses yet.
                  </td>
                </tr>
              ) : (
                statusesTable.map((s) => (
                  <tr key={s.id} className="text-slate-300">
                    <td className="px-4 py-3 text-white">{s.label || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {s.id}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id, s.label)}
                        disabled={!isAdmin || deletingStatusId === s.id}
                        className="rounded-lg border border-red-800/60 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingStatusId === s.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
