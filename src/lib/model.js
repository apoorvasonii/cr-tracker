import { normalize, simpleHash, slugifyId, slugifyStatus } from './strings'

/** Fields a user edit can override, and that a sync will otherwise overwrite. */
export const OVERRIDABLE_FIELDS = ['name', 'section', 'action', 'planned', 'overall', 'age', 'brdDate', 'movedDate']

export function defaultGlobalCategories() {
  return [
    { id: 'live', label: 'Live' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'hold', label: 'On Hold' },
    { id: 'none', label: 'Not Counted' },
  ]
}

/**
 * No status vocabulary is shipped: statuses are created from the values actually
 * present in the sheet, on sync. Colour, global category, order, whether a status
 * shows in Actionable Points — all configurable afterwards.
 */
export function defaultStatusConfig() {
  return []
}


/**
 * Overall Status tiles. Every tile — including Total, Live and In Pipeline — is one
 * of these, so nothing about the panel is hardcoded. `source` decides what it counts:
 *   'all'      every CR in the project
 *   'statuses' CRs in the chosen statuses
 *   'category' CRs whose status maps to a global category
 *   'manual'   a number typed in Configure (for totals the sheet doesn't hold)
 * The FIRST tile is the base for the other tiles' percentages.
 */
export const METRIC_SOURCES = [
  { id: 'all', label: 'All CRs' },
  { id: 'statuses', label: 'Chosen statuses' },
  { id: 'category', label: 'Global category' },
  { id: 'manual', label: 'Typed number' },
]

export function makeMetric(overrides = {}) {
  return {
    id: 'metric' + Math.random().toString(36).slice(2, 8),
    label: 'New tile',
    color: '#2b2b2b',
    source: 'statuses',
    statusKeys: [],
    categoryId: '',
    value: 0,
    showPercent: true,
    ...overrides,
  }
}

/** Seeded so a freshly connected sheet reports real numbers instead of zeros. */
export function defaultOverallMetrics() {
  return [
    makeMetric({ id: 'metricTotal', label: 'Total CRs', color: '#2b2b2b', source: 'all', showPercent: false }),
    makeMetric({ id: 'metricLive', label: 'Live', color: '#3f8a52', source: 'category', categoryId: 'live' }),
    makeMetric({ id: 'metricPipeline', label: 'In Pipeline', color: '#2f5fa8', source: 'category', categoryId: 'pipeline' }),
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
  category: 'none',
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
    category: 'pipeline',
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
    category: 'pipeline',
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
    googleSheetUrl: '',
    sheetTabValue: '',
    mapping: defaultMapping(),
    statusConfig: defaultStatusConfig(),
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

/** Category a status belongs to. */
export const UNCOUNTED_CATEGORY = { id: '', label: 'Not counted' }

/**
 * Falls back to an uncounted category, never to globalCategories[0]: that used to
 * be "Live", so a status pointing at a deleted category — or an Unmapped row —
 * quietly inflated the Live count.
 */
export function categoryOf(globalCategories, status) {
  return globalCategories.find((c) => c.id === status.category) || UNCOUNTED_CATEGORY
}

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
    case 'category':
      return rows.filter(
        (r) => categoryOf(state.globalCategories, getStatus(state.projects, r.section, proj.id)).id === metric.categoryId
      ).length
    case 'manual':
      return Number(metric.value) || 0
    default:
      return 0
  }
}

export function projectTiles(state, proj) {
  return (proj.overallMetrics || []).map((m) => ({
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
