import { normalize, simpleHash, slugifyId, slugifyStatus } from './strings'
import { todayIso } from './dates'

/** Fields a user edit can override, and that a sync will otherwise overwrite. */
export const OVERRIDABLE_FIELDS = ['name', 'section', 'action', 'planned', 'overall', 'age', 'brdDate', 'movedDate']

/**
 * Every project starts with this standard vocabulary. A project's BA can then
 * rename, recolour, reorder or remove any of them under Configure → Statuses;
 * sheet values not in the list are still added as statuses on sync.
 */
export const STANDARD_STATUSES = [
  // Listed in lifecycle order, which is also the Briefing's section order.
  { key: 'screview', label: 'Under Salescode Review', color: '#2f5fa8' },
  { key: 'clientuat', label: 'Under client UAT', color: '#7c5cc9' },
  { key: 'uatfeedback', label: 'Under UAT Feedback', color: '#b8763a' },
  { key: 'readyforprod', label: 'Ready for Prod Release', color: '#2d7a94' },
  { key: 'live', label: 'Live', color: '#3f8a52', delivered: true, showInActionable: false },
  { key: 'clientdep', label: 'Dependency on Client', color: '#96332a' },
  { key: 'onhold', label: 'On Hold', color: '#8a5a1f' },
]

/**
 * Tracker columns a project can hide. Hiding is display-only: the data stays,
 * syncs and prints in the Briefing as before. Feature and Status always show.
 */
export const HIDEABLE_COLUMNS = [
  { id: 'action', label: 'Next Action On' },
  { id: 'planned', label: 'Planned End Date' },
  { id: 'uatDate', label: 'UAT Date' },
  { id: 'brdDate', label: 'BRD Date' },
  { id: 'movedDate', label: 'Last Action Date' },
  { id: 'flags', label: 'Flags' },
]

/** The date column the Briefing and email print, chosen per status. */
export const BRIEFING_DATE_FIELDS = [
  { id: 'planned', label: 'Planned End Date' },
  { id: 'uatDate', label: 'UAT Date' },
]

export const briefingDateField = (status) =>
  BRIEFING_DATE_FIELDS.find((f) => f.id === (status && status.briefingDate)) || BRIEFING_DATE_FIELDS[0]

/* ---------------- Delivery history ---------------- */

const isDeliveredKey = (proj, key) => !!(proj.statusConfig.find((s) => s.key === key) || {}).delivered

/**
 * Logs a CR entering a Delivered status (e.g. Live), or leaving one again.
 * The log lives on the project, not the row, so it survives the row being
 * deleted or swept by a sync. `source` is 'tracker' or 'sheet'.
 */
export function noteStatusChange(proj, row, prevKey, source) {
  if (prevKey === row.section) return
  const wasDelivered = isDeliveredKey(proj, prevKey)
  const isDelivered = isDeliveredKey(proj, row.section)
  if (wasDelivered === isDelivered) return
  proj.deliveryLog = proj.deliveryLog || []
  if (isDelivered) {
    const status = proj.statusConfig.find((s) => s.key === row.section)
    proj.deliveryLog.push({
      id: 'dl' + Math.random().toString(36).slice(2, 10),
      recordId: row.recordId,
      name: row.name,
      statusLabel: status.label,
      at: todayIso(),
      source,
    })
  } else {
    const open = [...proj.deliveryLog].reverse().find((e) => e.recordId === row.recordId && !e.revertedAt)
    if (open) open.revertedAt = todayIso()
  }
}

/**
 * Everything this project has delivered, newest first. CRs already sitting in a
 * Delivered status from before the log existed are included too, dated by their
 * Last Action Date (marked `estimated`).
 */
export function deliveryHistory(proj, crData) {
  const log = proj.deliveryLog || []
  const rows = crData.filter((r) => r.projectId === proj.id)
  const byId = new Map(rows.map((r) => [r.recordId, r]))
  const logged = new Set(log.filter((e) => !e.revertedAt).map((e) => e.recordId))
  const entries = log.map((e) => {
    const row = byId.get(e.recordId)
    return { ...e, name: row ? row.name : e.name, deleted: !row }
  })
  rows
    .filter((r) => isDeliveredKey(proj, r.section) && !logged.has(r.recordId))
    .forEach((r) => {
      entries.push({
        id: 'est-' + r.recordId,
        recordId: r.recordId,
        name: r.name,
        statusLabel: (proj.statusConfig.find((s) => s.key === r.section) || {}).label,
        at: r.movedDate || '',
        estimated: true,
      })
    })
  return entries.sort((a, b) => (b.at || '').localeCompare(a.at || ''))
}

