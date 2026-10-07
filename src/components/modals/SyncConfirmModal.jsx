import Modal, { ModalActions } from '../ui/Modal'

function NameList({ names }) {
  return (
    <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-[12.5px] text-ink-soft">
      {names.map((n, i) => (
        <li key={i}>{n || '(no name)'}</li>
      ))}
    </ul>
  )
}

function Section({ title, tone, children }) {
  const tones = {
    danger: 'border-red-200 bg-red-50/60 text-red-800',
    neutral: 'border-line bg-slate-50/70 text-ink',
  }
  return (
    <div className={`mb-3 rounded-xl border p-3 ${tones[tone]}`}>
      <h3 className="mb-2 text-[12.5px] font-semibold">{title}</h3>
      {children}
    </div>
  )
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Shown before a sync is applied: what the sheet would add, remove and change
 * on the tracker. Fields edited on the tracker are already protected from sync,
 * so everything listed here is a real change to what people see.
 */
export default function SyncConfirmModal({ pending, onConfirm, onCancel }) {
  if (!pending) return null
  const { projectName, preview } = pending
  const { added, removed, changed } = preview

  return (
    <Modal
      open
      onClose={onCancel}
      title={`Sync ${projectName} from the sheet?`}
      sub="Nothing has changed yet. Fields edited on the tracker are kept and aren't listed here."
    >
      {removed.length > 0 && (
        <Section tone="danger" title={`${plural(removed.length, 'CR')} will be removed — no longer in the sheet`}>
          <NameList names={removed} />
        </Section>
      )}

      {changed.length > 0 && (
        <Section tone="neutral" title={`${plural(changed.length, 'CR')} will change`}>
          <ul className="max-h-56 space-y-1.5 overflow-y-auto text-[12.5px] text-ink-soft">
            {changed.map((c, i) => (
              <li key={i}>
                <span className="font-semibold text-ink">{c.name || '(no name)'}</span>
                {c.fields.map((f) => (
                  <div key={f.label} className="pl-3">
                    {f.label}: <span className="line-through opacity-70">{f.from}</span> → {f.to}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {added.length > 0 && (
        <Section tone="neutral" title={`${plural(added.length, 'CR')} will be added`}>
          <NameList names={added} />
        </Section>
      )}

      <ModalActions>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className={removed.length ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
          Apply sync
        </button>
      </ModalActions>
    </Modal>
  )
}
