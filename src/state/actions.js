/**
 * Every action is a recipe: it receives a draft copy of the whole app state and
 * mutates it in place. `update()` in AppContext does the cloning, so the ported
 * mutation-style logic stays readable while React still sees a new state object.
 */
import {
  ASSIGNEE_PREFIX,
  OVERRIDABLE_FIELDS,
  getProjectById,
  makeAssignee,
  makeMetric,
  makeNewRecord,
  makeProject,
  makeStatusFromLabel,
  mapSheetStatusToProjectStatus,
} from '../lib/model'
import { sequentialId, slugifyStatus, uid } from '../lib/strings'
import { todayIso } from '../lib/dates'

/** Runs `fn` against the draft's copy of the current project, if one is selected. */
const withCurrentProject = (fn) => (draft) => {
  const proj = getProjectById(draft.projects, draft.currentProjectId)
  if (!proj) return
  fn(proj, draft)
}

const withRow = (recordId, fn) => (draft) => {
  const row = draft.crData.find((r) => r.recordId === recordId)
  if (row) fn(row, draft)
}

/* ---------------- Display preferences ---------------- */
/** 'weeks' shows Overall Age in 5-business-day weeks; 'days' shows raw business days. */
export const setOverallAgeUnit = (unit) => (draft) => {
  draft.display = { ...draft.display, overallAgeUnit: unit }
}

/* ---------------- Projects ---------------- */
export const selectProject = (id) => (draft) => { draft.currentProjectId = id }

export const addProject = (name, source = 'sheet') => (draft) => {
  const proj = makeProject(name, name, draft.projects, source)
  draft.projects.push(proj)
  draft.currentProjectId = proj.id
}

export const deleteProject = (id) => (draft) => {
  // Refuse to remove the last project rather than leaving the app with none.
  if (draft.projects.length <= 1) return
  draft.crData = draft.crData.filter((r) => r.projectId !== id)
  draft.projects = draft.projects.filter((p) => p.id !== id)
  if (draft.currentProjectId === id) draft.currentProjectId = draft.projects[0].id
}

export const patchProject = (field, value) => withCurrentProject((proj) => { proj[field] = value })

/* ---------------- Statuses ---------------- */
export const addStatus = () =>
  withCurrentProject((proj) => {
    proj.statusConfig.push({
      key: slugifyStatus('New Status', proj.statusConfig),
      label: 'New Status',
      color: '#5c7a9a',
      showInActionable: true,
      showInBriefing: true,
      delivered: false,
    })
  })

export const updateStatus = (key, field, value) =>
  withCurrentProject((proj) => {
    const s = proj.statusConfig.find((x) => x.key === key)
    if (s) s[field] = value
  })

/**
 * Moves a status up or down in this project's list. That order is the single
 * source of sequence for the Briefing's sections, the row status dropdowns and
 * the Status filter — so there's nothing else to keep in step.
 */
export const moveStatus = (key, direction) =>
  withCurrentProject((proj) => {
    const from = proj.statusConfig.findIndex((s) => s.key === key)
    const to = from + (direction === 'up' ? -1 : 1)
    if (from < 0 || to < 0 || to >= proj.statusConfig.length) return
    const [moved] = proj.statusConfig.splice(from, 1)
    proj.statusConfig.splice(to, 0, moved)
  })

export const removeStatus = (key) =>
  withCurrentProject((proj, draft) => {
    // Rows keep a valid status where one remains, otherwise they read as Unmapped.
    const fallback = (proj.statusConfig.find((s) => s.key !== key) || {}).key || ''
    draft.crData.forEach((r) => {
      if (r.projectId === proj.id && r.section === key) r.section = fallback
    })
    proj.statusConfig = proj.statusConfig.filter((s) => s.key !== key)
    proj.overallMetrics.forEach((m) => { m.statusKeys = m.statusKeys.filter((k) => k !== key) })
    proj.statusMapping = proj.statusMapping.filter((sm) => sm.statusKey !== key)
  })

