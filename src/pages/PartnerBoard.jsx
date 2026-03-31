import { useMemo, useState } from 'react'
import { push, ref, set, update } from 'firebase/database'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useLeads } from '../hooks/useLeads'
import { useUsers } from '../hooks/useUsers'
import { useProducts } from '../hooks/useProducts'
import { usePartners } from '../hooks/usePartners'
import { useStatuses } from '../hooks/useStatuses'
import { assignedUids, toAssignedMap } from '../lib/leads'
import { downloadCsv, formatAmountForCsv, inDateRange } from '../lib/csv'
import LeadDetailsModal from '../components/LeadDetailsModal'
import AmountInWordsHint from '../components/AmountInWordsHint'

const emptyForm = {
  title: '',
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
}

export default function PartnerBoard() {
  const { user, profile } = useAuth()
  const { leads, loading } = useLeads()
  const { usersById, processUsers, error: usersError } = useUsers()
  const { products, loading: productsLoading, error: productsError } = useProducts()
  const { partners } = usePartners()
  const { statuses } = useStatuses()

  const partnerId = String(profile?.partnerId ?? '').trim()
  const partnerName = useMemo(() => {
    if (!partnerId) return ''
    return partners.find((p) => p.id === partnerId)?.name || ''
  }, [partners, partnerId])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedAssignees, setSelectedAssignees] = useState([])
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [leadSearch, setLeadSearch] = useState('')
  const [viewLead, setViewLead] = useState(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const myLeads = useMemo(() => {
    if (!partnerId) return []
    return leads.filter((l) => String(l.partnerId ?? '').trim() === partnerId)
  }, [leads, partnerId])

  const filteredMyLeads = useMemo(() => {
    const term = leadSearch.trim().toLowerCase()
    let list = myLeads
    if (term) {
      list = list.filter((l) => {
        const company = String(l.company ?? '').toLowerCase()
        const clientName = String(l.clientName ?? '').toLowerCase()
        return company.includes(term) || clientName.includes(term)
      })
    }
    list = list.filter((l) => inDateRange(l.leadDate || '', fromDate, toDate))
    return list
  }, [myLeads, leadSearch, fromDate, toDate])

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

  function processNames(assignedTo) {
    const assignees = assignedUids(assignedTo)
    if (!assignees.length) return 'Unassigned'
    return assignees
      .map((uid) => {
        const u = usersById[uid]
        return u?.displayName || u?.email || uid.slice(0, 8)
      })
      .join(', ')
  }

  function productNameFor(productId) {
    if (!productId) return '—'
    const product = products.find((p) => p.id === productId)
    return product?.name || productId
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setSelectedAssignees([])
    setAssigneeDropdownOpen(false)
    setModalOpen(true)
  }

  function openEdit(lead) {
    setEditingId(lead.id)
    setForm({
      title: lead.title ?? '',
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
    setSelectedAssignees(assignedUids(lead.assignedTo))
    setAssigneeDropdownOpen(false)
    setModalOpen(true)
  }

  function toggleAssignee(uid) {
    setSelectedAssignees((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
    )
  }

  async function saveLead(e) {
    e.preventDefault()
    if (!user || !partnerId) return
    setSaving(true)
    try {
      const existingLead =
        editingId != null ? leads.find((l) => l.id === editingId) : null
      const baseAmount = Number.parseFloat(form.totalAmount || 0) || 0
      const bankPercent = Number.parseFloat(form.bankPayoutPercent || 0) || 0
      const mandatePercent =
        Number.parseFloat(form.mandatePayoutPercent || 0) || 0
      const bankPayoutAmount = (baseAmount * bankPercent) / 100
      const mandatePayoutAmount = form.mandateSigned
        ? (baseAmount * mandatePercent) / 100
        : 0

      const payload = {
        title: form.title.trim(),
        company: form.company.trim(),
        clientName: form.clientName.trim(),
        location: form.location.trim(),
        bankName: form.bankName.trim(),
        onePagerLink: form.onePagerLink.trim(),
        leadDate: form.leadDate || '',
        description: form.description.trim(),
        status: form.status,
        createdBy: existingLead?.createdBy ?? user.uid,
        assignedTo: toAssignedMap(selectedAssignees),
        productId: form.productId || null,
        totalAmount: form.totalAmount || '',
        bankPayoutPercent: form.bankPayoutPercent || '',
        bankPayoutAmount: Number(bankPayoutAmount.toFixed(2)),
        mandateSigned: Boolean(form.mandateSigned),
        mandatePayoutPercent: form.mandateSigned
          ? form.mandatePayoutPercent || ''
          : '',
        mandatePayoutAmount: Number(mandatePayoutAmount.toFixed(2)),
        updatedAt: Date.now(),
        partnerId,
        partnerName: partnerName || '',
      }
      if (editingId) {
        await update(ref(db, `leads/${editingId}`), payload)
      } else {
        const newRef = push(ref(db, 'leads'))
        await set(newRef, {
          ...payload,
          createdAt: Date.now(),
        })
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }


  function exportCsv() {
    const rows = filteredMyLeads
      .filter((lead) => inDateRange(lead.leadDate || '', fromDate, toDate))
      .map((lead) => [
        lead.company || '',
        lead.clientName || '',
        lead.location || '',
        productNameFor(lead.productId),
        lead.status || '',
        processNames(lead.assignedTo),
        formatAmountForCsv(lead.totalAmount),
        lead.leadDate || '',
      ])

    downloadCsv(
      'partner-leads.csv',
      [
        'Company',
        'Client Name',
        'Location',
        'Product',
        'Status',
        'Processed By',
        'Required Amount',
        'Lead Date',
      ],
      rows,
    )
  }

  if (loading) {
    return <p className="text-slate-400">Loading…</p>
  }

  if (!partnerId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">My leads</h1>
        <div className="rounded-xl border border-amber-800/70 bg-amber-950/30 px-4 py-4 text-sm text-amber-100">
          Your account is not linked to a partner record yet. Ask an admin to set{' '}
          <code className="text-amber-200">partnerId</code> on your user profile,
          or recreate your user with the Partner role.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">My leads</h1>
          <p className="mt-1 text-sm text-slate-400">Create leads and assign one or more process teammates.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end sm:gap-4">
          <div className="w-full sm:w-[260px]">
            <label
              htmlFor="search-company-partner"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Search company
            </label>
            <input
              id="search-company-partner"
              type="text"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              placeholder="Type company name..."
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-white"
            />
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={openNew}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            New lead
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-auto text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Company</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Client name</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Location</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Product</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Status</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Processed by</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap text-right">Required Amount</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Date</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Updated status date</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredMyLeads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    You have no leads yet. Click New lead to add one.
                  </td>
                </tr>
              ) : (
                filteredMyLeads.map((lead) => (
                  <tr key={lead.id} className="text-slate-300">
                    <td className="px-4 py-1 text-slate-400">{lead.company || '—'}</td>
                    <td className="px-4 py-1 text-slate-400">{lead.clientName || '—'}</td>
                    <td className="px-4 py-1 text-slate-400">{lead.location || '—'}</td>
                    <td className="px-4 py-1 text-slate-400">{productNameFor(lead.productId)}</td>
                    <td className="px-4 py-1">
                      <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-blue-300">
                        {statusLabelByValue.get(lead.status) ||
                          lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-1 text-xs text-slate-400">{processNames(lead.assignedTo)}</td>
                    <td className="px-4 py-1 text-slate-400 text-right">₹ {Number(lead?.totalAmount).toLocaleString('en-IN') || 0}</td>
                    <td className="px-4 py-1 text-xs text-slate-500">{lead.leadDate || '—'}</td>
                    <td className="px-4 py-1 text-xs text-slate-500">{lead.updatedStatusDate || '—'}</td>
                    <td className="px-4 py-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(lead)}
                          title="Edit"
                          className="rounded-lg border border-slate-600 px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewLead(lead)}
                          title="View details"
                          className="rounded-lg border border-slate-600 px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
                        >
                          View Details
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
          showPartner={false}
          onClose={() => setViewLead(null)}
        />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto overflow-x-visible rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-modal-title-partner"
          >
            <h2
              id="lead-modal-title-partner"
              className="text-lg font-semibold text-white"
            >
              {editingId ? 'Edit lead' : 'New lead'}
            </h2>

            <form onSubmit={saveLead} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Company
                </label>
                <input
                  value={form.company}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, company: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Name of client
                </label>
                <input
                  value={form.clientName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, clientName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Location
                </label>
                <input
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Date
                </label>
                <input
                  type="date"
                  value={form.leadDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, leadDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value }))
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
                <label className="block text-sm font-medium text-slate-300">
                  Product
                </label>
                <select
                  value={form.productId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, productId: e.target.value }))
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
                  value={form.totalAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, totalAmount: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
                <AmountInWordsHint value={form.totalAmount} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-300">
                  Processed by (multi-select)
                </p>
                {usersError && (
                  <p className="mt-2 rounded-lg border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                    Could not read users from Realtime Database
                    (<code>permission_denied</code>). Publish rules that allow
                    authenticated read on <code>/users</code>.
                  </p>
                )}
                <div className="relative mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      processUsers.length > 0 &&
                      setAssigneeDropdownOpen((v) => !v)
                    }
                    className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-white disabled:opacity-60"
                    disabled={processUsers.length === 0}
                  >
                    <span className="truncate">
                      {processUsers.length === 0
                        ? 'No process users found'
                        : selectedAssignees.length === 0
                          ? 'Select process users'
                          : `${selectedAssignees.length} selected`}
                    </span>
                    <span className="text-slate-400">
                      {assigneeDropdownOpen ? '▲' : '▼'}
                    </span>
                  </button>
                  {assigneeDropdownOpen && processUsers.length > 0 && (
                    <div className="absolute bottom-full left-0 z-20 mb-2 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
                      {processUsers.map((u) => (
                        <label
                          key={u.uid}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={selectedAssignees.includes(u.uid)}
                            onChange={() => toggleAssignee(u.uid)}
                            className="rounded border-slate-600 bg-slate-950 text-blue-600"
                          />
                          <span>{u.displayName || u.email}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
