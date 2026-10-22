import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
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

/** Every CR this project has taken into a Delivered status, grouped by month. */
export default function DeliveredView() {
  const { state, currentProject: proj } = useApp()
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
          <h2 className="text-[15px] font-semibold text-ink">Delivered CRs</h2>
          <p className="text-[12.5px] text-ink-muted">
            Every CR moved into a status marked Delivered (Configure → Statuses), with the day it happened.
          </p>
        </div>
        {revertedCount > 0 && (
          <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={showReverted} onChange={(e) => setShowReverted(e.target.checked)} />
            Show {revertedCount} moved back out
          </label>
        )}
        <select className="field-select" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">All months ({entries.length})</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)} ({entries.filter((e) => monthKey(e.at) === m).length})
            </option>
          ))}
        </select>
      </div>

      {groups.length === 0 && (
        <p className="px-5 py-14 text-center text-[13px] text-ink-muted">
          Nothing delivered yet. CRs appear here when they move into a Delivered status such as Live.
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
                      e.estimated && 'date from Last Action Date',
                      e.source === 'sheet' && 'from sheet sync',
                      e.revertedAt && `moved back out ${dayLabel(e.revertedAt)}`,
                      e.deleted && 'row since deleted',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
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
