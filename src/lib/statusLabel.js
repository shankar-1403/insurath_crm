/**
 * Human-readable label for a lead's stored status (matches status master id or legacy value).
 */
export function resolveStatusLabel(statusValue, statuses) {
  if (statusValue == null || String(statusValue).trim() === '') return ''
  const v = String(statusValue).trim()
  for (const s of statuses || []) {
    const label = String(s?.label ?? '').trim()
    if (!label) continue
    const id = String(s?.id ?? '').trim()
    const legacy = String(s?.value ?? '').trim()
    if (id === v || legacy === v) return label
  }
  return v
}
