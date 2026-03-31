import { ROLES } from '../constants'
import { useAuth } from '../context/AuthContext'
import { usePartners } from '../hooks/usePartners'
import { useProducts } from '../hooks/useProducts'
import { useStatuses } from '../hooks/useStatuses'
import { assignedUids } from '../lib/leads'

export default function LeadDetailsModal({
  lead,
  usersById,
  onClose,
  showPartner = true,
}) {
  const { profile } = useAuth()
  const role = String(profile?.role ?? '').trim().toLowerCase()
  const isPartnerRole = role === ROLES.PARTNER

  const { products } = useProducts()
  const { partners } = usePartners()
  const { statuses } = useStatuses()
  if (!lead) return null

  const userName = (uid) => {
    const u = usersById?.[uid]
    return u?.displayName || u?.email || uid || '—'
  }

  const assignees = assignedUids(lead.assignedTo)
  const salesAssignees = assignedUids(lead.salesAssignedTo)
  const salesAssignedBy =
    salesAssignees.length > 0
      ? salesAssignees.map((uid) => userName(uid)).join(', ')
      : null
  const statusMap = new Map()
  statuses.forEach((s) => {
    const label = String(s?.label ?? '').trim()
    const id = String(s?.id ?? '').trim()
    const legacyValue = String(s?.value ?? '').trim()
    if (id && label) statusMap.set(id, label)
    if (legacyValue && label) statusMap.set(legacyValue, label)
  })
  const statusLabel = statusMap.get(lead.status) || lead.status || '—'

  const processedBy = assignees.length
    ? assignees.map((uid) => userName(uid)).join(', ')
    : 'Unassigned'
  const productName = getProductName(lead.productId, products)
  const partnerName = getPartnerName(lead.partnerId, lead.partnerName, partners)

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-4">
      <div className="mx-auto my-6 w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-semibold text-white">Lead Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="grid gap-8 md:grid-cols-2">
            <section className="space-y-3">
              <p className="text-sm font-semibold text-slate-400">Lead Information</p>
              {showPartner && <Row label="Partner" value={partnerName} />}
              {lead.viaName ? (
                <Row label="Via" value={lead.viaName} />
              ) : null}
              <Row label="Company" value={lead.company || '—'} />
              <Row label="Client Name" value={lead.clientName || '—'} />
              <Row label="Sales Owner" value={userName(lead.createdBy)} />
              <Row label="Processed By" value={processedBy} />
              {salesAssignedBy ? (
                <Row label="Sales assigned" value={salesAssignedBy} />
              ) : null}
              <Row label="Status" value={statusLabel} />
              <Row label="Date" value={lead.leadDate || '—'} />
              <Row
                label="Updated status date"
                value={lead.updatedStatusDate || '—'}
              />
            </section>

            <section className="space-y-3">
              <p className="text-sm font-semibold text-slate-400">Company Details</p>
              <Row label="Location" value={lead.location || '—'} />
              {isPartnerRole ? null : (
                <Row label="Bank Name" value={lead.bankName || '—'} />
              )}
              <Row label="Product" value={productName} />
              {isPartnerRole ? null : (
                <Row
                  label="One Pager Link"
                  value={lead.onePagerLink || 'N/A'}
                  isLink={Boolean(lead.onePagerLink)}
                />
              )}
            </section>
            
            <section className="space-y-3">
              <p className="text-sm font-semibold text-slate-400">Financial Information</p>
              <Row label="Requirement Amount" value={formatAmount(lead.totalAmount)} />
              {isPartnerRole ? null : (
                <>
                  <Row label="Bank Payout %" value={formatPercent(lead.bankPayoutPercent)} />
                  <Row label="Bank Payout Amount" value={formatAmount(lead.bankPayoutAmount)} />
                </>
              )}
            </section>

            {isPartnerRole ? null : (
              <section className="space-y-3">
                <p className="text-sm font-semibold text-slate-400">Revenue Details</p>
                <Row label="Mandate Signed" value={lead.mandateSigned ? 'Yes' : 'No'} />
                <Row
                  label="Mandate Payout %"
                  value={
                    lead.mandateSigned
                      ? formatPercent(lead.mandatePayoutPercent)
                      : 'N/A'
                  }
                />
                <Row
                  label="Mandate Payout Amount"
                  value={
                    lead.mandateSigned ? formatAmount(lead.mandatePayoutAmount) : 'N/A'
                  }
                />
                <Row
                  label="Total Revenue"
                  value={formatAmount(totalRevenue(lead))}
                />
              </section>
            )}
          </div>

          <section className="mt-8">
            <p className="mb-2 text-sm font-semibold text-slate-400">Description</p>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
              {lead.description || '—'}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, isLink = false }) {
  return (
    <div className="text-sm text-slate-300 sm:text-base">
      <span className="font-semibold text-slate-200">{label}: </span>
      {isLink ? (
        <a
          href={String(value)}
          target="_blank"
          rel="noreferrer"
          className="break-all text-blue-300 underline-offset-2 hover:underline"
        >
          {String(value)}
        </a>
      ) : (
        <span className="break-all text-slate-300">{String(value)}</span>
      )}
    </div>
  )
}

function formatAmount(v) {
  const num = Number(v)
  if (!Number.isFinite(num)) return 'N/A'
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function formatPercent(v) {
  if (v === '' || v == null) return 'N/A'
  const num = Number(v)
  if (!Number.isFinite(num)) return 'N/A'
  return `${num}%`
}

function totalRevenue(lead) {
  const bank = Number(lead.bankPayoutAmount) || 0
  const mandate = Number(lead.mandatePayoutAmount) || 0
  return bank + mandate
}

function getProductName(productId, products) {
  if (!productId) return 'N/A'
  const item = products.find((p) => p.id === productId)
  return item?.name?.trim() || productId
}

function getPartnerName(partnerId, fallbackName, partners) {
  if (fallbackName) return fallbackName
  if (!partnerId) return 'N/A'
  const item = partners.find((p) => p.id === partnerId)
  return item?.name?.trim() || partnerId
}

