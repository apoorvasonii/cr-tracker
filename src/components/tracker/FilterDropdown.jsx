import { useEffect, useRef, useState } from 'react'

/**
 * Excel-style checkbox filter. `selected` is a Set of chosen values; every
 * option selected means "no filter", which is what returns the button to rest.
 */
export default function FilterDropdown({ label, open, onToggleOpen, options, selected, onChange }) {
  const ref = useRef(null)
  const [query, setQuery] = useState('')
  const allValues = options.map((o) => o.value)
  const filtered = selected.size < allValues.length
  // A project can accumulate dozens of statuses; typing beats scrolling.
  const searchable = options.length > 8
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const onDocClick = (e) => {
      if (!ref.current?.contains(e.target)) onToggleOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [open, onToggleOpen])

  const toggleValue = (value, checked) => {
    const next = new Set(selected)
    if (checked) next.add(value)
    else next.delete(value)
    onChange(next)
  }

  const count = filtered ? ` · ${selected.size}` : ''

  return (
    <div className="relative" ref={ref}>
      <button
        className={`btn gap-1.5 ${filtered ? 'border-brand-500/40 bg-brand-50 text-brand-700' : 'text-ink-soft'}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggleOpen(!open)
        }}
      >
        {label}
        {count}
        <span className="text-ink-muted">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-72 min-w-[230px] overflow-y-auto rounded-xl border border-line bg-white p-2 shadow-pop">
          {searchable && (
            <input
              type="text"
              className="field mb-1.5 h-8 w-full text-[12.5px]"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={query}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold hover:bg-slate-50">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-brand-600"
              checked={q ? shown.every((o) => selected.has(o.value)) : !filtered}
              onChange={(e) => {
                if (!q) {
                  onChange(e.target.checked ? new Set(allValues) : new Set())
                  return
                }
                const next = new Set(selected)
                shown.forEach((o) => (e.target.checked ? next.add(o.value) : next.delete(o.value)))
                onChange(next)
              }}
            />
            {q ? 'Select all matches' : 'Select all'}
          </label>
          <hr className="my-1.5 border-line" />
          {shown.length === 0 && (
            <p className="px-2 py-3 text-center text-[12px] text-ink-muted">No match</p>
          )}
          {shown.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-brand-600"
                checked={selected.has(o.value)}
                onChange={(e) => toggleValue(o.value, e.target.checked)}
              />
              {o.dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.dot }} />}
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
