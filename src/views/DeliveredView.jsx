import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import { addManualDelivery, removeDelivery } from '../state/actions'
import { todayIso } from '../lib/dates'
import ExportButton from '../components/ui/ExportButton'
import { deliveryHistory } from '../lib/model'
import { parseDateValue } from '../lib/dates'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const monthKey = (iso) => (iso ? iso.slice(0, 7) : '')
const monthLabel = (key) => {
  if (!key) return 'Date unknown'
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}
const dayLabel = (iso) => {
  const d = iso && parseDateValue(iso)
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—'
}

/** Every CR this project has taken live (a Delivered status), grouped by month. */
export default function DeliveredView() {
  const { state, currentProject: proj, update, undoable } = useApp()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: '', at: todayIso(), note: '' })

  const saveDraft = (e) => {
    e.preventDefault()
    if (!draft.name.trim() || !draft.at) return
    update(addManualDelivery(draft))
    setDraft({ name: '', at: draft.at, note: '' }) // keep the date: past items often come in batches
    setMonth('all')
  }
  const [month, setMonth] = useState('all')
  const [showReverted, setShowReverted] = useState(false)

  const all = useMemo(() => (proj ? deliveryHistory(proj, state.crData) : []), [proj, state.crData])
  const entries = all.filter((e) => showReverted || !e.revertedAt)
  const months = [...new Set(entries.map((e) => monthKey(e.at)))]
  const shown = month === 'all' ? entries : entries.filter((e) => monthKey(e.at) === month)
  const groups = months
    .filter((m) => month === 'all' || m === month)
    .map((m) => ({ key: m, items: shown.filter((e) => monthKey(e.at) === m) }))
  const revertedCount = all.filter((e) => e.revertedAt).length

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <div className="mr-auto">
          <h2 className="text-[15px] font-semibold text-ink">Live CRs</h2>
        </div>
        {revertedCount > 0 && (
          <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={showReverted} onChange={(e) => setShowReverted(e.target.checked)} />
            Show {revertedCount} moved back out
          </label>
        )}
        <ExportButton />
        <button className="btn-primary" onClick={() => setAdding((a) => !a)}>
          {adding ? 'Close' : '+ Add Live CR'}
        </button>
        <select className="field-select" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">All months ({entries.length})</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)} ({entries.filter((e) => monthKey(e.at) === m).length})
            </option>
          ))}
        </select>
      </div>

      {adding && (
        <form onSubmit={saveDraft} className="flex flex-wrap items-end gap-3 border-b border-line bg-slate-50/70 px-5 py-4">
          <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-[12px] font-semibold text-ink-soft">
            What went live
            <input
              autoFocus
              className="field"
              placeholder="e.g. Scheme upload revamp"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-soft">
            Went live on
            <input
              type="date"
              className="field"
              value={draft.at}
              max={todayIso()}
              onChange={(e) => setDraft({ ...draft, at: e.target.value })}
            />
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[12px] font-semibold text-ink-soft">
            Note (optional)
            <input
              className="field"
              placeholder="e.g. handled over email, no CR raised"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={!draft.name.trim() || !draft.at}>
            Add
          </button>
        </form>
      )}

      {groups.length === 0 && (
        <p className="px-5 py-14 text-center text-[13px] text-ink-muted">
          Nothing live yet. CRs appear here when they move into a Delivered status such as Live.
        </p>
      )}

      {groups.map((g) => (
        <div key={g.key || 'unknown'}>
          <div className="bg-slate-50 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            {monthLabel(g.key)} — {g.items.length} CR{g.items.length === 1 ? '' : 's'}
          </div>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {g.items.map((e) => (
                <tr key={e.id} className="border-b border-line/70">
                  <td className="w-[130px] px-5 py-2.5 text-ink-soft">{dayLabel(e.at)}</td>
                  <td className="px-3 py-2.5 font-semibold text-ink">{e.name || '(no name)'}</td>
                  <td className="w-[160px] px-3 py-2.5 text-ink-soft">{e.statusLabel}</td>
                  <td className="w-[300px] px-5 py-2.5 text-right text-[11.5px] text-ink-muted">
                    {[
                      e.source === 'manual' && e.note,
                      e.estimated && 'date from Last Action Date',
                      e.source === 'sheet' && 'from sheet sync',
                      e.revertedAt && `moved back out ${dayLabel(e.revertedAt)}`,
                      e.deleted && 'row since deleted',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {e.source === 'manual' && (
                      <button
                        className="ml-2 rounded px-1.5 text-[14px] text-ink-muted hover:bg-red-50 hover:text-red-600"
                        title="Remove this item"
                        onClick={() => undoable(removeDelivery(e.id), `"${e.name}" removed from history`)}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
