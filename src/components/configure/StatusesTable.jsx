import { useApp } from '../../state/AppContext'
import { addStatus, moveStatus, removeStatus, removeUnusedStatuses, updateStatus } from '../../state/actions'
import ConfigCard from './ConfigCard'

function OrderButtons({ position, isFirst, isLast, onMove }) {
  const cls =
    'grid h-6 w-6 place-items-center rounded-md border border-line bg-white text-[10px] text-ink-soft ' +
    'enabled:hover:border-brand-500 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 ' +
    'disabled:cursor-not-allowed disabled:opacity-30'
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-4 text-[12px] font-semibold tabular-nums text-ink-muted">{position}</span>
      <div className="flex flex-col gap-0.5">
        <button className={cls} disabled={isFirst} title="Move up" onClick={() => onMove('up')}>
          ▲
        </button>
        <button className={cls} disabled={isLast} title="Move down" onClick={() => onMove('down')}>
          ▼
        </button>
      </div>
    </div>
  )
}

export default function StatusesTable() {
  const { state, currentProject: proj, update, showToast } = useApp()

  const usedKeys = new Set(state.crData.filter((r) => r.projectId === proj.id).map((r) => r.section))
  const unusedCount = proj.statusConfig.filter((s) => !usedKeys.has(s.key)).length

  const remove = (key) => update(removeStatus(key))

  const cleanUp = () => {
    update(removeUnusedStatuses())
    showToast(`Removed ${unusedCount} unused status${unusedCount === 1 ? '' : 'es'}`)
  }

  return (
    <ConfigCard
      title="Statuses"
      sub="Created automatically from the values found in your sheet — colour, order, global category and Actionable Points visibility are yours to set. Order also drives the Briefing's sections, the status dropdowns and the Status filter."
      action={
        <div className="flex gap-2">
          {unusedCount > 0 && (
            <button className="btn btn-sm text-ink-soft" onClick={cleanUp} title="Delete statuses no CR is using">
              Remove {unusedCount} unused
            </button>
          )}
          <button className="btn btn-sm" onClick={() => update(addStatus())}>
            + Add status
          </button>
        </div>
      }
    >
      <table className="cfg-table">
        <thead>
          <tr>
            <th style={{ width: '9%' }}>Order</th>
            <th style={{ width: '20%' }}>Status Label</th>
            <th style={{ width: '7%' }}>Color</th>
            <th style={{ width: '11%' }} title="List these CRs in the Briefing you copy for email">
              List in Briefing
            </th>
            <th style={{ width: '12%' }}>In Actionable Points</th>
            <th style={{ width: '17%' }}>Global Category</th>
            <th style={{ width: '15%' }}>Usage</th>
            <th style={{ width: '10%' }} />
          </tr>
        </thead>
        <tbody>
          {proj.statusConfig.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-ink-muted">
                No statuses yet — sync a sheet and they’ll be created from the values in your Status column, or add one
                by hand.
              </td>
            </tr>
          )}
          {proj.statusConfig.map((s, i) => {
            const count = state.crData.filter((r) => r.projectId === proj.id && r.section === s.key).length
            return (
              <tr key={s.key}>
                <td>
                  <OrderButtons
                    position={i + 1}
                    isFirst={i === 0}
                    isLast={i === proj.statusConfig.length - 1}
                    onMove={(dir) => update(moveStatus(s.key, dir))}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="field w-full font-semibold"
                    value={s.label}
                    onChange={(e) => update(updateStatus(s.key, 'label', e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="color"
                    className="swatch"
                    value={s.color}
                    onChange={(e) => update(updateStatus(s.key, 'color', e.target.value))}
                  />
                </td>
                <td className="text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-600"
                    title="Off = counted in the Overall Status tiles, but not listed as items"
                    checked={s.showInBriefing !== false}
                    onChange={(e) => update(updateStatus(s.key, 'showInBriefing', e.target.checked))}
                  />
                </td>
                <td className="text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-600"
                    checked={!!s.showInActionable}
                    onChange={(e) => update(updateStatus(s.key, 'showInActionable', e.target.checked))}
                  />
                </td>
                <td>
                  <select
                    className="field-select w-full"
                    value={s.category}
                    onChange={(e) => update(updateStatus(s.key, 'category', e.target.value))}
                  >
                    {state.globalCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="text-[12px] text-ink-muted">
                  {count} CR{count === 1 ? '' : 's'}
                </td>
                <td className="text-center">
                  <button
                    className="rounded-lg px-2 py-1 text-[15px] text-ink-muted hover:bg-red-50 hover:text-red-600"
                    onClick={() => remove(s.key)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ConfigCard>
  )
}
