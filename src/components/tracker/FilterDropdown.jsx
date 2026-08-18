import { useEffect, useRef } from 'react'

/**
 * Excel-style checkbox filter. `selected` is a Set of chosen values; every
 * option selected means "no filter", which is what returns the button to rest.
 */
export default function FilterDropdown({ label, open, onToggleOpen, options, selected, onChange }) {
  const ref = useRef(null)
  const allValues = options.map((o) => o.value)
  const filtered = selected.size < allValues.length

  useEffect(() => {
    if (!open) return
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
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold hover:bg-slate-50">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-brand-600"
              checked={!filtered}
              onChange={(e) => onChange(e.target.checked ? new Set(allValues) : new Set())}
            />
            Select all
          </label>
          <hr className="my-1.5 border-line" />
          {options.map((o) => (
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
