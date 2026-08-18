import { useEffect } from 'react'

const WIDTHS = { sm: 'max-w-[440px]', md: 'max-w-[560px]', lg: 'max-w-[900px]' }

export default function Modal({ open, onClose, title, sub, size = 'md', children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-ink/50 px-4 py-8 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`w-full ${WIDTHS[size]} rounded-2xl bg-white p-6 shadow-pop`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
            {sub && <p className="mt-1 text-[12.5px] text-ink-muted">{sub}</p>}
          </div>
          <button className="btn-ghost btn-icon -mr-2 -mt-1 text-[18px]" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Right-aligned action row for modal footers. */
export function ModalActions({ children }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>
}

/** Label + control pairs, matching the modal grid in the mockup. */
export function FieldGrid({ children, labelWidth = '150px' }) {
  return (
    <div className="grid items-center gap-x-4 gap-y-3" style={{ gridTemplateColumns: `${labelWidth} 1fr` }}>
      {children}
    </div>
  )
}

export function FieldLabel({ children }) {
  return <label className="text-[12.5px] font-semibold text-ink-soft">{children}</label>
}

/** Muted, bordered container used for the modals' explanatory blocks. */
export function ModalSection({ title, children }) {
  return (
    <div className="mb-4 rounded-xl border border-line bg-slate-50/70 p-4">
      {title && (
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{title}</h3>
      )}
      {children}
    </div>
  )
}
