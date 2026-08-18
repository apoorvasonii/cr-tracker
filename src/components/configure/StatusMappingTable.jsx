import { useApp } from '../../state/AppContext'
import {
  addStatusMappingRow,
  applyStatusMappingToRows,
  ignoreDiscoveredStatusValue,
  quickAssignDiscoveredStatus,
  removeStatusMappingRow,
  unignoreStatusValue,
  updateStatusMappingRow,
} from '../../state/actions'
import { normalize } from '../../lib/strings'
import { mapSheetStatusToProjectStatus } from '../../lib/model'
import ConfigCard from './ConfigCard'

export default function StatusMappingTable() {
  const { state, currentProject: proj, update, showToast } = useApp()

  // Rows synced before this feature have no stored sheet wording to replay.
  const replayable = state.crData.filter((r) => r.projectId === proj.id && r.rawSection).length

  const applyNow = () => {
    const { changed, skipped, unknown } = update(applyStatusMappingToRows())
    if (!changed && !skipped && unknown) {
      showToast('These rows were synced before mapping replay existed — re-sync once, then this will work', true)
      return
    }
    const extra = [
      skipped ? `${skipped} kept manual edit${skipped === 1 ? '' : 's'}` : '',
      unknown ? `${unknown} without stored sheet wording` : '',
    ]
      .filter(Boolean)
      .join(', ')
    showToast(`Re-mapped ${changed} row${changed === 1 ? '' : 's'}${extra ? ` (${extra})` : ''}`)
  }

  const ignored = proj.ignoredStatusValues || []
  const unmapped = (proj.discoveredStatusValues || []).filter(
    (v) => !proj.statusMapping.some((sm) => normalize(sm.sheetValue) === normalize(v)) && !ignored.includes(v)
  )
  const isEmpty = proj.statusMapping.length === 0 && unmapped.length === 0

  const statusOptions = proj.statusConfig.map((s) => (
    <option key={s.key} value={s.key}>
      {s.label}
    </option>
  ))

  return (
    <ConfigCard
      title="Status Mapping"
      sub="What each raw sheet value means in this project. A value with no mapping and no exact label match becomes a new status, named as the sheet spells it."
      action={
        <div className="flex gap-2">
          <button
            className="btn btn-sm text-ink-soft"
            onClick={applyNow}
            title="Re-map existing rows using the mapping below, without re-fetching the sheet"
          >
            Apply to existing rows
          </button>
          <button className="btn btn-sm" onClick={() => update(addStatusMappingRow())}>
            + Add mapping
          </button>
        </div>
      }
    >
      <p className="mb-3 rounded-lg border border-line bg-slate-50/70 px-3 py-2 text-[12px] text-ink-soft">
        Mapping changes affect rows on the <b className="font-semibold">next sync</b> — or immediately via{' '}
        <b className="font-semibold">Apply to existing rows</b>. Rows whose status you edited by hand keep that edit
        either way.
        {replayable === 0 && ' None of the current rows carry stored sheet wording yet, so sync once first.'}
      </p>

      <table className="cfg-table">
        <thead>
          <tr>
            <th style={{ width: '45%' }}>Google Sheet Value</th>
            <th style={{ width: '45%' }}>Tracker Status</th>
            <th style={{ width: '10%' }} />
          </tr>
        </thead>
        <tbody>
          {isEmpty && (
            <tr>
              <td colSpan={3} className="py-8 text-center text-ink-muted">
                No sheet values seen yet — sync once to discover them here.
              </td>
            </tr>
          )}

          {proj.statusMapping.map((sm) => (
            <tr key={sm.id}>
              <td>
                <input
                  type="text"
                  className="field w-full"
                  value={sm.sheetValue}
                  onChange={(e) => update(updateStatusMappingRow(sm.id, 'sheetValue', e.target.value))}
                />
              </td>
              <td>
                <select
                  className="field-select w-full"
                  value={sm.statusKey}
                  onChange={(e) => update(updateStatusMappingRow(sm.id, 'statusKey', e.target.value))}
                >
                  {statusOptions}
                </select>
              </td>
              <td className="text-center">
                <button
                  className="rounded-lg px-2 py-1 text-[15px] text-ink-muted hover:bg-red-50 hover:text-red-600"
                  onClick={() => update(removeStatusMappingRow(sm.id))}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}

          {unmapped.map((v) => (
            <tr key={v} className="bg-amber-50/50">
              <td>
                <span className="font-medium">{v}</span>{' '}
                <span className="text-[11px] text-ink-muted">(seen in sheet, not yet mapped)</span>
              </td>
              <td>
                <select
                  className="field-select w-full"
                  value={mapSheetStatusToProjectStatus(proj, v)}
                  onChange={(e) => update(quickAssignDiscoveredStatus(v, e.target.value, normalize))}
                >
                  {/* Doing nothing is valid: sync creates a status from this value as-is. */}
                  <option value="">Use the sheet’s own wording</option>
                  {statusOptions}
                </select>
              </td>
              <td className="text-center">
                <button
                  className="rounded-lg px-2 py-1 text-[15px] text-ink-muted hover:bg-red-50 hover:text-red-600"
                  title="Dismiss — stop listing this sheet value as unmapped"
                  onClick={() => update(ignoreDiscoveredStatusValue(v))}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {ignored.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Dismissed</span>
          {ignored.map((v) => (
            <button
              key={v}
              className="chip hover:border-brand-500 hover:text-brand-700"
              title="Restore — list this value as unmapped again"
              onClick={() => update(unignoreStatusValue(v))}
            >
              {v} <span className="text-ink-muted">↩</span>
            </button>
          ))}
        </div>
      )}
    </ConfigCard>
  )
}
