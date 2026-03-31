/** Indian grouping (e.g. 10,00,000) for CSV amount columns; empty if not a number. */
export function formatAmountForCsv(value) {
  if (value === '' || value == null) return ''
  const n = Number.parseFloat(String(value).replace(/,/g, ''))
  if (Number.isNaN(n)) return String(value)
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function escapeCsvCell(value) {
  const text = String(value ?? '')
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function downloadCsv(filename, headers, rows) {
  const headerLine = headers.map(escapeCsvCell).join(',')
  const bodyLines = rows.map((row) => row.map(escapeCsvCell).join(','))
  const csv = [headerLine, ...bodyLines].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function inDateRange(leadDate, fromDate, toDate) {
  if (!fromDate && !toDate) return true
  if (!leadDate) return false
  if (fromDate && leadDate < fromDate) return false
  if (toDate && leadDate > toDate) return false
  return true
}