/** Clears out statuses no CR in this project uses — e.g. ones a sheet no longer contains. */
export const removeUnusedStatuses = () =>
  withCurrentProject((proj, draft) => {
    const used = new Set(draft.crData.filter((r) => r.projectId === proj.id).map((r) => r.section))
    const dropped = proj.statusConfig.filter((s) => !used.has(s.key)).map((s) => s.key)
    if (!dropped.length) return
    proj.statusConfig = proj.statusConfig.filter((s) => used.has(s.key))
    proj.overallMetrics.forEach((m) => { m.statusKeys = m.statusKeys.filter((k) => !dropped.includes(k)) })
    proj.statusMapping = proj.statusMapping.filter((sm) => !dropped.includes(sm.statusKey))
  })

/* ---------------- Assignees ---------------- */
export const addAssignee = (label = '') =>
  withCurrentProject((proj) => {
    proj.assigneeConfig = proj.assigneeConfig || []
    proj.assigneeConfig.push(makeAssignee(label, proj.assigneeConfig))
  })

export const updateAssignee = (id, field, value) =>
  withCurrentProject((proj) => {
    const a = (proj.assigneeConfig || []).find((x) => x.id === id)
    if (a) a[field] = value
  })

/**
 * Rows still pointing at a deleted assignee fall back to Unassigned, so nobody is
 * left holding a responsibility that no longer names anyone.
 */
export const removeAssignee = (id) =>
  withCurrentProject((proj, draft) => {
    proj.assigneeConfig = (proj.assigneeConfig || []).filter((a) => a.id !== id)
    draft.crData.forEach((r) => {
      if (r.projectId !== proj.id || r.action !== ASSIGNEE_PREFIX + id) return
      r.action = ''
      r.overrides = r.overrides || {}
      r.overrides.action = true
    })
  })

/* ---------------- Overall metrics ---------------- */
export const addOverallMetric = () =>
  withCurrentProject((proj) => {
    proj.overallMetrics.push(makeMetric())
  })

/** Tile order matters: the first tile is the base for every other tile's percentage. */
export const moveOverallMetric = (id, direction) =>
  withCurrentProject((proj) => {
    const from = proj.overallMetrics.findIndex((m) => m.id === id)
    const to = from + (direction === 'up' ? -1 : 1)
    if (from < 0 || to < 0 || to >= proj.overallMetrics.length) return
    const [moved] = proj.overallMetrics.splice(from, 1)
    proj.overallMetrics.splice(to, 0, moved)
  })

export const updateOverallMetric = (id, field, value) =>
  withCurrentProject((proj) => {
    const m = proj.overallMetrics.find((x) => x.id === id)
    if (m) m[field] = value
  })

export const removeOverallMetric = (id) =>
  withCurrentProject((proj) => { proj.overallMetrics = proj.overallMetrics.filter((m) => m.id !== id) })

export const toggleOverallMetricStatus = (id, statusKey, checked) =>
  withCurrentProject((proj) => {
    const m = proj.overallMetrics.find((x) => x.id === id)
    if (!m) return
    // A tile switched over from a category or a typed number has no list yet.
    if (!Array.isArray(m.statusKeys)) m.statusKeys = []
    if (checked) { if (!m.statusKeys.includes(statusKey)) m.statusKeys.push(statusKey) }
    else m.statusKeys = m.statusKeys.filter((k) => k !== statusKey)
  })

/* ---------------- Flags ---------------- */
export const addFlag = () =>
  withCurrentProject((proj) => {
    proj.flagConfig.push({
      id: sequentialId('flag', proj.flagConfig),
      symbol: '●',
      color: '#4a7fae',
      label: 'New flag',
      note: 'Add a footnote for this flag.',
    })
  })

export const updateFlag = (id, field, value) =>
  withCurrentProject((proj) => {
    const f = proj.flagConfig.find((x) => x.id === id)
    if (f) f[field] = value
  })

