import { useMemo, useState } from 'react'
import { ref, serverTimestamp, update } from 'firebase/database'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useLeads } from '../hooks/useLeads'
import { usePartners } from '../hooks/usePartners'
import { useUsers } from '../hooks/useUsers'
import { assignedUids } from '../lib/leads'
import { useProducts } from '../hooks/useProducts'
import { useStatuses } from '../hooks/useStatuses'
import LeadDetailsModal from '../components/LeadDetailsModal'
import AmountInWordsHint from '../components/AmountInWordsHint'
import { downloadCsv, inDateRange } from '../lib/csv'

export default function ProcessBoard() {
  const { user } = useAuth()
  const { products, loading: productsLoading, error: productsError } = useProducts()
  const { statuses } = useStatuses()
  const { partners } = usePartners()
  const { leads, loading } = useLeads()
  const { usersById } = useUsers()
  const [leadSearch, setLeadSearch] = useState('')
  const [viewLead, setViewLead] = useState(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [editLeadId, setEditLeadId] = useState(null)
  const [editForm, setEditForm] = useState({
    partnerId: '',
    partnerName: '',
    company: '',
    clientName: '',
    location: '',
    bankName: '',
    onePagerLink: '',
    leadDate: '',
    description: '',
    status: '',
    productId: '',
    totalAmount: '',
    bankPayoutPercent: '',
    mandateSigned: false,
    mandatePayoutPercent: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  const assignedToMe = useMemo(() => {
    if (!user) return []
    return leads.filter((l) => {
      const uids = assignedUids(l.assignedTo)
      return uids.includes(user.uid)
    })
  }, [leads, user])

  const filteredAssignedToMe = useMemo(() => {
    const term = leadSearch.trim().toLowerCase()
    let list = assignedToMe
    if (term) {
      list = list.filter((l) => {
        const company = String(l.company ?? '').toLowerCase()
        const clientName = String(l.clientName ?? '').toLowerCase()
        return company.includes(term) || clientName.includes(term)
      })
    }
    list = list.filter((l) => inDateRange(l.leadDate || '', fromDate, toDate))
    return list
  }, [assignedToMe, leadSearch, fromDate, toDate])

  function openEdit(lead) {
    setEditLeadId(lead.id)
    setEditForm({
      partnerId: lead.partnerId ?? '',
      partnerName: lead.partnerName ?? '',
      company: lead.company ?? '',
      clientName: lead.clientName ?? '',
      location: lead.location ?? '',
      bankName: lead.bankName ?? '',
      onePagerLink: lead.onePagerLink ?? '',
      leadDate: lead.leadDate ?? '',
      description: lead.description ?? '',
      status: lead.status ?? '',
      productId: lead.productId ?? '',
      totalAmount: lead.totalAmount ?? '',
      bankPayoutPercent: lead.bankPayoutPercent ?? '',
      mandateSigned: Boolean(lead.mandateSigned),
      mandatePayoutPercent: lead.mandatePayoutPercent ?? '',
    })
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editLeadId) return
    setSavingEdit(true)
    try {
      const baseAmount = Number.parseFloat(editForm.totalAmount || 0) || 0
      const bankPercent = Number.parseFloat(editForm.bankPayoutPercent || 0) || 0
      const mandatePercent =
        Number.parseFloat(editForm.mandatePayoutPercent || 0) || 0
      const bankPayoutAmount = (baseAmount * bankPercent) / 100
      const mandatePayoutAmount = editForm.mandateSigned
        ? (baseAmount * mandatePercent) / 100
        : 0

      await update(ref(db, `leads/${editLeadId}`), {
        partnerId: editForm.partnerId || null,
        partnerName: editForm.partnerName || '',
        company: editForm.company.trim(),
        clientName: editForm.clientName.trim(),
        location: editForm.location.trim(),
        bankName: editForm.bankName.trim(),
        onePagerLink: editForm.onePagerLink.trim(),
        leadDate: editForm.leadDate || '',
        description: editForm.description.trim(),
        status: editForm.status || '',
        productId: editForm.productId || null,
        totalAmount: editForm.totalAmount || '',
        bankPayoutPercent: editForm.bankPayoutPercent || '',
        bankPayoutAmount: Number(bankPayoutAmount.toFixed(2)),
        mandateSigned: Boolean(editForm.mandateSigned),
        mandatePayoutPercent: editForm.mandateSigned
          ? editForm.mandatePayoutPercent || ''
          : '',
        mandatePayoutAmount: Number(mandatePayoutAmount.toFixed(2)),
        updatedAt: serverTimestamp(),
      })
      setEditLeadId(null)
    } finally {
      setSavingEdit(false)
    }
  }

  function partnerNameFor(partnerId, fallbackName = '') {
    if (fallbackName) return fallbackName
    if (!partnerId) return '—'
    const p = partners.find((item) => item.id === partnerId)
    return p?.name || partnerId
  }

  const currentUserName = user?.uid
    ? usersById[user.uid]?.displayName || usersById[user.uid]?.email || 'You'
    : 'You'
  const editBaseAmount = Number.parseFloat(editForm.totalAmount || 0) || 0
  const editBankPercent = Number.parseFloat(editForm.bankPayoutPercent || 0) || 0
  const editMandatePercent =
    Number.parseFloat(editForm.mandatePayoutPercent || 0) || 0
  const editBankAmount = (editBaseAmount * editBankPercent) / 100
  const editMandateAmount = editForm.mandateSigned
    ? (editBaseAmount * editMandatePercent) / 100
    : 0
  const editTotalRevenue = editBankAmount + editMandateAmount

  const statusOptions = useMemo(() => {
    return [
      { value: '', label: 'Select Status' },
      ...statuses
        .filter((s) => String(s?.id ?? '').trim() && String(s?.label ?? '').trim())
        .map((s) => ({ value: String(s.id).trim(), label: String(s.label).trim() })),
    ]
  }, [statuses])

  const statusLabelByValue = useMemo(() => {
    const m = new Map()
    statusOptions.forEach((s) => {
      if (s.value) m.set(s.value, s.label)
    })
    return m
  }, [statusOptions])

  function statusLabelFor(status) {
    return statusLabelByValue.get(status) || status || '—'
  }

  if (loading) {
    return <p className="text-slate-400">Loading…</p>
  }

  function exportCsv() {
    const rows = filteredAssignedToMe
      .filter((lead) => inDateRange(lead.leadDate || '', fromDate, toDate))
      .map((lead) => [
        partnerNameFor(lead.partnerId, lead.partnerName),
        lead.company || '',
        lead.clientName || '',
        lead.location || '',
        lead.bankName || '',
        lead.onePagerLink || '',
        products.find((p) => p.id === lead.productId)?.name || '',
        lead.leadDate || '',
        usersById[lead.createdBy]?.displayName || usersById[lead.createdBy]?.email || '',
        assignedUids(lead.assignedTo)
          .map((uid) => usersById[uid]?.displayName || usersById[uid]?.email || uid.slice(0, 8))
          .join(', '),
        lead.status || '',
      ])

    downloadCsv(
      'process-leads.csv',
      [
        'Partner',
        'Company',
        'Client Name',
        'Location',
        'Bank Name',
        'One Pager',
        'Product',
        'Lead Date',
        'Sales Owner',
        'Processed By',
        'Status',
      ],
      rows,
    )
  }

  return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Assigned to {currentUserName}</h1>
            
            <p className="mt-1 text-sm text-slate-400">
              Leads the sales team assigned to you. Update status as you work them.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:w-[320px]">
            <label
              htmlFor="search-company-process"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Search company
            </label>
            <input
              id="search-company-process"
              type="text"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              placeholder="Type company name..."
              className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="flex gap-2">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              type="button"
              onClick={exportCsv}
              className="mt-5 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              Export CSV
            </button>
          </div>
        </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1440px] table-auto text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Partner</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Company</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Client name</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Location</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Product</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Lead date</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Updated status date</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Sales owner</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Processed by</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Status</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredAssignedToMe.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                    No leads assigned to you yet.
                  </td>
                </tr>
              ) : (
                filteredAssignedToMe.map((lead) => (
                  <tr key={lead.id} className="text-slate-300">
                    <td className="px-4 py-1 text-slate-400">
                      {partnerNameFor(lead.partnerId, lead.partnerName)}
                    </td>
                    <td className="px-4 py-1 text-slate-400">{lead.company || '—'}</td>
                    <td className="px-4 py-1 text-slate-400">{lead.clientName || '—'}</td>
                    <td className="px-4 py-1 text-slate-400">{lead.location || '—'}</td>
                    <td className="px-4 py-1 text-slate-400">
                      {products.find((p) => p.id === lead.productId)?.name || '—'}
                    </td>
                    <td className="px-4 py-1 text-xs text-slate-500">
                      {lead.leadDate || '—'}
                    </td>
                    <td className="px-4 py-1 text-xs text-slate-500">
                      {lead.updatedStatusDate || '—'}
                    </td>
                    <td className="px-4 py-1 text-slate-400">
                      {usersById[lead.createdBy]?.displayName ||
                        usersById[lead.createdBy]?.email ||
                        '—'}
                    </td>
                    <td className="px-4 py-1 text-slate-400">
                      {assignedUids(lead.assignedTo)
                        .map(
                          (uid) =>
                            usersById[uid]?.displayName ||
                            usersById[uid]?.email ||
                            uid.slice(0, 8),
                        )
                        .join(', ') || '—'}
                    </td>
                    <td className="px-4 py-1 text-slate-400">
                      {statusLabelFor(lead.status)}
                    </td>
                    <td className="px-4 py-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(lead)}
                          className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewLead(lead)}
                          className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewLead && (
        <LeadDetailsModal
          lead={viewLead}
          usersById={usersById}
          showPartner={Boolean(viewLead.partnerId || viewLead.partnerName)}
          onClose={() => setViewLead(null)}
        />
      )}

      {editLeadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-6">
            <h2 className="text-lg font-semibold text-white">Edit lead</h2>
            <form onSubmit={saveEdit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Partner</label>
                <input
                  value={partnerNameFor(editForm.partnerId, editForm.partnerName)}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Company</label>
                <input
                  value={editForm.company}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, company: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Name of client</label>
                <input
                  value={editForm.clientName}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, clientName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Location</label>
                <input
                  value={editForm.location}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, location: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Bank Name</label>
                <input
                  value={editForm.bankName}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, bankName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">One pager link</label>
                <input
                  type="url"
                  value={editForm.onePagerLink}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, onePagerLink: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Date</label>
                <input
                  type="date"
                  value={editForm.leadDate}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, leadDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, status: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                >
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Product</label>
                <select
                  value={editForm.productId}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, productId: e.target.value }))
                  }
                  disabled={productsLoading || products.length === 0}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60"
                >
                  <option value="">
                    {productsLoading ? 'Loading products…' : 'Select product'}
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {productsError && (
                  <p className="mt-2 text-xs text-amber-200">
                    Could not load products.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Required Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.totalAmount}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, totalAmount: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
                <AmountInWordsHint value={editForm.totalAmount} />
              </div>
              <section className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-4">
                <h3 className="text-sm font-semibold text-blue-300">
                  Revenue Details
                </h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Bank Payout Percent (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.bankPayoutPercent}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          bankPayoutPercent: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editBankAmount.toFixed(2)}
                      readOnly
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-medium text-slate-300">Mandate Signed</p>
                  <div className="mt-2 flex items-center gap-5 text-sm text-slate-300">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="editMandateSigned"
                        checked={editForm.mandateSigned === true}
                        onChange={() =>
                          setEditForm((f) => ({ ...f, mandateSigned: true }))
                        }
                      />
                      Yes
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="editMandateSigned"
                        checked={editForm.mandateSigned === false}
                        onChange={() =>
                          setEditForm((f) => ({ ...f, mandateSigned: false }))
                        }
                      />
                      No
                    </label>
                  </div>
                </div>

                {editForm.mandateSigned && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Mandate Payout Percent (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.mandatePayoutPercent}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            mandatePayoutPercent: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editMandateAmount.toFixed(2)}
                        readOnly
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                )}
                <div className="mt-4 rounded-lg border border-emerald-700/50 bg-emerald-950/20 px-3 py-3 text-sm text-emerald-200">
                  <div className="flex justify-between">
                    <span>Bank Payout Amount:</span>
                    <span>₹{editBankAmount.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span>Mandate Amount:</span>
                    <span>₹{editMandateAmount.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 flex justify-between font-semibold">
                    <span>Total Revenue:</span>
                    <span>₹{editTotalRevenue.toFixed(2)}</span>
                  </div>
                </div>
              </section>
              <div>
                <label className="block text-sm font-medium text-slate-300">Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditLeadId(null)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
