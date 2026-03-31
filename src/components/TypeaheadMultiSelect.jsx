import { useMemo, useRef, useState } from 'react'
import {IconChevronDown,IconChevronUp} from '@tabler/icons-react'
import './TypeaheadMultiSelect.css'

function normalize(text) {
  return String(text ?? '').trim().toLowerCase()
}

export default function TypeaheadMultiSelect({
  label,
  placeholder = 'Type to search…',
  options,
  selectedIds,
  onChangeSelectedIds,
  disabled = false,
  id,
}) {
  const MAX_VISIBLE_CHIPS = 3
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const selectedSet = useMemo(
    () => new Set(selectedIds ?? []),
    [selectedIds],
  )

  const optionsById = useMemo(() => {
    const map = new Map()
    for (const opt of options ?? []) map.set(opt.id, opt)
    return map
  }, [options])

  const filtered = useMemo(() => {
    const q = normalize(query)
    const base = options ?? []
    if (!q) return base
    return base.filter((o) => normalize(o.label).includes(q))
  }, [options, query])

  const selected = useMemo(() => {
    return (selectedIds ?? [])
      .map((id) => optionsById.get(id))
      .filter(Boolean)
  }, [selectedIds, optionsById])

  const selectedVisible = selected.slice(0, MAX_VISIBLE_CHIPS)
  const selectedRemainderCount = Math.max(0, selected.length - selectedVisible.length)

  function remove(idToRemove) {
    onChangeSelectedIds((selectedIds ?? []).filter((id) => id !== idToRemove))
  }

  function toggle(idToToggle) {
    const current = selectedIds ?? []
    if (current.includes(idToToggle)) {
      onChangeSelectedIds(current.filter((id) => id !== idToToggle))
    } else {
      onChangeSelectedIds([...current, idToToggle])
    }
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

      <div className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
        <div className="flex items-center gap-2" onClick={() => setOpen((v) => !v)}>
          <div className="flex-1 no-scrollbar overflow-x-auto whitespace-nowrap flex items-center gap-2">
            {selectedVisible.length ? (
              <>
                {selectedVisible.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800 px-2 py-[1.2px] text-xs text-slate-200 shrink-0"
                  >
                    <span className="max-w-[200px] truncate">{s.label}</span>
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
                      className="rounded-full px-1 text-slate-300 hover:bg-slate-700"
                      aria-label={`Remove ${s.label}`}
                      disabled={disabled}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {selectedRemainderCount > 0 ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200 shrink-0">
                    +{selectedRemainderCount}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-sm text-slate-500 shrink-0">No selection</span>
            )}
          </div>

          <div className="rounded-md text-xs text-slate-300">
            {open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </div>
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-30 mt-2 tams-dropdown w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 pt-2 px-2 shadow-2xl">
          <div className="mb-1">
            <input
              id={id ? `${id}-search` : undefined}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none"
            />
          </div>
          {options?.length ? (
            <button
              type="button"
              onClick={() => onChangeSelectedIds(options.map((o) => o.id))}
              className="mb-1 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-slate-200 hover:bg-slate-800/60"
            >
              <span>Select All</span>
              <span className="text-xs text-slate-400">
                {selectedIds?.length === options.length ? 'Selected' : ''}
              </span>
            </button>
          ) : null}
          {filtered.length === 0 ? (
            <div className="px-2 py-3 text-xs text-slate-400">No matches</div>
          ) : (
            [...filtered]
              .sort((a, b) => {
                const aActive = selectedSet.has(a.id)
                const bActive = selectedSet.has(b.id)
                if (aActive === bActive) return 0
                return aActive ? -1 : 1
              })
              .map((o) => {
              const active = selectedSet.has(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  className={[
                    'flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm',
                    active ? 'bg-slate-800 text-white' : 'text-slate-200 hover:bg-slate-800/60',
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
          <div className="mt-2 py-2 flex justify-between gap-2 border-t border-slate-800 pt-2 sticky bottom-0 bg-slate-900">
            <button
              type="button"
              onClick={() => onChangeSelectedIds([])}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

