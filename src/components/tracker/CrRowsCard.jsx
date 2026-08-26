import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../state/AppContext'
import { addRow, removeCustomColumn, setOverallAgeUnit } from '../../state/actions'
import {
  actionLabelOf,
  actionOptions,
  getProjectById,
  getStatus,
  isManualProject,
} from '../../lib/model'
import FilterDropdown from './FilterDropdown'
import CrRow from './CrRow'
import AddColumnModal from '../modals/AddColumnModal'

/** Segmented control for the Overall Age unit. The tracker no longer shows the age
    columns, so this shapes the Briefing and the email. */
function AgeUnitToggle({ unit, onChange }) {
  return (
    <div className="flex h-10 items-center gap-0.5 rounded-lg border border-line bg-slate-50 p-0.5" title="Overall Age unit used in the Briefing and the email">
      <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Age</span>
      {[
        { id: 'weeks', label: 'Weeks' },
        { id: 'days', label: 'Days' },
      ].map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`h-8 rounded-md px-2.5 text-[12px] font-semibold transition-colors ${
            unit === o.id ? 'bg-white text-ink shadow-card' : 'text-ink-muted hover:text-ink-soft'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function HeaderCell({ label, width, onRemove, align }) {
  return (
    <th
      style={{ width }}
      className={`group whitespace-nowrap border-b border-line px-3 py-3 text-[10.5px] font-semibold uppercase
                  tracking-wider text-ink-muted ${align === 'center' ? 'text-center' : 'text-left'}`}
    >
      {label}
      {onRemove && (
        <button
          className="ml-1.5 text-ink-muted opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
          title={`Remove column "${label}"`}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </th>
  )
}

export default function CrRowsCard() {
  const { state, currentProject: proj, update, showToast } = useApp()
  const [search, setSearch] = useState('')
  const [openPanel, setOpenPanel] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null) // null = all
  const [actionFilter, setActionFilter] = useState(null)
  const [compact, setCompact] = useState(false)
  const [addColumnOpen, setAddColumnOpen] = useState(false)

  // Filters hold status keys, and keys are per project — carrying a filter across a
  // project switch would silently hide every row. Same for the search box.
  useEffect(() => {
    setStatusFilter(null)
    setActionFilter(null)
    setSearch('')
    setOpenPanel(null)
  }, [state.currentProjectId])

  const statuses = proj ? proj.statusConfig : []
  const statusKeys = statuses.map((s) => s.key)
  const actionChoices = actionOptions(proj)
  const actionKeys = actionChoices.map((o) => o.value)
  const effectiveStatus = statusFilter ?? new Set(statusKeys)
  const effectiveAction = actionFilter ?? new Set(actionKeys)

  const customCols = proj?.customColumns || []

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim()
    return state.crData.filter((row) => {
      if (row.projectId !== state.currentProjectId) return false
      // Typing matches what the row shows: its name, its status, or whose court
      // it's in — so "live", "unassigned" or "salescode" all work as searches.
      if (q) {
        const rowProj = getProjectById(state.projects, row.projectId)
        const haystack = [
          row.name,
          getStatus(state.projects, row.section, row.projectId).label,
          actionLabelOf(rowProj, row.action),
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      // Only filter when a filter is actually set, so rows with no status yet
      // (a fresh tracker-only row, or one whose status was deleted) stay visible.
      if (statusFilter && !statusFilter.has(row.section)) return false
      if (actionFilter && !actionFilter.has(row.action)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.crData, state.projects, state.currentProjectId, search, statusFilter, actionFilter, statusKeys.join()])

  const scopedTotal = state.crData.filter((r) => r.projectId === state.currentProjectId).length

  const isFiltered = search || statusFilter || actionFilter


  return (
    <>
      <div className="card overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative min-w-[240px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">⌕</span>
            <input
              type="text"
              className="field w-full pl-8"
              placeholder="Search requests, owners, status…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <FilterDropdown
            label="Status"
            open={openPanel === 'status'}
            onToggleOpen={(o) => setOpenPanel(o ? 'status' : null)}
            options={statuses.map((s) => ({ value: s.key, label: s.label, dot: s.color }))}
            selected={effectiveStatus}
            onChange={setStatusFilter}
          />
          <FilterDropdown
            label="Responsibility"
            open={openPanel === 'action'}
            onToggleOpen={(o) => setOpenPanel(o ? 'action' : null)}
            options={actionChoices.map((o) => ({ value: o.value, label: o.label, dot: o.color }))}
            selected={effectiveAction}
            onChange={setActionFilter}
          />

          {isFiltered && (
            <button
              className="btn-ghost text-ink-muted"
              onClick={() => {
                setSearch('')
                setStatusFilter(null)
                setActionFilter(null)
              }}
            >
              Clear filters
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[12px] text-ink-muted sm:block">
              {visible.length === scopedTotal
                ? `${scopedTotal} row${scopedTotal === 1 ? '' : 's'}`
                : `${visible.length} of ${scopedTotal} rows`}
            </span>
            <AgeUnitToggle
              unit={state.display?.overallAgeUnit ?? 'weeks'}
              onChange={(u) => update(setOverallAgeUnit(u))}
            />
            <button className="btn text-ink-soft" onClick={() => setCompact((c) => !c)}>
              {compact ? 'Comfortable rows' : 'Compact rows'}
            </button>
            <button className="btn" onClick={() => setAddColumnOpen(true)}>
              + Column
            </button>
            <button className="btn-primary" onClick={() => update(addRow())}>
              + Row
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50/60">
              <tr>
                <HeaderCell label="#" width="52px" />
                <HeaderCell label="Feature" width="22%" />
                <HeaderCell label="Status" width="185px" />
                <HeaderCell label="Next Action On" width="165px" />
                <HeaderCell label="Planned End Date" width="125px" />
                <HeaderCell label="BRD Date" width="125px" />
                <HeaderCell label="Moved to Status" width="125px" />
                {customCols.map((c) => (
                  <HeaderCell
                    key={c.label}
                    label={c.label}
                    width="140px"
                    onRemove={() => {
                      update(removeCustomColumn(c.id))
                      showToast(`Column "${c.label}" removed`)
                    }}
                  />
                ))}
                <HeaderCell label="Flags" width="120px" />
                <HeaderCell label="" width="70px" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => (
                <CrRow
                  key={row.recordId}
                  index={i + 1}
                  row={row}
                  customCols={customCols}
                  compact={compact}
                />
              ))}
            </tbody>
          </table>

          {visible.length === 0 && (
            <p className="px-4 py-14 text-center text-[13px] text-ink-muted">
              {scopedTotal === 0
                ? isManualProject(proj)
                  ? 'No CR rows yet — use “+ Row” to add the first CR, then give it a status.'
                  : 'No CR rows yet — connect a Google Sheet and sync, or add a row.'
                : 'No rows match these filters.'}
            </p>
          )}
        </div>
      </div>

      <AddColumnModal open={addColumnOpen} onClose={() => setAddColumnOpen(false)} />
    </>
  )
}
