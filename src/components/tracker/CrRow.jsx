import { useApp } from '../../state/AppContext'
import {
  addStatusForRow,
  deleteRow,
  resetRowOverrides,
  toggleRowFlag,
  updateCustomFieldValue,
  updateRow,
  updateRowSection,
} from '../../state/actions'
import { actionOptions, categoryOf, getProjectById, getStatus, isManualProject } from '../../lib/model'
import { formatPlanned, parseDateValue, toIsoDate } from '../../lib/dates'
import StatusSelect from './StatusSelect'

/** Past its planned end date and not yet in a "live" category status. */
function isOverdue(row, statusCategoryId, dateOrder) {
  // 'live' here is the default global-category id; a project that renames or removes
  // it simply gets overdue highlighting on those rows too, which is harmless.
  if (statusCategoryId === 'live') return false
  const d = parseDateValue(row.planned, dateOrder)
  if (!d) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

/** Sentinel option value: "type a status that doesn't exist yet". */
const NEW_STATUS = '__new_status__'

/** `customCols` is the project's custom column set, in the order it configures them. */
export default function CrRow({ row, index, customCols, compact }) {
  const { state, update, showToast } = useApp()
  const rowProj = getProjectById(state.projects, row.projectId)
  if (!rowProj) return null

  const s = getStatus(state.projects, row.section, row.projectId)
  const overdue = isOverdue(row, categoryOf(state.globalCategories, s).id, rowProj.dateOrder)
  const manualProject = isManualProject(rowProj)
  const plannedDate = parseDateValue(row.planned, rowProj.dateOrder)
  const plannedIso = plannedDate ? toIsoDate(plannedDate) : ''
  const hasOverride = row.overrides && Object.values(row.overrides).some(Boolean)

  const cell = `px-3 align-top ${compact ? 'py-1.5' : 'py-2.5'}`

  const reset = () => {
    update(resetRowOverrides(row.recordId))
    showToast('Row reset to last-synced Sheet values')
  }

  return (
    <tr className={`border-b border-line/70 transition-colors ${overdue ? 'bg-red-50/50' : 'hover:bg-slate-50/60'}`}>
      <td className={`${cell} relative`}>
        {overdue && <span className="absolute inset-y-0 left-0 w-[3px] bg-amber-500" />}
        <div className="text-[12.5px] text-ink-muted">{index}</div>
        {overdue && <div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wide text-red-600">Overdue</div>}
      </td>

      <td className={cell}>
        <input
          type="text"
          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-semibold
                     text-ink outline-none transition-colors hover:border-line
                     focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/15
                     read-only:hover:border-transparent"
          value={row.name}
          onChange={(e) => update(updateRow(row.recordId, 'name', e.target.value))}
        />
      </td>

      <td className={cell}>
        <StatusSelect
          value={row.section}
          color={s.color}
          options={[
            // A row can sit on no status at all (dismissed sheet value, or its status
            // was deleted); keep that visible rather than snapping it to another one.
            ...(rowProj.statusConfig.some((st) => st.key === row.section)
              ? []
              : [{ value: row.section || '', label: s.label }]),
            ...rowProj.statusConfig.map((st) => ({ value: st.key, label: st.label })),
            // Tracker-only projects have no sheet to learn statuses from: they
            // accumulate as rows are given one.
            ...(manualProject ? [{ value: NEW_STATUS, label: '+ New status…' }] : []),
          ]}
          onChange={(v) => {
            if (v !== NEW_STATUS) {
              update(updateRowSection(row.recordId, v))
              return
            }
            const label = prompt('New status for this project:', '')
            if (label && label.trim()) update(addStatusForRow(row.recordId, label))
          }}
        />
      </td>

      <td className={cell}>
        <select
          className="field-select w-full"
          value={row.action || ''}
          onChange={(e) => update(updateRow(row.recordId, 'action', e.target.value))}
        >
          {/* The two standard parties, this project's own assignees, then blank —
              a real state meaning the sheet didn't say and nobody has claimed it. */}
          {actionOptions(rowProj).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>

      {/* Picked like BRD Date, but stored as dd/mm/yyyy: that's the form the sheet
          sync writes and the briefing reads. Clearing the picker means "-". */}
      <td className={cell}>
        <input
          type="date"
          className="field w-full"
          value={plannedIso}
          onChange={(e) => update(updateRow(row.recordId, 'planned', formatPlanned(e.target.value)))}
        />
      </td>

      <td className={cell}>
        <input
          type="date"
          className="field w-full"
          value={row.brdDate || ''}
          onChange={(e) => update(updateRow(row.recordId, 'brdDate', e.target.value))}
        />
      </td>

      <td className={cell}>
        <input
          type="date"
          className="field w-full"
          value={row.movedDate || ''}
          onChange={(e) => update(updateRow(row.recordId, 'movedDate', e.target.value))}
        />
      </td>

      {customCols.map((c) => (
        <td key={c.id} className={cell}>
          <input
            type="text"
            className="field w-full"
            value={(row.custom && row.custom[c.id]) || ''}
            onChange={(e) => update(updateCustomFieldValue(row.recordId, c.id, e.target.value))}
          />
        </td>
      ))}

      <td className={cell}>
        <div className="flex flex-wrap gap-1">
          {rowProj.flagConfig.map((f) => {
            const active = (row.flags || []).includes(f.id)
            return (
              <label
                key={f.id}
                className={`chip ${active ? 'chip-active' : ''}`}
                style={active ? { backgroundColor: f.color, borderColor: f.color } : undefined}
                title={f.label}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={active}
                  onChange={(e) => update(toggleRowFlag(row.recordId, f.id, e.target.checked))}
                />
                {f.symbol}
              </label>
            )
          })}
        </div>
      </td>

      <td className={cell}>
        <div className="flex items-center gap-1">
          {hasOverride && (
            <button
              className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
              title="Reset all manual overrides on this row back to the last synced Sheet values"
              onClick={reset}
            >
              ↻
            </button>
          )}
          <button
            className="rounded-lg px-2 py-1 text-[15px] text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600"
            title="Delete row"
            onClick={() => update(deleteRow(row.recordId))}
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  )
}
