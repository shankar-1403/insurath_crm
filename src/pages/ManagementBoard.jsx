import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { push, ref, set, remove, update } from 'firebase/database'
import { useAuth } from '../context/AuthContext'
import { useLeads } from '../hooks/useLeads'
import { useProducts } from '../hooks/useProducts'
import { usePartners } from '../hooks/usePartners'
import { useStatuses } from '../hooks/useStatuses'
import { useUsers } from '../hooks/useUsers'
import { assignedUids, holderUids, toAssignedMap } from '../lib/leads'
import { assignableProcessUsers, labelAssignableUser} from '../lib/assignees'
import { downloadCsv, inDateRange } from '../lib/csv'
import { resolveStatusLabel } from '../lib/statusLabel'
import { db } from '../lib/firebase'
import LeadDetailsModal from '../components/LeadDetailsModal'
import TypeaheadMultiSelect from '../components/TypeaheadMultiSelect'
import TypeaheadSelect from '../components/TypeaheadSelect'
import { IconX } from '@tabler/icons-react'

const emptyLeadForm = {
  leadDate: '',
  clientName: '',
  partnerId: 'self',
  phone: '',
  email: '',
  city: '',
  productId: '',
  description: '',
  status: '',
  updatedStatusDate: '',
  notes: '',
}

const emptyLeadFieldErrors = {
  clientName: '',
  status: '',
  updatedStatusDate: '',
}

