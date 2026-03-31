import { useMemo, useState } from 'react'
import { push, ref, remove, set } from 'firebase/database'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../hooks/useProducts'
import { ROLES, ROLE_LABELS } from '../constants'
import { db } from '../lib/firebase'

export default function AdminProducts() {
  const { user, profile } = useAuth()
  const { products, loading, error } = useProducts()

  const isAdmin = String(profile?.role ?? '').trim().toLowerCase() === ROLES.ADMIN

  const [productName, setProductName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState('')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')

  const productsTable = useMemo(() => products ?? [], [products])

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

    const name = productName.trim()
    if (!name) {
      setFormError('Product name is required.')
      return
    }

    setSubmitting(true)
    try {
      const newRef = push(ref(db, 'products'))
      await set(newRef, {
        name,
        createdAt: Date.now(),
        createdByAdminUid: user.uid,
      })
      setProductName('')
      setMessage('Product added.')
    } catch (err) {
      setFormError(err?.message ?? 'Could not add product.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(productId, productLabel) {
    setMessage('')
    setFormError('')
    if (!isAdmin) {
      setFormError('Only admin can delete products.')
      return
    }
    const ok = window.confirm(
      `Delete product "${productLabel || productId}"? This cannot be undone.`,
    )
    if (!ok) return

    setDeletingProductId(productId)
    try {
      await remove(ref(db, `products/${productId}`))
      setMessage('Product deleted.')
    } catch (err) {
      setFormError(err?.message ?? 'Could not delete product.')
    } finally {
      setDeletingProductId('')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Product master</h1>
        <p className="mt-1 text-sm text-slate-400">
          Admin adds products here. Sales will see them while creating leads.
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-medium text-white">Add product</h2>

        <form onSubmit={handleCreate} className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300">
              Product name
            </label>
            <input
              type="text"
              required
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. CRM Subscription"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              disabled={!isAdmin || submitting}
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3">
            {formError && (
              <p className="text-sm text-red-300">{formError}</p>
            )}
            {message && (
              <p className="text-sm text-emerald-300">{message}</p>
            )}
            <button
              type="submit"
              disabled={!isAdmin || submitting}
              className="rounded-lg bg-[#3388AB] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add product'}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 table-auto text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Product</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">UID</th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Loading products...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Could not read products.
                  </td>
                </tr>
              ) : productsTable.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    No products yet.
                  </td>
                </tr>
              ) : (
                productsTable.map((p) => (
                  <tr key={p.id} className="text-slate-300">
                    <td className="px-4 py-3 text-white">
                      {p.name || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {p.id}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id, p.name)}
                        disabled={!isAdmin || deletingProductId === p.id}
                        className="rounded-lg border border-red-800/60 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingProductId === p.id ? 'Deleting...' : 'Delete'}
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

