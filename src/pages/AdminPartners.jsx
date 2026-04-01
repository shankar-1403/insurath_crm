import { useMemo, useState } from 'react'
import { push, ref, remove, set } from 'firebase/database'
import { useAuth } from '../context/AuthContext'
import { usePartners } from '../hooks/usePartners'
import { ROLES } from '../constants'
import { db } from '../lib/firebase'

function partnerLabel(p, partnersById) {
  if (!p?.viaPartnerId) return 'Self'
  const linked = partnersById[p.viaPartnerId]
  return linked?.name || p.viaPartnerId
}

export default function AdminPartners() {
  const { user, profile } = useAuth()
  const { partners, loading, error } = usePartners()
  const isAdmin = String(profile?.role ?? '').trim().toLowerCase() === ROLES.ADMIN

  const [partnerName, setPartnerName] = useState('')
  const [posId, setPosId] = useState('')
  const [viaPartnerId, setViaPartnerId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingPartnerId, setDeletingPartnerId] = useState('')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')

  const partnersTable = useMemo(() => partners ?? [], [partners])

  const partnersById = useMemo(() => {
    const m = {}
    for (const p of partnersTable) m[p.id] = p
    return m
  }, [partnersTable])

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

    const name = partnerName.trim()
    const pos = posId.trim()
    if (!name) {
      setFormError('Partner name is required.')
      return
    }
    if (!pos) {
      setFormError('POS ID is required.')
      return
    }

    setSubmitting(true)
    try {
      const newRef = push(ref(db, 'partners'))
      await set(newRef, {
        name,
        posId: pos,
        viaPartnerId: viaPartnerId || null,
        createdAt: Date.now(),
        createdByAdminUid: user.uid,
      })
      setPartnerName('')
      setPosId('')
      setViaPartnerId('')
      setMessage('Partner added.')
    } catch (err) {
      setFormError(err?.message ?? 'Could not add partner.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(partnerId, partnerLabel) {
    setMessage('')
    setFormError('')
    if (!isAdmin) {
      setFormError('Only admin can delete partners.')
      return
    }
    const ok = window.confirm(
      `Delete partner "${partnerLabel || partnerId}"? This cannot be undone.`,
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
          Admin adds partners with POS ID and optional “via” link. Teams pick partners when creating leads.
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-medium text-white">Add partner</h2>

        <form onSubmit={handleCreate} className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-300">
              POS name
            </label>
            <input
              type="text"
              required
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="e.g. ABC Agency"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              disabled={!isAdmin || submitting}
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-300">POS ID</label>
            <input
              type="text"
              required
              value={posId}
              onChange={(e) => setPosId(e.target.value)}
              placeholder="e.g. POS-10042"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              disabled={!isAdmin || submitting}
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-300">Source</label>
            <select
              value={viaPartnerId}
              onChange={(e) => setViaPartnerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              disabled={!isAdmin || submitting}
            >
              <option value="">Self</option>
              {partnersTable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.id}
                  {p.posId || p.pos_id ? ` (${p.posId ?? p.pos_id})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3 flex flex-wrap items-center justify-end gap-3">
            {formError && <p className="text-sm text-red-300">{formError}</p>}
            {message && <p className="text-sm text-emerald-300">{message}</p>}
            <button
              type="submit"
              disabled={!isAdmin || submitting}
              className="rounded-lg bg-[#3388AB] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add partner'}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 table-auto text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Partner</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">POS ID</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Source Name</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">UID</th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Loading partners...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Could not read partners.
                  </td>
                </tr>
              ) : partnersTable.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No partners yet.
                  </td>
                </tr>
              ) : (
                partnersTable.map((p) => (
                  <tr key={p.id} className="text-slate-300">
                    <td className="px-4 py-3 text-white">{p.name || '—'}</td>
                    <td className="px-4 py-3 text-white">
                      {p.posId ?? p.pos_id ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {partnerLabel(p, partnersById)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {p.id}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id, p.name)}
                        disabled={!isAdmin || deletingPartnerId === p.id}
                        className="rounded-lg border border-red-800/60 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingPartnerId === p.id ? 'Deleting...' : 'Delete'}
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
