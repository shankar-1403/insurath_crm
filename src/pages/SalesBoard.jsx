import { useMemo, useState } from 'react'
import { push, ref, set, update } from 'firebase/database'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useLeads } from '../hooks/useLeads'
import { useUsers } from '../hooks/useUsers'
import { useProducts } from '../hooks/useProducts'
import { useStatuses } from '../hooks/useStatuses'
import { assignedUids, toAssignedMap } from '../lib/leads'
import {
  assignableProcessUsers,
  assignableSalesUsers,
  labelAssignableUser
} from '../lib/assignees'
import { downloadCsv, formatAmountForCsv, inDateRange } from '../lib/csv'
import LeadDetailsModal from '../components/LeadDetailsModal'
import AmountInWordsHint from '../components/AmountInWordsHint'

const emptyForm = {
  title: '',
  viaEnabled: false,
  viaName: '',
  company: '',
  clientName: '',
  location: '',
  bankName: '',
  onePagerLink: '',
  leadDate: '',
  description: '',
  status: '',
  updatedStatusDate: '',
  productId: '',
  totalAmount: '',
  bankPayoutPercent: '',
  mandateSigned: false,
  mandatePayoutPercent: '',
}

export default function SalesBoard() {
  const { user } = useAuth()
  const { leads, loading } = useLeads()
  const { usersById, processUsers, salesUsers, error: usersError } = useUsers()
  const { products, loading: productsLoading, error: productsError } = useProducts()
  const { statuses } = useStatuses()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [assignmentMode, setAssignmentMode] = useState('process')
  const [selectedAssignees, setSelectedAssignees] = useState([])
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false)
  const [selectedSalesAssignees, setSelectedSalesAssignees] = useState([])
  const [salesAssigneeDropdownOpen, setSalesAssigneeDropdownOpen] =
    useState(false)
  const [saving, setSaving] = useState(false)
  const [leadSearch, setLeadSearch] = useState('')
  const [viewLead, setViewLead] = useState(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const myLeads = useMemo(
    () => leads.filter((l) => l.createdBy === user?.uid),
    [leads, user?.uid],
  )

  const processAssignees = useMemo(
    () => assignableProcessUsers(processUsers, user?.uid, usersById),
    [processUsers, user?.uid, usersById],
  )

  const salesAssignees = useMemo(
    () => assignableSalesUsers(salesUsers, user?.uid, usersById),
    [salesUsers, user?.uid, usersById],
  )

  const filteredMyLeads = useMemo(() => {
    const term = leadSearch.trim().toLowerCase()
    let list = myLeads
    if (term) {
      list = list.filter((l) => {
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

  function salesNames(salesAssignedTo) {
    const assignees = assignedUids(salesAssignedTo)
    if (!assignees.length) return '—'
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
    setAssignmentMode('process')
    setSelectedAssignees([])
    setAssigneeDropdownOpen(false)
    setSelectedSalesAssignees([])
    setSalesAssigneeDropdownOpen(false)
    setModalOpen(true)
  }

  function openEdit(lead) {
    setEditingId(lead.id)
    setForm({
      title: lead.title ?? '',
      viaEnabled: Boolean(String(lead.viaName ?? '').trim()),
      viaName: lead.viaName ?? '',
      company: lead.company ?? '',
      clientName: lead.clientName ?? '',
      location: lead.location ?? '',
      bankName: lead.bankName ?? '',
      onePagerLink: lead.onePagerLink ?? '',
      leadDate: lead.leadDate ?? '',
      description: lead.description ?? '',
      status: lead.status ?? '',
      updatedStatusDate: lead.updatedStatusDate ?? '',
      productId: lead.productId ?? '',
      totalAmount: lead.totalAmount ?? '',
      bankPayoutPercent: lead.bankPayoutPercent ?? '',
      mandateSigned: Boolean(lead.mandateSigned),
      mandatePayoutPercent: lead.mandatePayoutPercent ?? '',
    })
    const processUids = assignedUids(lead.assignedTo)
    const salesUids = assignedUids(lead.salesAssignedTo)
    if (salesUids.length && !processUids.length) {
      setAssignmentMode('sales')
      setSelectedSalesAssignees(salesUids)
      setSelectedAssignees([])
    } else {
      setAssignmentMode('process')
      setSelectedAssignees(processUids)
      setSelectedSalesAssignees([])
    }
    setAssigneeDropdownOpen(false)
    setSalesAssigneeDropdownOpen(false)
    setModalOpen(true)
  }

  function toggleAssignee(uid) {
    setSelectedAssignees((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
    )
  }

  function toggleSalesAssignee(uid) {
    setSelectedSalesAssignees((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
    )
  }

  async function saveLead(e) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
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
        viaName: form.viaEnabled ? form.viaName.trim() : '',
        company: form.company.trim(),
        clientName: form.clientName.trim(),
        location: form.location.trim(),
        bankName: form.bankName.trim(),
        onePagerLink: form.onePagerLink.trim(),
        leadDate: form.leadDate || '',
        description: form.description.trim(),
        status: form.status,
        updatedStatusDate: form.updatedStatusDate || '',
        createdBy: user.uid,
        assignedTo:
          assignmentMode === 'process'
            ? toAssignedMap(selectedAssignees)
            : null,
        salesAssignedTo:
          assignmentMode === 'sales'
            ? toAssignedMap(selectedSalesAssignees)
            : null,
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

  if (loading) {
    return <p className="text-slate-400">Loading…</p>
  }

  const baseAmount = Number.parseFloat(form.totalAmount || 0) || 0
  const bankPercent = Number.parseFloat(form.bankPayoutPercent || 0) || 0
  const mandatePercent = Number.parseFloat(form.mandatePayoutPercent || 0) || 0
  const bankAmount = (baseAmount * bankPercent) / 100
  const mandateAmount = form.mandateSigned ? (baseAmount * mandatePercent) / 100 : 0
  const totalRevenue = bankAmount + mandateAmount

  function exportCsv() {
    const rows = filteredMyLeads
      .filter((lead) => inDateRange(lead.leadDate || '', fromDate, toDate))
      .map((lead) => [
        lead.viaName || '',
        lead.company || '',
        lead.clientName || '',
        lead.location || '',
        productNameFor(lead.productId),
        lead.status || '',
        processNames(lead.assignedTo),
        salesNames(lead.salesAssignedTo),
        lead.leadDate || '',
        formatAmountForCsv(lead.totalAmount),
        lead.bankPayoutPercent || '',
        formatAmountForCsv(lead.bankPayoutAmount),
        lead.mandateSigned ? 'Yes' : 'No',
        lead.mandatePayoutPercent || '',
        formatAmountForCsv(lead.mandatePayoutAmount),
      ])

    downloadCsv(
      'sales-leads.csv',
      [
        'Via',
        'Company',
        'Client Name',
        'Location',
        'Product',
        'Status',
        'Processed By',
        'Sales',
        'Lead Date',
        'Required Amount',
        'Bank Payout %',
        'Bank Payout Amount',
        'Mandate Signed',
        'Mandate Payout %',
        'Mandate Payout Amount',
      ],
      rows,
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">My leads</h1>
          <p className="mt-1 text-sm text-slate-400">
            Create leads and assign one or more process teammates.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end sm:gap-4">
          <div className="w-full sm:w-65">
            <label
              htmlFor="search-company-sales"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Search company
            </label>
            <input
              id="search-company-sales"
              type="text"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              placeholder="Type company name..."
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#3388AB] focus:ring-2 focus:ring-[#3388AB]/30"
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
            className="rounded-lg bg-[#3388AB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3388AB]"
          >
            New lead
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] table-auto text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Company</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Client name</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Via</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Location</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Product</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Status</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Processed by</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Sales</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap text-right">Required Amount</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Date</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Updated status date</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredMyLeads.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-slate-500">
                    You have no leads yet. Click New lead to add one.
                  </td>
                </tr>
              ) : (
                filteredMyLeads.map((lead) => (
                  <tr key={lead.id} className="text-slate-300">
                    <td className="px-4 py-1 text-slate-400">{lead.company || '—'}</td>
                    <td className="px-4 py-1 text-slate-400">{lead.clientName || '—'}</td>
                    <td className="px-4 py-1 text-slate-400">{lead.viaName || '—'}</td>
                    <td className="px-4 py-1 text-slate-400">{lead.location || '—'}</td>
                    <td className="px-4 py-1 text-slate-400">{productNameFor(lead.productId)}</td>
                    <td className="px-4 py-1">
                      <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-blue-300">
                        {statusLabelByValue.get(lead.status) ||
                          lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-1 text-xs text-slate-400">{processNames(lead.assignedTo)}</td>
                    <td className="px-4 py-1 text-xs text-slate-400">{salesNames(lead.salesAssignedTo)}</td>
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
            aria-labelledby="lead-modal-title"
          >
            <h2
              id="lead-modal-title"
              className="text-lg font-semibold text-white"
            >
              {editingId ? 'Edit lead' : 'New lead'}
            </h2>

            <form onSubmit={saveLead} className="mt-6 space-y-4">
              {!editingId && (
                <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.viaEnabled}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          viaEnabled: e.target.checked,
                          ...(e.target.checked ? {} : { viaName: '' }),
                        }))
                      }
                      className="rounded border-slate-600 bg-slate-950 text-[#3388AB]"
                    />
                    <span>Via</span>
                  </label>
                  {form.viaEnabled && (
                    <div>
                      <label
                        htmlFor="sales-lead-via-name"
                        className="block text-xs font-medium text-slate-400"
                      >
                        Name
                      </label>
                      <input
                        id="sales-lead-via-name"
                        type="text"
                        value={form.viaName}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, viaName: e.target.value }))
                        }
                        placeholder="Referrer or channel name"
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      />
                    </div>
                  )}
                </div>
              )}
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
                  Bank Name
                </label>
                <input
                  value={form.bankName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bankName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  One pager link
                </label>
                <input
                  type="url"
                  value={form.onePagerLink}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, onePagerLink: e.target.value }))
                  }
                  placeholder="https://..."
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
                  Updated status date
                </label>
                <input
                  type="date"
                  value={form.updatedStatusDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, updatedStatusDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
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
                      value={form.bankPayoutPercent}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, bankPayoutPercent: e.target.value }))
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
                      value={bankAmount.toFixed(2)}
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
                        name="mandateSigned"
                        checked={form.mandateSigned === true}
                        onChange={() => setForm((f) => ({ ...f, mandateSigned: true }))}
                      />
                      Yes
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="mandateSigned"
                        checked={form.mandateSigned === false}
                        onChange={() => setForm((f) => ({ ...f, mandateSigned: false }))}
                      />
                      No
                    </label>
                  </div>
                </div>

                {form.mandateSigned && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Mandate Payout Percent (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.mandatePayoutPercent}
                        onChange={(e) =>
                          setForm((f) => ({
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
                        value={mandateAmount.toFixed(2)}
                        readOnly
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-lg border border-emerald-700/50 bg-emerald-950/20 px-3 py-3 text-sm text-emerald-200">
                  <div className="flex justify-between">
                    <span>Bank Payout Amount:</span>
                    <span>₹{bankAmount.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span>Mandate Amount:</span>
                    <span>₹{mandateAmount.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 flex justify-between font-semibold">
                    <span>Total Revenue:</span>
                    <span>₹{totalRevenue.toFixed(2)}</span>
                  </div>
                </div>
              </section>

              <div>
                <p className="text-sm font-medium text-slate-300">
                  Assign to
                </p>
                <div className="mt-2 flex rounded-lg border border-slate-700 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentMode('process')
                      setSelectedSalesAssignees([])
                      setSalesAssigneeDropdownOpen(false)
                    }}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      assignmentMode === 'process'
                        ? 'bg-[#3388AB] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Process
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentMode('sales')
                      setSelectedAssignees([])
                      setAssigneeDropdownOpen(false)
                    }}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      assignmentMode === 'sales'
                        ? 'bg-[#3388AB] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sales
                  </button>
                </div>
                {usersError && (
                  <p className="mt-2 rounded-lg border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                    Could not read users from Realtime Database
                    (<code>permission_denied</code>). Publish rules that allow
                    authenticated read on <code>/users</code>.
                  </p>
                )}
                {assignmentMode === 'process' ? (
                  <>
                    <p className="mt-3 text-xs font-medium text-slate-400">
                      Process team (multi-select)
                    </p>
                    <div className="relative mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          processAssignees.length > 0 &&
                          setAssigneeDropdownOpen((v) => !v)
                        }
                        className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-white disabled:opacity-60"
                        disabled={processAssignees.length === 0}
                      >
                        <span className="truncate">
                          {processAssignees.length === 0
                            ? 'No process users found'
                            : selectedAssignees.length === 0
                              ? 'Select process users'
                              : `${selectedAssignees.length} selected`}
                        </span>
                        <span className="text-slate-400">
                          {assigneeDropdownOpen ? '▲' : '▼'}
                        </span>
                      </button>
                      {assigneeDropdownOpen && processAssignees.length > 0 && (
                        <div className="absolute bottom-full left-0 z-20 mb-2 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
                          {processAssignees.map((u) => (
                            <label
                              key={u.uid}
                              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                            >
                              <input
                                type="checkbox"
                                checked={selectedAssignees.includes(u.uid)}
                                onChange={() => toggleAssignee(u.uid)}
                                className="rounded border-slate-600 bg-slate-950 text-[#3388AB]"
                              />
                              <span>{labelAssignableUser(u)}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-xs font-medium text-slate-400">
                      Sales team (multi-select)
                    </p>
                    <div className="relative mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          salesAssignees.length > 0 &&
                          setSalesAssigneeDropdownOpen((v) => !v)
                        }
                        className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-white disabled:opacity-60"
                        disabled={salesAssignees.length === 0}
                      >
                        <span className="truncate">
                          {salesAssignees.length === 0
                            ? 'No sales users found'
                            : selectedSalesAssignees.length === 0
                              ? 'Select sales users'
                              : `${selectedSalesAssignees.length} selected`}
                        </span>
                        <span className="text-slate-400">
                          {salesAssigneeDropdownOpen ? '▲' : '▼'}
                        </span>
                      </button>
                      {salesAssigneeDropdownOpen &&
                        salesAssignees.length > 0 && (
                          <div className="absolute bottom-full left-0 z-20 mb-2 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
                            {salesAssignees.map((u) => (
                              <label
                                key={u.uid}
                                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedSalesAssignees.includes(
                                    u.uid,
                                  )}
                                  onChange={() =>
                                    toggleSalesAssignee(u.uid)
                                  }
                                  className="rounded border-slate-600 bg-slate-950 text-[#3388AB]"
                                />
                                <span>
                                  {labelAssignableUser(u)}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                    </div>
                  </>
                )}
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
                  className="rounded-lg bg-[#3388AB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3388AB] disabled:opacity-50"
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