/** Where a manually added CR starts, if the project still has it. */
export const DEFAULT_NEW_CR_STATUS = 'Under Salescode Review'

export function makeStandardStatus(def) {
  return { showInActionable: true, showInBriefing: true, delivered: false, ...def }
}

export function defaultStatusConfig() {
  return STANDARD_STATUSES.map(makeStandardStatus)
}


/**
 * Overall Status tiles. Every tile — including Total, Live and In Pipeline — is one
 * of these, so nothing about the panel is hardcoded. `source` decides what it counts:
 *   'all'      every CR in the project
 *   'statuses' CRs in the chosen statuses
 *   'manual'   a number typed in Configure (for totals the sheet doesn't hold)
 * The FIRST tile is the base for the other tiles' percentages.
 */
export const METRIC_SOURCES = [
  { id: 'all', label: 'All CRs' },
  { id: 'statuses', label: 'Chosen statuses' },
  { id: 'manual', label: 'Typed number' },
]

export function makeMetric(overrides = {}) {
  return {
    id: 'metric' + Math.random().toString(36).slice(2, 8),
    label: 'New tile',
    color: '#2b2b2b',
    source: 'statuses',
    statusKeys: [],
    value: 0,
    hidden: false,
    showPercent: true,
    ...overrides,
  }
}

/** Seeded so a freshly connected sheet reports real numbers instead of zeros. */
export function defaultOverallMetrics() {
  return [
    makeMetric({ id: 'metricTotal', label: 'Total CRs', color: '#2b2b2b', source: 'all', showPercent: false }),
    makeMetric({ id: 'metricLive', label: 'Live', color: '#3f8a52', source: 'statuses', statusKeys: ['live'] }),
    makeMetric({
      id: 'metricPipeline', label: 'In Pipeline', color: '#2f5fa8', source: 'statuses',
      statusKeys: STANDARD_STATUSES.filter((s) => !s.delivered && s.key !== 'onhold').map((s) => s.key),
    }),
  ]
}

/** Colours handed to auto-created statuses, cycled so new ones stay distinguishable. */
const STATUS_PALETTE = [
  '#2f5fa8', '#2d7a94', '#7c5cc9', '#b8763a', '#3f8a52',
  '#b3372c', '#96332a', '#5c6bc0', '#1f6f8b', '#8a5a1f',
]

/** A row whose sheet value maps to no status — displayed, never silently reassigned. */
export const UNMAPPED_STATUS = {
  key: '',
  label: 'Unmapped',
  color: '#8a94a2',
  showInActionable: false,
  delivered: false,
}

/** Builds a status from a raw sheet value, keeping the sheet's own wording as the label. */
export function makeStatusFromSheetValue(rawValue, existing) {
  const label = rawValue.toString().trim()
  return {
    key: slugifyStatus(label, existing),
    label,
    color: STATUS_PALETTE[existing.length % STATUS_PALETTE.length],
    showInActionable: true,
    showInBriefing: true,
    delivered: false,
    fromSheet: true, // created by sync rather than by hand
  }
}

/** Builds a status from a label typed on the tracker (tracker-only projects). */
export function makeStatusFromLabel(label, existing) {
  const trimmed = label.toString().trim()
  return {
    key: slugifyStatus(trimmed, existing),
    label: trimmed,
    color: STATUS_PALETTE[existing.length % STATUS_PALETTE.length],
    showInActionable: true,
    showInBriefing: true,
    delivered: false,
  }
}

export function defaultFlagConfig() {
  return [
    {
      id: 'flag1',
      symbol: '*',
      color: '#b3372c',
      label: 'Note',
      note: 'Add the footnote that should print under the briefing whenever this flag is used.',
    },
  ]
}

/** The delivery-side party, opposite the client/LOB. Fixed for every project. */
export const VENDOR_NAME = 'Salescode'

export function defaultMapping() {
  return { name: '', section: '', action: '', planned: '', idColumn: '', brdDateCol: '', movedDateCol: '' }
}

/** A project either mirrors a Google Sheet ('sheet') or is filled in by hand ('manual'). */
export const isManualProject = (proj) => !!proj && proj.source === 'manual'

