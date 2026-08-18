import { useApp } from '../../state/AppContext'
import { addFlag, removeFlag, updateFlag } from '../../state/actions'
import ConfigCard from './ConfigCard'

export default function FlagsTable() {
  const { state, currentProject: proj, update } = useApp()

  return (
    <ConfigCard
      title="Flags"
      sub="Symbols you can pin to any CR; the footnote text prints under the briefing when the flag is in use."
      action={
        <button className="btn btn-sm" onClick={() => update(addFlag())}>
          + Add flag
        </button>
      }
    >
      <table className="cfg-table">
        <thead>
          <tr>
            <th style={{ width: '8%' }}>Symbol</th>
            <th style={{ width: '9%' }}>Color</th>
            <th style={{ width: '20%' }}>Flag Name</th>
            <th style={{ width: '43%' }}>Footnote Text</th>
            <th style={{ width: '12%' }}>Usage</th>
            <th style={{ width: '8%' }} />
          </tr>
        </thead>
        <tbody>
          {proj.flagConfig.map((f) => {
            const count = state.crData.filter((r) => r.projectId === proj.id && (r.flags || []).includes(f.id)).length
            return (
              <tr key={f.id}>
                <td>
                  <input
                    type="text"
                    maxLength={3}
                    className="field w-full text-center font-semibold"
                    value={f.symbol}
                    onChange={(e) => update(updateFlag(f.id, 'symbol', e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="color"
                    className="swatch"
                    value={f.color}
                    onChange={(e) => update(updateFlag(f.id, 'color', e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="field w-full"
                    value={f.label}
                    onChange={(e) => update(updateFlag(f.id, 'label', e.target.value))}
                  />
                </td>
                <td>
                  <textarea
                    className="field min-h-[52px] w-full resize-y py-2 leading-snug"
                    value={f.note}
                    onChange={(e) => update(updateFlag(f.id, 'note', e.target.value))}
                  />
                </td>
                <td className="text-[12px] text-ink-muted">
                  {count} CR{count === 1 ? '' : 's'}
                </td>
                <td className="text-center">
                  <button
                    className="rounded-lg px-2 py-1 text-[15px] text-ink-muted hover:bg-red-50 hover:text-red-600"
                    onClick={() => update(removeFlag(f.id))}
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