export const removeFlag = (id) =>
  withCurrentProject((proj, draft) => {
    proj.flagConfig = proj.flagConfig.filter((f) => f.id !== id)
    draft.crData.forEach((r) => {
      if (r.projectId === proj.id) r.flags = (r.flags || []).filter((fid) => fid !== id)
    })
  })

/* ---------------- Sheet tabs ---------------- */
/* ---------------- Status mapping ---------------- */
export const addStatusMappingRow = () =>
  withCurrentProject((proj) => {
    proj.statusMapping.push({ id: 'sm' + uid(), sheetValue: '', statusKey: (proj.statusConfig[0] || {}).key || '' })
  })

export const updateStatusMappingRow = (id, field, value) =>
  withCurrentProject((proj) => {
    const sm = proj.statusMapping.find((x) => x.id === id)
    if (sm) sm[field] = value
  })

export const removeStatusMappingRow = (id) =>
  withCurrentProject((proj) => { proj.statusMapping = proj.statusMapping.filter((sm) => sm.id !== id) })

/** Maps a value discovered during sync, updating any existing mapping for it. */
export const quickAssignDiscoveredStatus = (rawValue, statusKey, normalize) =>
  withCurrentProject((proj) => {
    if (!statusKey) return
    const existing = proj.statusMapping.find((sm) => normalize(sm.sheetValue) === normalize(rawValue))
    if (existing) existing.statusKey = statusKey
    else proj.statusMapping.push({ id: 'sm' + uid(), sheetValue: rawValue, statusKey })
  })

/**
 * Dismisses a sheet value so sync stops creating a status for it. Rows carrying
 * that value read as Unmapped instead — never reassigned to some other status.
 */
export const ignoreDiscoveredStatusValue = (rawValue) =>
  withCurrentProject((proj) => {
    proj.ignoredStatusValues = proj.ignoredStatusValues || []
    if (!proj.ignoredStatusValues.includes(rawValue)) proj.ignoredStatusValues.push(rawValue)
  })

export const unignoreStatusValue = (rawValue) =>
  withCurrentProject((proj) => {
    proj.ignoredStatusValues = (proj.ignoredStatusValues || []).filter((v) => v !== rawValue)
  })

/**
 * Re-resolves every row's status from the sheet wording it was synced with, using
 * the mapping as it stands now. Sync normally does this, but only for rows it
 * fetches — this applies mapping edits without waiting for the next sync.
 *
 * Rows whose status was changed by hand are left alone: that edit is an override,
 * and sync respects those too. Returns a count for the caller's toast.
 */
export const applyStatusMappingToRows = () => (draft) => {
  const proj = getProjectById(draft.projects, draft.currentProjectId)
  if (!proj) return { changed: 0, skipped: 0, unknown: 0 }

  let changed = 0
  let skipped = 0
  let unknown = 0

  draft.crData.forEach((r) => {
    if (r.projectId !== proj.id) return
    if (!r.rawSection) {
      unknown++
      return
    }
    if (r.overrides && r.overrides.section) {
      skipped++
      return
    }
    const key = mapSheetStatusToProjectStatus(proj, r.rawSection)
    if (!key || key === r.section) return
    r.section = key
    if (r.sourceSnapshot) r.sourceSnapshot.section = key
    changed++
  })

  return { changed, skipped, unknown }
}

/* ---------------- Column mapping ---------------- */
/** Clears one mapped sheet column, leaving that tracker field unmapped. */
export const clearColumnMapping = (field) =>
  withCurrentProject((proj) => {
    proj.mapping[field] = ''
  })

/* ---------------- Custom columns ---------------- */
export const addCustomColumn = (label, type, mappedColumn) =>
  withCurrentProject((proj) => {
    proj.customColumns.push({ id: 'col' + uid(), label, type, mappedColumn: mappedColumn || '' })
  })