export function makeProject(lobName, displayName, existingProjects = [], source = 'sheet') {
  return {
    id: slugifyId(lobName, existingProjects),
    lobName: lobName || 'New Project',
    displayName: displayName || lobName || 'New Project',
    // The line across the top of the Briefing, after the display name, and the
    // smaller line under it. Both are free text; an empty sub-heading is hidden.
    briefingHeader: 'CR Tracker',
    briefingSubheader: '',
    source, // 'sheet' = synced from Google Sheets, 'manual' = rows entered in the tracker
    dateOrder: 'dmy', // how to read ambiguous numeric sheet dates: 'dmy' | 'mdy'
    overallAgeUnit: 'weeks', // how this project's Briefing expresses Overall Age: 'weeks' | 'days'
    googleSheetUrl: '',
    sheetTabValue: '',
    mapping: defaultMapping(),
    statusConfig: defaultStatusConfig(),
    standardStatusesSeeded: true,
    standardStatusesOrdered: true,
    hiddenColumns: [], // ids from HIDEABLE_COLUMNS
    statusMapping: [], // [{ id, sheetValue, statusKey }]
    discoveredStatusValues: [], // raw values last seen in the mapped status column
    discoveredActionValues: [], // raw values last seen in the mapped Next Action On column
    ignoredStatusValues: [], // discovered values dismissed as "don't ask again"
    flagConfig: defaultFlagConfig(),
    assigneeConfig: [], // [{ id, label, color }] — extra parties a CR can sit with
    overallMetrics: defaultOverallMetrics(),
    customColumns: [], // [{ id, label, type: 'sheet'|'manual', mappedColumn }]
    lastSyncedAt: null,
    syncStatus: 'never', // never | syncing | success | failed
    syncError: null,
    lastSyncStats: null,
    lastFetchedHeaders: [],
  }
}

/* =====================================================================
   RECORD IDENTITY — never CR Name alone. projectId + sourceRecordId.
   ===================================================================== */

/** Stable combination of mapped identifying fields — deliberately NOT row
    position, so inserting/reordering rows can't mint false "new" records. */
export function stableFallbackId(mapping, row) {
  const parts = [mapping.name, mapping.section, mapping.planned]
    .map((col) => (col ? normalize(row[col]) : ''))
    .join('|')
  return 'fallback:' + simpleHash(parts)
}

export function makeNewRecord(projectId, sourceRecordId, recordId, incoming) {
  return {
    recordId,
    projectId,
    sourceRecordId,
    name: incoming.name || '',
    section: incoming.section || '',
    // The sheet's own status wording, kept so Status Mapping edits can be replayed
    // onto existing rows without re-fetching the sheet.
    rawSection: incoming.rawSection || '',
    action: incoming.action || '',
    planned: incoming.planned || '-',
    overall: incoming.overall || '-',
    age: incoming.age || '-',
    brdDate: incoming.brdDate || '',
    uatDate: '', // tracker-only: when UAT delivery is due, independent of status
    movedDate: incoming.movedDate || '',
    flags: incoming.flags ? incoming.flags.slice() : [],
    custom: incoming.custom ? { ...incoming.custom } : {},
    overrides: {},
    sourceSnapshot: { ...incoming },
    customOverrides: {},
    customSourceSnapshot: incoming.custom ? { ...incoming.custom } : {},
  }
}

/* ---------------- Lookups ---------------- */
export const getProjectById = (projects, id) => projects.find((p) => p.id === id) || null

/** Never substitutes a different status: anything unrecognized reads as Unmapped. */
export function getStatus(projects, key, projectId) {
  const proj = getProjectById(projects, projectId)
  const list = (proj && proj.statusConfig) || []
  return list.find((s) => s.key === key) || UNMAPPED_STATUS
}

/**
 * Responsibility a row carries. '' is a real state — the sheet's cell was blank or
 * named someone the tracker can't place — and stays that way until a person picks
 * a side on the tracker, rather than being guessed as either party.
 */
export const UNASSIGNED_ACTION = ''

/** Every responsibility a row can carry, in the order they're offered. */
export const ACTIONS = ['client', 'vendor', 'both', '']

/**
 * Responsibility can also sit with someone the two standard parties don't cover —
 * a partner, an individual owner, a third-party vendor. Those are configured per
 * project and stored on the row as 'assignee:<id>', so a value the tracker can no
 * longer resolve degrades to Unassigned instead of showing a raw id.
 */
export const ASSIGNEE_PREFIX = 'assignee:'

export const assigneeIdOf = (action) =>
  typeof action === 'string' && action.startsWith(ASSIGNEE_PREFIX) ? action.slice(ASSIGNEE_PREFIX.length) : ''