export default function ManagementBoard({ listTabOverride }) {
  const location = useLocation()
  const path = location.pathname.replace(/\/$/, '') || '/'
  const listTab = listTabOverride || (path === '/management/assigned' ? 'assigned' : 'all')

  const prevListTabRef = useRef(null)
  const { user } = useAuth()
  const { leads, loading } = useLeads()
  const { products } = useProducts()
  const { partners } = usePartners()
  const { statuses } = useStatuses()
  const { usersById, processUsers } = useUsers()
  const [statusFilter, setStatusFilter] = useState('')
  const [leadSearch, setLeadSearch] = useState('')
  const [salesOwnerFilter, setSalesOwnerFilter] = useState([])
  const [assignedToFilter, setAssignedToFilter] = useState([])
  const [partnerFilter, setPartnerFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [sortOrder, setSortOrder] = useState('')
  const [viewLead, setViewLead] = useState(null)
  const [leadModalOpen, setLeadModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selectedAssignees, setSelectedAssignees] = useState([])
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false)
  const [savingLead, setSavingLead] = useState(false)
  const [formError, setFormError] = useState('')
  const [leadFieldErrors, setLeadFieldErrors] = useState(emptyLeadFieldErrors)
  const [deletingLeadId, setDeletingLeadId] = useState('')
  const [message, setMessage] = useState('')
  const [leadForm, setLeadForm] = useState(emptyLeadForm)

  useEffect(() => {
    if (
      prevListTabRef.current !== null &&
      prevListTabRef.current !== listTab
    ) {
      setStatusFilter('')
      setLeadSearch('')
      setSalesOwnerFilter([])
      setAssignedToFilter([])
      setPartnerFilter('')
      setProductFilter('')
      setFromDate('')
      setToDate('')
      setSortBy('')
      setSortOrder('')
    }
    prevListTabRef.current = listTab
  }, [listTab])

  const users = useMemo(
    () => Object.entries(usersById).map(([uid, user]) => ({ uid, ...user })),
    [usersById],
  )

  const allUsers = useMemo(
    () =>
      users
        .filter((u) => {
          const role = String(u?.role ?? '').trim().toLowerCase();
          return role === 'management' || role === 'sales';
        })
        .sort((a, b) =>
          String(a.displayName || a.email || '')
            .toLowerCase()
            .localeCompare(String(b.displayName || b.email || '').toLowerCase()),
        ),
    [users],
  )

  const allOwnerOptions = useMemo(
    () =>
      allUsers.map((u) => ({
        id: u.uid,
        label: u.displayName || u.email || u.uid.slice(0, 8),
      })),
    [allUsers],
  )

  const processAssignees = useMemo(
    () => assignableProcessUsers(processUsers, user?.uid, usersById),
    [processUsers, user?.uid, usersById],
  )

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

  const filtered = useMemo(() => {
    const term = leadSearch.trim().toLowerCase()
    let list = leads
    if (listTab === 'assigned' && user?.uid) {
      // Show leads assigned to the user, plus leads they created (even if left unassigned).
      list = list.filter((l) => {
        if (assignedUids(l.assignedTo).includes(user.uid)) return true
        if (l.createdBy === user.uid) return true
        // Back-compat in case older records stored createdBy as a map/array.
        return holderUids(l.createdBy).includes(user.uid)
      })
    }
    if (statusFilter) {
      list = list.filter((l) => l.status === statusFilter)
    }
    if (term) {
      list = list.filter((l) => {
        const company = String(l.company ?? '').toLowerCase()
        const clientName = String(l.clientName ?? '').toLowerCase()
        return company.includes(term) || clientName.includes(term)
      })
    }
    if (salesOwnerFilter.length) {
      list = list.filter((l) => salesOwnerFilter.includes(l.createdBy))
    }
    if (assignedToFilter.length) {
      list = list.filter((l) =>
        assignedUids(l.assignedTo).some((uid) => assignedToFilter.includes(uid)),
      )
    }
    
    if (partnerFilter) {
      list = list.filter((l) => {
        const pid = l.partnerId
        const isSelf = !pid || pid === 'self'
        if (partnerFilter === 'self') return isSelf
        return pid === partnerFilter
      })
    }

    if (productFilter) {
      list = list.filter((l) => l.productId === productFilter)
    }
    
    list = list.filter((l) => inDateRange(l.leadDate || '', fromDate, toDate))
    const sorted = [...list]
    if (sortBy && sortOrder) {
      sorted.sort((a, b) => {
        const aValue =
          sortBy === 'requiredAmount'
            ? Number(a?.totalAmount) || 0
            : (Number(a?.bankPayoutAmount) || 0) + (Number(a?.mandatePayoutAmount) || 0)
        const bValue =
          sortBy === 'requiredAmount'
            ? Number(b?.totalAmount) || 0
            : (Number(b?.bankPayoutAmount) || 0) + (Number(b?.mandatePayoutAmount) || 0)
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      })
    }
    return sorted
  }, [
    leads,
    listTab,
    user?.uid,
    statusFilter,
    leadSearch,
    salesOwnerFilter,
    assignedToFilter,
    partnerFilter,
    productFilter,
    fromDate,
    toDate,
    sortBy,
    sortOrder,
  ])

  function nameFor(uid) {
    const u = usersById[uid]
    return u?.displayName || u?.email || uid.slice(0, 8)
  }

  function productNameFor(productId) {
    if (!productId) return '—'
    const p = products.find((item) => item.id === productId)
    return p?.name || productId
  }

  function sourceNameFor(partnerId, createdBy) {
    if (!partnerId || partnerId === 'self') {
      return `${nameFor(createdBy)}`
    }
    const p = partners.find((item) => item.id === partnerId)
    return p?.name || partnerId
  }

  function partnerPosIdFor(partnerId) {
    if (!partnerId || partnerId === 'self') return '—'
    const p = partners.find((item) => item.id === partnerId)
    return p?.posId ?? p?.pos_id ?? '—'
  }

  const partnerOptions = useMemo(() => {
    const currentUser = usersById[user?.uid]
    const currentName =
      currentUser?.displayName || currentUser?.email || user?.uid?.slice(0, 8) || 'Self'

    return [
      { id: 'self', label: `${currentName} (self)` },
      ...partners.map((p) => ({
        id: p.id,
        label: [p.name || p.id, p.posId || p.pos_id].filter(Boolean).join(' · '),
      })),
    ]
  }, [partners, user?.uid, usersById])

  function toggleAssignee(uid) {
    setSelectedAssignees((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
    )
  }

  function openNewLeadModal() {
    setEditingId(null)
    setLeadForm(emptyLeadForm)
    setSelectedAssignees([])
    setAssigneeDropdownOpen(false)
    setFormError('')
    setLeadFieldErrors(emptyLeadFieldErrors)
    setLeadModalOpen(true)
  }

  function openEditLeadModal(lead) {
    setEditingId(lead.id)
    setLeadForm({
      leadDate: lead.leadDate ?? '',
      clientName: lead.clientName ?? '',
      partnerId: lead.partnerId ?? 'self',
      phone: lead.phone ?? '',
      email: lead.email ?? '',
      city: lead.city ?? '',
      productId: lead.productId ?? '',
      description: lead.description ?? '',
      status: lead.status ?? '',
      updatedStatusDate: lead.updatedStatusDate ?? '',
      notes: lead.notes ?? '',
    })
    setSelectedAssignees(assignedUids(lead.assignedTo))
    setAssigneeDropdownOpen(false)
    setFormError('')
    setLeadFieldErrors(emptyLeadFieldErrors)
    setLeadModalOpen(true)
  }

  async function saveLeadByManagement(e) {
    e.preventDefault()
    if (!user) return
    setFormError('')
    if (!editingId) {
      const errs = {
        clientName: !leadForm.clientName.trim() ? 'Client name is required.' : '',
        status: !leadForm.status ? 'Status is required.' : '',
        updatedStatusDate: !leadForm.updatedStatusDate
          ? 'Updated status date is required.'
          : '',
      }
      setLeadFieldErrors(errs)
      if (errs.clientName || errs.status || errs.updatedStatusDate) return
    } else {
      setLeadFieldErrors(emptyLeadFieldErrors)
    }
    setSavingLead(true)
    try {
      const normalizedPartnerId =
        leadForm.partnerId && leadForm.partnerId !== 'self'
          ? leadForm.partnerId
          : null
      const payload = {
        leadDate: leadForm.leadDate || '',
        clientName: leadForm.clientName.trim(),
        partnerId: normalizedPartnerId,
        phone: leadForm.phone.trim(),
        email: leadForm.email.trim(),
        city: leadForm.city.trim(),
        description: leadForm.description.trim(),
        status: leadForm.status || '',
        updatedStatusDate: leadForm.updatedStatusDate || '',
        notes: leadForm.notes,
        assignedTo: selectedAssignees.length ? toAssignedMap(selectedAssignees) : null,
        productId: leadForm.productId || null,
        updatedAt: Date.now(),
      }

      if (editingId) {
        await update(ref(db, `leads/${editingId}`), payload)
      } else {
        const newRef = push(ref(db, 'leads'))
        await set(newRef, { ...payload, createdBy: user.uid, createdAt: Date.now() })
      }
      setLeadForm(emptyLeadForm)
      setSelectedAssignees([])
      setAssigneeDropdownOpen(false)
      setLeadModalOpen(false)
      setEditingId(null)
      setLeadFieldErrors(emptyLeadFieldErrors)
    } catch (err) {
      setFormError(err?.message || 'Could not save lead.')
    } finally {
      setSavingLead(false)
    }
  }

  function exportCsv() {
    const rows = filtered
      .filter((lead) => inDateRange(lead.leadDate || '', fromDate, toDate))
      .map((lead) => [
        lead.clientName || '',
        lead.leadDate || '',
        lead.phone || '',
        lead.email || '',
        lead.city || '',
        resolveStatusLabel(lead.status, statuses),
        lead.updatedStatusDate || '',
        sourceNameFor(lead.partnerId, lead.createdBy),
        partnerPosIdFor(lead.partnerId),
        productNameFor(lead.productId),
        nameFor(lead.createdBy),
        assignedUids(lead.assignedTo).map((uid) => nameFor(uid)).join(', '),
      ])

    downloadCsv(
      listTab === 'assigned'
        ? 'management-assigned-leads.csv'
        : 'management-leads.csv',
      [
        'Client',
        'Lead Date',
        'Phone',
        'Email',
        'City',
        'Status',
        'Updated Status Date',
        'Source',
        'Partner POS ID',
        'Product',
        'Lead Holder',
        'Assigned To',
      ],
      rows,
    )
  }

  if (loading) {
    return <p className="text-slate-400">Loading leads…</p>
  }
  
  async function handleDelete(leadId) {
    setMessage('')
    setFormError('')
    
    const ok = window.confirm('Delete this lead? This cannot be undone.')
    if (!ok) return

    setDeletingLeadId(leadId)
    try {
      await remove(ref(db, `leads/${leadId}`))
      setMessage('Lead deleted.')
    } catch (err) {
      setFormError(err?.message ?? 'Could not delete lead.')
    } finally {
      setDeletingLeadId('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        {message && (
          <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            {message}
          </div>
        )}
        {formError && (
          <div className="rounded-xl border border-red-800/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {formError}
          </div>
        )}
        <div className="flex justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-white">
              {listTab === 'assigned' ? 'Assigned leads' : 'All leads'}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {listTab === 'assigned'
                ? 'Leads assigned to you—including by other management users—using Assign to.'
                : 'Track every lead, owner, assignment, and status across teams.'}
            </p>
          </div>
          {listTab === 'assigned' && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={openNewLeadModal}
                className="rounded-lg bg-[#3388AB] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#3388AB] cursor-pointer"
              >
                New lead
              </button>
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <label
              htmlFor="status-filter"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Filter by status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-900 px-3 py-2 text-sm text-white"
            >
              <option value="">All statuses</option>
              {statusOptions.filter((s) => s.value).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sales-owner-filter" className="block text-xs font-medium uppercase tracking-wide text-slate-500">Lead Holder</label>
            <TypeaheadMultiSelect
              id="sales-owner-filter"
              label={null}
              placeholder="Type sales owner…"
              options={allOwnerOptions}
              selectedIds={salesOwnerFilter}
              onChangeSelectedIds={setSalesOwnerFilter}
            />
          </div>

          <div>
            <label htmlFor="assigned-to-filter" className="block text-xs font-medium uppercase tracking-wide text-slate-500">Assigned To</label>
            <TypeaheadMultiSelect
              id="assigned-to-filter"
              label={null}
              placeholder="Type assignee…"
              options={allOwnerOptions}
              selectedIds={assignedToFilter}
              onChangeSelectedIds={setAssignedToFilter}
            />
          </div>
          <div>
            <label
              htmlFor="product-filter"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Product
            </label>
            <select
              id="product-filter"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-900 px-3 py-2 text-sm text-white"
            >
              <option value="">All products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="partner-filter"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Source
            </label>
            <select
              id="partner-filter"
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-900 px-3 py-2 text-sm text-white"
            >
              <option value="">All sources</option>
              <option value="self">Self</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.name || p.id, p.posId || p.pos_id].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-900 px-3 py-2 text-sm text-white"
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
              className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="col-span-1"></div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={exportCsv}
              className="w-full rounded-lg border border-green-800 bg-green-800/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-green-800/10 cursor-pointer"
            >
              Export CSV
            </button>
          </div>
          <div>
            <label
              htmlFor="search"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Search Client
            </label>
            <input
              id="search"
              type="text"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              placeholder="Type client name..."
              className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#3388AB] focus:ring-2 focus:ring-[#3388AB]/30"
            />
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#3388AB] bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="min-w-max w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-[#3388AB] bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Lead Holder</th>
                <th className="px-4 py-2 font-medium">Assigned To</th>
                <th className="px-4 py-2 font-medium">Lead Date</th>
                <th className="px-4 py-2 font-medium">Updated status date</th>
                <th className="px-4 py-2 font-medium">View details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3388AB]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    {listTab === 'assigned'
                      ? 'No leads assigned to you yet. When a teammate adds you under Assign to, they will appear here.'
                      : 'No leads match this filter.'}
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => {
                  const assignees = assignedUids(lead.assignedTo)
                  return (
                    <tr key={lead.id} className="text-slate-300">
                      <td className="px-4 py-1 text-slate-400">{lead.clientName || '—'}</td>
                      <td className="px-4 py-1">
                        <span className="rounded-full bg-[#3388AB]/20 px-2.5 py-0.5 text-xs text-[#3388AB]">
                          {statusLabelByValue.get(lead.status) ||
                            lead.status ||
                            'New'}
                        </span>
                      </td>
                      <td className="px-4 py-1 text-slate-400">
                        {[partnerPosIdFor(lead?.partnerId), sourceNameFor(lead?.partnerId, lead?.createdBy)]
                          .filter((v) => v && v !== '—')
                          .join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-1 text-slate-400">
                        {productNameFor(lead?.productId)}
                      </td>
                      <td className="px-4 py-1 text-slate-400">{nameFor(lead.createdBy)}</td>
                      <td className="px-4 py-1">
                        {assignees.length === 0 ? (
                          <span className="text-slate-600">Unassigned</span>
                        ) : (
                          <ul className="space-y-0.5 text-sm text-slate-400">
                            {assignees.map((uid) => (
                              <li key={uid}>{nameFor(uid)}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-1 text-xs text-slate-500">{lead.leadDate || '—'}</td>
                      <td className="px-4 py-1 text-xs text-slate-500">{lead.updatedStatusDate || '—'}</td>
                      <td className="px-4 py-1">
                        <div className="flex items-center gap-2 justify-start">
                          <div>
                            {listTab === 'assigned' && (
                              <button
                                type="button"
                                onClick={() => openEditLeadModal(lead)}
                                className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 sm:px-3 cursor-pointer"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => setViewLead(lead)}
                              className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 sm:px-3 cursor-pointer"
                              >
                                View details
                              </button>
                          </div>
                          {listTab !== 'assigned' && (
                            <div>
                              <button
                                type="button"
                                onClick={() => handleDelete(lead.id)}
                                disabled={deletingLeadId === lead.id}
                                className="rounded-lg border border-red-800/40 px-4 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50 cursor-pointer"
                              >
                                {deletingLeadId === lead.id ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewLead && (
        <LeadDetailsModal
          lead={viewLead}
          usersById={usersById}
          onClose={() => setViewLead(null)}
        />
      )}

      {leadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#3388AB] bg-slate-900 p-4 shadow-2xl sm:p-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">
                {editingId ? 'Edit lead' : 'New lead'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setLeadModalOpen(false)
                  setLeadFieldErrors(emptyLeadFieldErrors)
                  setFormError('')
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 cursor-pointer"
              >
                <IconX size={20} color="#fff"/>
              </button>
            </div>
            <form onSubmit={saveLeadByManagement} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Date (Lead entry date)</label>
                <input
                  type="date"
                  value={leadForm.leadDate}
                  onChange={(e) =>
                    setLeadForm((f) => ({ ...f, leadDate: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Name *</label>
                <input
                  value={leadForm.clientName}
                  onChange={(e) => {
                    setLeadForm((f) => ({ ...f, clientName: e.target.value }))
                    if (!editingId && leadFieldErrors.clientName) {
                      setLeadFieldErrors((prev) => ({ ...prev, clientName: '' }))
                    }
                  }}
                  className={`mt-1 w-full rounded-lg border bg-slate-950 px-3 py-2 text-white ${
                    !editingId && leadFieldErrors.clientName
                      ? 'border-red-500/60'
                      : 'border-[#3388AB]'
                  }`}
                />
                {!editingId && leadFieldErrors.clientName && (
                  <p className="mt-1 text-xs text-red-300">{leadFieldErrors.clientName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Source</label>
                <TypeaheadSelect
                  id="lead-partner"
                  options={partnerOptions}
                  selectedId={leadForm.partnerId}
                  onChangeSelectedId={(partnerId) =>
                    setLeadForm((f) => ({ ...f, partnerId }))
                  }
                  placeholder="Type partner name / POS ID…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Phone</label>
                <input
                  value={leadForm.phone}
                  onChange={(e) =>
                    setLeadForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Email</label>
                <input
                  value={leadForm.email}
                  onChange={(e) =>
                    setLeadForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">City</label>
                <input
                  value={leadForm.city}
                  onChange={(e) =>
                    setLeadForm((f) => ({ ...f, city: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Product</label>
                <select
                  value={leadForm.productId}
                  onChange={(e) =>
                    setLeadForm((f) => ({ ...f, productId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-950 px-3 py-2 text-white"
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Requirement Details (short description)</label>
                <textarea
                  rows={3}
                  value={leadForm.description}
                  onChange={(e) =>
                    setLeadForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Status *</label>
                <select
                  value={leadForm.status}
                  onChange={(e) => {
                    setLeadForm((f) => ({ ...f, status: e.target.value }))
                    if (!editingId && leadFieldErrors.status) {
                      setLeadFieldErrors((prev) => ({ ...prev, status: '' }))
                    }
                  }}
                  className={`mt-1 w-full rounded-lg border bg-slate-950 px-3 py-2 text-white ${
                    !editingId && leadFieldErrors.status
                      ? 'border-red-500/60'
                      : 'border-[#3388AB]'
                  }`}
                >
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {!editingId && leadFieldErrors.status && (
                  <p className="mt-1 text-xs text-red-300">{leadFieldErrors.status}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Status Date *</label>
                <input
                  type="date"
                  value={leadForm.updatedStatusDate}
                  onChange={(e) => {
                    setLeadForm((f) => ({
                      ...f,
                      updatedStatusDate: e.target.value,
                    }))
                    if (!editingId && leadFieldErrors.updatedStatusDate) {
                      setLeadFieldErrors((prev) => ({ ...prev, updatedStatusDate: '' }))
                    }
                  }}
                  className={`mt-1 w-full rounded-lg border bg-slate-950 px-3 py-2 text-white ${
                    !editingId && leadFieldErrors.updatedStatusDate
                      ? 'border-red-500/60'
                      : 'border-[#3388AB]'
                  }`}
                />
                {!editingId && leadFieldErrors.updatedStatusDate && (
                  <p className="mt-1 text-xs text-red-300">{leadFieldErrors.updatedStatusDate}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Notes</label>
                <textarea
                  rows={3}
                  value={leadForm.notes}
                  onChange={(e) =>
                    setLeadForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#3388AB] bg-slate-950 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300">Assign to</label>
                <div className="relative mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      processAssignees.length > 0 &&
                      setAssigneeDropdownOpen((v) => !v)
                    }
                    className="flex w-full items-center justify-between rounded-lg border border-[#3388AB] bg-slate-950 px-3 py-2 text-left text-sm text-white disabled:opacity-60"
                    disabled={processAssignees.length === 0}
                  >
                    <span className="truncate">
                      {processAssignees.length === 0
                        ? 'No team members found'
                        : selectedAssignees.length === 0
                          ? 'Select assignees'
                          : `${selectedAssignees.length} selected`}
                    </span>
                    <span className="text-slate-400">
                      {assigneeDropdownOpen ? '▲' : '▼'}
                    </span>
                  </button>
                  {assigneeDropdownOpen && processAssignees.length > 0 && (
                    <div className="absolute bottom-full left-0 z-20 mb-2 max-h-48 w-full overflow-y-auto rounded-lg border border-[#3388AB] bg-slate-900 p-2 shadow-xl">
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
              </div>
              {formError && <p className="text-sm text-red-300">{formError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLeadModalOpen(false)
                    setLeadForm(emptyLeadForm)
                    setSelectedAssignees([])
                    setEditingId(null)
                    setLeadFieldErrors(emptyLeadFieldErrors)
                  }}
                  className="rounded-lg border border-[#3388AB] px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLead}
                  className="rounded-lg bg-[#3388AB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3388AB] disabled:opacity-50"
                >
                  {savingLead ? 'Saving...' : editingId ? 'Update lead' : 'Save lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
