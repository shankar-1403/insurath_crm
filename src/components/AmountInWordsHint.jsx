import { rupeesAmountInWords } from '../lib/amountInWords'

export default function AmountInWordsHint({ value }) {
  const text = rupeesAmountInWords(value)
  if (!text) return null
  return (
    <p className="mt-1 text-xs leading-relaxed text-slate-400">{text}</p>
  )
}