export const getAssignee = (proj, action) => {
  const id = assigneeIdOf(action)
  if (!id || !proj) return null
  return (proj.assigneeConfig || []).find((a) => a.id === id) || null
}

/** Colours handed to new assignees, cycled so they stay distinguishable. */
const ASSIGNEE_PALETTE = ['#7a6a3f', '#3f7a72', '#8a3f6a', '#4a5a7a', '#6a7a3f', '#7a4a4a']

export function makeAssignee(label, existing = []) {
  const trimmed = (label || '').toString().trim() || 'New assignee'
  return {
    id: slugifyId(trimmed, existing),
    label: trimmed,
    color: ASSIGNEE_PALETTE[existing.length % ASSIGNEE_PALETTE.length],
  }
}

export const actionLabelOf = (proj, action) => {
  const lob = proj ? proj.lobName : 'Client'
  if (action === 'vendor') return VENDOR_NAME
  if (action === 'client') return lob
  if (action === 'both') return `${lob} + ${VENDOR_NAME}`
  const assignee = getAssignee(proj, action)
  if (assignee) return assignee.label
  return 'Unassigned'
}

export const actionColorOf = (proj, action) => {
  if (action === 'vendor') return '#4a7fae'
  if (action === 'client') return '#8a5a3f'
  if (action === 'both') return '#6a5a9a'
  return getAssignee(proj, action)?.color || '#8a94a2'
}

/**
 * Every responsibility offered for a project, in the order they're listed: the
 * two parties, both of them, each configured assignee, then Unassigned last.
 */
export const actionOptions = (proj) => [
  ...ACTIONS.filter((a) => a !== UNASSIGNED_ACTION).map((value) => ({
    value,
    label: actionLabelOf(proj, value),
    color: actionColorOf(proj, value),
  })),
  ...((proj && proj.assigneeConfig) || []).map((a) => ({
    value: ASSIGNEE_PREFIX + a.id,
    label: a.label,
    color: a.color,
  })),
  { value: UNASSIGNED_ACTION, label: 'Unassigned', color: actionColorOf(proj, UNASSIGNED_ACTION) },
]

export function getFlag(projects, id, projectId) {
  const proj = getProjectById(projects, projectId)
  return proj ? proj.flagConfig.find((f) => f.id === id) || null : null
}

/**
 * Sheet status value -> this project's status key. Explicit mapping first, then an
 * exact (case/punctuation-insensitive) label match. No fuzzy substring matching:
 * that's what used to file "Dev & QA" under "Beta Testing" purely because neither
 * had an exact match. Returns '' when nothing matches — sync then creates the
 * status from the sheet's own value.
 */
export function mapSheetStatusToProjectStatus(proj, rawValue) {
  if (!rawValue) return ''
  const n = normalize(rawValue)
  const explicit = (proj.statusMapping || []).find((sm) => normalize(sm.sheetValue) === n)
  if (explicit) return explicit.statusKey
  const exact = (proj.statusConfig || []).find((s) => normalize(s.label) === n)
  return exact ? exact.key : ''
}

/* ---------------- Overall Status tiles ---------------- */

/** What a single tile counts, within one project. */
export function metricValue(state, proj, metric) {
  const rows = state.crData.filter((r) => r.projectId === proj.id)
  switch (metric.source) {
    case 'all':
      return rows.length
    case 'statuses':
      return rows.filter((r) => (metric.statusKeys || []).includes(r.section)).length
    case 'manual':
      return Number(metric.value) || 0
    default:
      return 0
  }
}

export function projectTiles(state, proj) {
  // A hidden tile keeps its label, colour and definition; it just doesn't print.
  return (proj.overallMetrics || []).filter((m) => !m.hidden).map((m) => ({
    key: m.id,
    label: m.label,
    color: m.color,
    showPercent: m.showPercent !== false,
    value: metricValue(state, proj, m),
  }))
}

/** Tiles for the project being viewed. */
export function scopedTiles(state) {
  const proj = getProjectById(state.projects, state.currentProjectId)
  return proj ? projectTiles(state, proj) : []
}

/** The first tile is the denominator for every other tile's percentage. */
export const percentBase = (tiles) => (tiles.length ? tiles[0].value : 0)

export function getCustomValueForRow(projects, row, label) {
  const proj = getProjectById(projects, row.projectId)
  if (!proj) return ''
  const col = (proj.customColumns || []).find((c) => c.label === label)
  if (!col) return ''
  return (row.custom && row.custom[col.id]) || ''
}
