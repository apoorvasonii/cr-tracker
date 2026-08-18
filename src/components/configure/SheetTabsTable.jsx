import { useApp } from '../../state/AppContext'
import { addSheetTab, removeSheetTab, updateSheetTab } from '../../state/actions'
import ConfigCard from './ConfigCard'

export default function SheetTabsTable() {
  const { currentProject: proj, update } = useApp()

  return (
    <ConfigCard
      title="Sheet Tabs"
      sub="Named tabs you can switch between without re-pasting the sheet link."
      action={
        <button className="btn btn-sm" onClick={() => update(addSheetTab())}>
          + Add tab
        </button>
      }
    >
      <table className="cfg-table">
        <thead>
          <tr>
            <th style={{ width: '38%' }}>Label</th>
            <th style={{ width: '52%' }}>Tab Name or GID</th>
            <th style={{ width: '10%' }} />
          </tr>
        </thead>
        <tbody>
          {proj.sheetTabConfig.length === 0 && (
            <tr>
              <td colSpan={3} className="py-8 text-center text-ink-muted">
                No saved tabs — the tab in the sheet link (or the first one) is used.
              </td>
            </tr>
          )}
          {proj.sheetTabConfig.map((t) => (
            <tr key={t.id}>
              <td>
                <input
                  type="text"
                  className="field w-full font-semibold"
                  value={t.label}
                  onChange={(e) => update(updateSheetTab(t.id, 'label', e.target.value))}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="field w-full"
                  placeholder="Tab name  or  GID e.g. 123456789"
                  value={t.value}
                  onChange={(e) => update(updateSheetTab(t.id, 'value', e.target.value))}
                />
              </td>
              <td className="text-center">
                <button
                  className="rounded-lg px-2 py-1 text-[15px] text-ink-muted hover:bg-red-50 hover:text-red-600"
                  onClick={() => update(removeSheetTab(t.id))}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ConfigCard>
  )
}
