const ones = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
]

const teens = [
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]

const tens = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
]

function twoDigits(n) {
  if (n < 10) return ones[n]
  if (n < 20) return teens[n - 10]
  const t = Math.floor(n / 10)
  const u = n % 10
  return tens[t] + (u ? ` ${ones[u]}` : '')
}

function threeDigits(n) {
  if (n < 100) return twoDigits(n)
  const h = Math.floor(n / 100)
  const rest = n % 100
  return `${ones[h]} hundred${rest ? ` ${twoDigits(rest)}` : ''}`
}

function integerToIndianWords(n) {
  if (n === 0) return 'zero'
  let num = n
  const crores = Math.floor(num / 10000000)
  num %= 10000000
  const lakhs = Math.floor(num / 100000)
  num %= 100000
  const thousands = Math.floor(num / 1000)
  num %= 1000

  const parts = []
  if (crores) parts.push(`${threeDigits(crores)} crore`)
  if (lakhs) parts.push(`${threeDigits(lakhs)} lakh`)
  if (thousands) parts.push(`${threeDigits(thousands)} thousand`)
  if (num) parts.push(threeDigits(num))
  return parts.join(' ')
}

/**
 * Human-readable rupee amount in words (Indian grouping: lakh, crore).
 * Returns '' for empty or invalid input.
 */
export function rupeesAmountInWords(input) {
  const s = String(input ?? '')
    .trim()
    .replace(/,/g, '')
  if (s === '' || s === '.' || s === '-') return ''

  const num = Number.parseFloat(s)
  if (Number.isNaN(num) || num < 0) return ''
  if (num > 9_999_999_999_999.99) return ''

  const totalPaise = Math.round(num * 100)
  const rupees = Math.floor(totalPaise / 100)
  const paise = totalPaise % 100

  const rupeeWords = integerToIndianWords(rupees)
  let out = `Rupees ${rupeeWords}`
  if (paise > 0) {
    out += ` and ${twoDigits(paise)} paise`
  }
  out += ' only'
  return out.charAt(0).toUpperCase() + out.slice(1)
}
