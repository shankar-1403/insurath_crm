import { useMemo, useRef, useState } from 'react'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import './TypeaheadMultiSelect.css'

function normalize(text) {
  return String(text ?? '').trim().toLowerCase()
}

export default function TypeaheadSelect({
  id,
  label,
  placeholder = 'Type to search…',
  options,
  selectedId,
  onChangeSelectedId,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)

  const optionsById = useMemo(() => {
    const map = new Map()
    for (const opt of options ?? []) map.set(opt.id, opt)
    return map
  }, [options])

  const selected = selectedId ? optionsById.get(selectedId) : null

  const filtered = useMemo(() => {
    const q = normalize(query)
    const base = options ?? []
    if (!q) return base
    return base.filter((o) => normalize(o.label).includes(q))
  }, [options, query])

  function choose(idToChoose) {
    onChangeSelectedId(idToChoose)
    setOpen(false)
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget)) {
          setOpen(false)
        }
      }}
    >
      {label ? (
        <label
          htmlFor={id}
          className="block text-xs font-medium uppercase tracking-wide text-slate-500"
        >
          {label}
        </label>
      ) : null}

      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="mt-1 flex w-full items-center justify-between rounded-lg border border-[#3388AB] bg-slate-950 px-3 py-2 text-left text-sm text-white disabled:opacity-60"
      >
        <span className={selected ? 'truncate' : 'truncate text-slate-500'}>
          {selected ? selected.label : 'Select source'}
        </span>
        <span className="ml-2 shrink-0 text-slate-300">
          {open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        </span>
      </button>

      {open && !disabled && (
        <div className="absolute z-30 mt-2 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 pt-2 px-2 shadow-2xl">
          <div className="mb-2">
            <input
              id={id ? `${id}-search` : undefined}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none"
              autoFocus
            />
          </div>

          {filtered.length === 0 ? (
            <div className="px-2 py-3 text-xs text-slate-400">No matches</div>
          ) : (
            filtered.map((o) => {
              const active = o.id === selectedId
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => choose(o.id)}
                  className={[
                    'flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm',
                    active
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-200 hover:bg-slate-800/60',
                  ].join(' ')}
                >
                  <span className="truncate">{o.label}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {active ? 'Selected' : ''}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