export const removeCustomColumn = (id) =>
  withCurrentProject((proj) => { proj.customColumns = proj.customColumns.filter((c) => c.id !== id) })

/* ---------------- CR rows ---------------- */
/** Any edit here is, by definition, a manual override. */
export const updateRow = (recordId, field, value) =>
  withRow(recordId, (row) => {
    row[field] = value
    if (OVERRIDABLE_FIELDS.includes(field)) {
      row.overrides = row.overrides || {}
      row.overrides[field] = true
    }
  })

/** Changing status also stamps "moved to current status" with today. */
export const updateRowSection = (recordId, value) =>
  withRow(recordId, (row) => {
    row.section = value
    row.movedDate = todayIso()
    row.overrides = row.overrides || {}
    row.overrides.section = true
    row.overrides.movedDate = true
  })

/**
 * Tracker-only projects have no sheet to learn statuses from, so their vocabulary
 * is built here: a status typed on a row is added to the project and reused by
 * every later row.
 */
export const addStatusForRow = (recordId, label) => (draft) => {
  const row = draft.crData.find((r) => r.recordId === recordId)
  if (!row) return
  const proj = getProjectById(draft.projects, row.projectId)
  if (!proj) return

  const trimmed = label.trim()
  if (!trimmed) return
  const existing = proj.statusConfig.find((s) => s.label.toLowerCase() === trimmed.toLowerCase())
  const status = existing || makeStatusFromLabel(trimmed, proj.statusConfig)
  if (!existing) proj.statusConfig.push(status)

  row.section = status.key
  row.movedDate = todayIso()
  row.overrides = row.overrides || {}
  row.overrides.section = true
  row.overrides.movedDate = true
}

export const updateCustomFieldValue = (recordId, columnId, value) =>
  withRow(recordId, (row) => {
    row.custom = row.custom || {}
    row.custom[columnId] = value
    row.customOverrides = row.customOverrides || {}
    row.customOverrides[columnId] = true
  })

export const toggleRowFlag = (recordId, flagId, checked) =>
  withRow(recordId, (row) => {
    row.flags = row.flags || []
    if (checked) { if (!row.flags.includes(flagId)) row.flags.push(flagId) }
    else row.flags = row.flags.filter((id) => id !== flagId)
  })

export const resetRowOverrides = (recordId) =>
  withRow(recordId, (row) => {
    Object.keys(row.overrides || {}).forEach((field) => {
      if (row.sourceSnapshot && field in row.sourceSnapshot) row[field] = row.sourceSnapshot[field]
    })
    row.overrides = {}
    Object.keys(row.customOverrides || {}).forEach((colId) => {
      if (row.customSourceSnapshot && colId in row.customSourceSnapshot) {
        row.custom = row.custom || {}
        row.custom[colId] = row.customSourceSnapshot[colId]
      }
    })
    row.customOverrides = {}
  })

export const addRow = () =>
  withCurrentProject((proj, draft) => {
    const sourceRecordId = 'manual:' + uid()
    const recordId = proj.id + '::' + sourceRecordId
    draft.crData.push(
      makeNewRecord(proj.id, sourceRecordId, recordId, {
        name: 'New CR',
        section: (proj.statusConfig[0] || {}).key || '',
        action: '',
        planned: '-',
        overall: '-',
        age: '-',
      })
    )
  })

export const deleteRow = (recordId) => (draft) => {
  draft.crData = draft.crData.filter((r) => r.recordId !== recordId)
}

/* ---------------- Mapping (from the Map Columns modal) ---------------- */
export const saveMapping = (mapping, customMappings) =>
  withCurrentProject((proj) => {
    proj.mapping = mapping
    Object.entries(customMappings || {}).forEach(([colId, sheetCol]) => {
      const c = proj.customColumns.find((x) => x.id === colId)
      if (c) c.mappedColumn = sheetCol
    })
  })

export const setFetchedHeaders = (headers) => withCurrentProject((proj) => { proj.lastFetchedHeaders = headers })
