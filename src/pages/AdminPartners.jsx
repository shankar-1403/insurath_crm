import { useMemo, useState } from 'react'
import { push, ref, remove, set } from 'firebase/database'
import { useAuth } from '../context/AuthContext'
import { usePartners } from '../hooks/usePartners'
import { ROLES } from '../constants'
import { db } from '../lib/firebase'

export default function AdminPartners() {
  const { user, profile } = useAuth()
  const { partners, loading, error } = usePartners()

  const isAdmin =
    String(profile?.role ?? '').trim().toLowerCase() === ROLES.ADMIN

  const [partnerName, setPartnerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingPartnerId, setDeletingPartnerId] = useState('')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')

  const partnersTable = useMemo(() => partners ?? [], [partners])

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
        `Current role is "${profile?.role ?? 'missing'}". Only admin can manage partners.`,
      )
      return
    }

    const name = partnerName.trim()
    if (!name) {
      setFormError('Partner name is required.')
      return
    }

    setSubmitting(true)
    try {
      const newRef = push(ref(db, 'partners'))
      await set(newRef, {
        name,
        createdAt: Date.now(),
        createdByAdminUid: user.uid,
      })
      setPartnerName('')
      setMessage('Partner added.')
    } catch (err) {
      setFormError(err?.message ?? 'Could not add partner.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(partnerId, label) {
    setMessage('')
    setFormError('')
    if (!isAdmin) {
      setFormError('Only admin can delete partners.')
      return
    }
    const ok = window.confirm(
      `Delete partner "${label || partnerId}"? Partner users linked to this ID will stop matching leads until updated.`,
    )
    if (!ok) return

    setDeletingPartnerId(partnerId)
    try {
      await remove(ref(db, `partners/${partnerId}`))
      setMessage('Partner deleted.')
    } catch (err) {
      setFormError(err?.message ?? 'Could not delete partner.')
    } finally {
      setDeletingPartnerId('')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Partner master</h1>
        <p className="mt-1 text-sm text-slate-400">
          Admin adds partner organizations here. Management uses them on leads;
          partner logins see only leads tagged with their linked partner.
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm">
        <p className="text-slate-400">
          Current UID:{' '}
          <code className="font-mono text-blue-300">{user?.uid || '—'}</code>
        </p>
        <p className="mt-1 text-slate-400">
          Current role:{' '}
          <code className="text-blue-300">{profile?.role || 'missing'}</code>
        </p>
        {error && (
          <p className="mt-2 text-sm text-red-300">
            Could not load partners: {String(error?.message ?? error)}
          </p>
        )}
        {!isAdmin && (
          <p className="mt-2 rounded-lg border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
            This account cannot edit partners. Sign in as admin.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-medium text-white">Add partner</h2>
        <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm font-medium text-slate-300">
              Partner name
            </label>
            <input
              type="text"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              placeholder="e.g. Acme Finance"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {formError && <p className="text-sm text-red-300">{formError}</p>}
            {message && <p className="text-sm text-emerald-300">{message}</p>}
            <button
              type="submit"
              disabled={submitting || !isAdmin}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Add partner'}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-300">Partners</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] table-auto text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Partner ID</th>
                <th className="px-4 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : partnersTable.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    No partners yet. Add one above.
                  </td>
                </tr>
              ) : (
                partnersTable.map((p) => (
                  <tr key={p.id} className="text-slate-300">
                    <td className="px-4 py-2 text-white">{p.name || '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {p.id}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id, p.name)}
                        disabled={!isAdmin || deletingPartnerId === p.id}
                        className="rounded-lg border border-red-800/60 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                      >
                        {deletingPartnerId === p.id ? 'Deleting…' : 'Delete'}
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
