import { Store } from './storage'
import { STANDARD_STATUSES, defaultMapping, makeMetric, makeProject, makeStandardStatus } from '../lib/model'
import { normalize } from '../lib/strings'

/** Backfills fields added by later versions onto older persisted projects. */
export function migrateProject(p, legacyAgeUnit) {
  if (!p.statusMapping) p.statusMapping = []
  if (!p.discoveredStatusValues) p.discoveredStatusValues = []
  if (!p.discoveredActionValues) p.discoveredActionValues = []
  if (!p.ignoredStatusValues) p.ignoredStatusValues = []
  if (!p.customColumns) p.customColumns = []
  if (!p.assigneeConfig) p.assigneeConfig = []
  if (!p.hiddenColumns) p.hiddenColumns = []
  // Saved tab labels are gone: a workbook's own tab names are offered instead.
  delete p.sheetTabConfig
  if (!p.mapping) p.mapping = defaultMapping()
  if (!('idColumn' in p.mapping)) p.mapping.idColumn = ''

  // Overall Age / Age in Current State used to have their own "use column directly /
  // calculate from a date column" toggle. BRD Date and Moved to Current Status are
  // now mapped directly instead.
  if (!('brdDateCol' in p.mapping)) {
    p.mapping.brdDateCol = p.mapping.overallMode === 'date' ? p.mapping.overallDateCol || '' : ''
    delete p.mapping.overallMode
    delete p.mapping.overallCol
    delete p.mapping.overallDateCol
  }
  if (!('movedDateCol' in p.mapping)) {
    p.mapping.movedDateCol = p.mapping.ageMode === 'date' ? p.mapping.ageDateCol || '' : ''
    delete p.mapping.ageMode
    delete p.mapping.ageCol
    delete p.mapping.ageDateCol
  }

  // Listing in the Briefing used to be unconditional.
  ;(p.statusConfig || []).forEach((s) => {
    if (!('showInBriefing' in s)) s.showInBriefing = true
  })

  // The delivery-side party was briefly per-project config; it's fixed again.
  delete p.vendorName

  // Numeric sheet dates used to be read day-first for everyone.
  if (!p.dateOrder) p.dateOrder = 'dmy'
  if (!p.briefingHeader) p.briefingHeader = 'CR Tracker'
  if (typeof p.briefingSubheader !== 'string') p.briefingSubheader = ''

  // Every project used to be sheet-backed; manual projects came later.
  if (!p.source) p.source = 'sheet'

  // Overall Status tiles: Total/Live/In Pipeline used to be fixed fields (`meta`)
  // with auto-count toggles, and only the extra tiles were configurable. Fold both
  // into one configurable list, preserving exactly what this project displays today.
  if (!(p.overallMetrics || []).some((m) => m.source)) {
    const meta = p.meta || { total: 0, live: 0, pipeline: 0 }
    const auto = p.metaAuto || { total: false, live: false, pipeline: false }
    const standard = [
      { id: 'metricTotal', label: 'Total CRs', color: '#2b2b2b', showPercent: false,
        ...(auto.total ? { source: 'all' } : { source: 'manual', value: meta.total || 0 }) },
      { id: 'metricLive', label: 'Live', color: '#3f8a52', showPercent: true,
        ...(auto.live ? { source: 'category', categoryId: 'live' } : { source: 'manual', value: meta.live || 0 }) },
      { id: 'metricPipeline', label: 'In Pipeline', color: '#2f5fa8', showPercent: true,
        ...(auto.pipeline ? { source: 'category', categoryId: 'pipeline' } : { source: 'manual', value: meta.pipeline || 0 }) },
    ].map((m) => makeMetric(m))

    const extras = (p.overallMetrics || []).map((m) =>
      makeMetric({ id: m.id, label: m.label, color: m.color, source: 'statuses', statusKeys: m.statusKeys || [] })
    )
    p.overallMetrics = [...standard, ...extras]
  }
  delete p.meta
  delete p.metaAuto

  // Global status categories are gone: a tile now names the statuses it counts,
  // and the only rule that needed a category — "delivered work isn't Overdue" —
  // is a flag on the status itself. Converted here so tiles keep their numbers.
  ;(p.overallMetrics || []).forEach((m) => {
    if (m.source !== 'category') return
    m.source = 'statuses'
    m.statusKeys = (p.statusConfig || []).filter((s) => s.category === m.categoryId).map((s) => s.key)
    delete m.categoryId
  })
  ;(p.overallMetrics || []).forEach((m) => delete m.categoryId)
  ;(p.statusConfig || []).forEach((s) => {
    if (!('delivered' in s)) s.delivered = s.category === 'live'
    delete s.category
  })

  // The Overall Age unit used to be one app-wide setting shared by everyone; each
  // project now carries its own, seeded from whatever that setting last said.
  if (!p.overallAgeUnit) p.overallAgeUnit = legacyAgeUnit || 'weeks'

  if (!p.lastFetchedHeaders) p.lastFetchedHeaders = []

  // Projects created before the standard status list get it added once, after
  // their own statuses. Flagged so a status the BA later removes stays removed.
  if (!p.standardStatusesSeeded) {
    p.statusConfig = p.statusConfig || []
    STANDARD_STATUSES.forEach((def) => {
      if (p.statusConfig.some((s) => normalize(s.label) === normalize(def.label))) return
      const keyTaken = p.statusConfig.some((s) => s.key === def.key)
      p.statusConfig.push(makeStandardStatus(keyTaken ? { ...def, key: def.key + 'std' } : def))
    })
    p.standardStatusesSeeded = true
  }

  // Sheet spellings that duplicate a standard status are folded into it: the
  // sheet value is mapped to the standard status, tiles follow, and rows are
  // moved by applyStatusRedirects (rows are migrated separately from projects).
  if (!p.statusRedirects) p.statusRedirects = {}
  STATUS_VARIANTS.forEach(([variantLabel, standardLabel]) => {
    const variant = p.statusConfig.find((s) => normalize(s.label) === normalize(variantLabel))
    const standard = p.statusConfig.find((s) => normalize(s.label) === normalize(standardLabel))
    if (!variant || !standard) return
    p.statusRedirects[variant.key] = standard.key
    p.statusConfig = p.statusConfig.filter((s) => s !== variant)
    p.statusMapping = p.statusMapping.map((sm) => (sm.statusKey === variant.key ? { ...sm, statusKey: standard.key } : sm))
    if (!p.statusMapping.some((sm) => normalize(sm.sheetValue) === normalize(variant.label))) {
      p.statusMapping.push({ id: 'sm' + Math.random().toString(36).slice(2, 8), sheetValue: variant.label, statusKey: standard.key })
    }
    ;(p.overallMetrics || []).forEach((m) => {
      if (!(m.statusKeys || []).includes(variant.key)) return
      m.statusKeys = [...new Set(m.statusKeys.map((k) => (k === variant.key ? standard.key : k)))]
    })
  })

  // The standard statuses were first seeded in an arbitrary order. Put them in
  // lifecycle order once, in the slots they already occupy, so the project's
  // own statuses keep their places; later reordering by the BA sticks.
  if (!p.standardStatusesOrdered) {
    const rank = (s) => STANDARD_STATUSES.findIndex((d) => normalize(d.label) === normalize(s.label))
    const standard = p.statusConfig.filter((s) => rank(s) >= 0).sort((a, b) => rank(a) - rank(b))
    let i = 0
    p.statusConfig = p.statusConfig.map((s) => (rank(s) >= 0 ? standard[i++] : s))
    p.standardStatusesOrdered = true
  }
  return p
}

/** [sheet spelling, standard status it duplicates] */
const STATUS_VARIANTS = [
  ['Dependancy on Client', 'Dependency on Client'],
  ['HOLD', 'On Hold'],
]

/** Moves rows off statuses that migrateProject folded into a standard one. */
export function applyStatusRedirects(projects, crData) {
  const byId = new Map(projects.map((p) => [p.id, p.statusRedirects || {}]))
  crData.forEach((r) => {
    const to = (byId.get(r.projectId) || {})[r.section]
    if (to) r.section = to
    if (r.sourceSnapshot && (byId.get(r.projectId) || {})[r.sourceSnapshot.section]) {
      r.sourceSnapshot.section = byId.get(r.projectId)[r.sourceSnapshot.section]
    }
  })
  return crData
}

/** The 'salescode' action value predates the generic 'vendor' action value. */
export function migrateRow(r) {
  if (r.action === 'salescode') r.action = 'vendor'
  if (r.sourceSnapshot && r.sourceSnapshot.action === 'salescode') r.sourceSnapshot.action = 'vendor'
  return r
}

/** Persisted state if there is any, otherwise the seeded first-run project. */
export function loadInitialState() {
  const saved = Store.load()

  if (saved && Array.isArray(saved.projects) && saved.projects.length) {
    const projects = saved.projects.map((p) => migrateProject(p, saved.display?.overallAgeUnit))
    const crData = applyStatusRedirects(projects, (Array.isArray(saved.crData) ? saved.crData : []).map(migrateRow))
    return {
      projects,
      // 'ALL' was the old cross-project view; the app now always scopes to one project.
      currentProjectId: projects.some((p) => p.id === saved.currentProjectId)
        ? saved.currentProjectId
        : projects[0].id,
      crData,
    }
  }

  // First run starts with no rows; they come from whatever sheet gets connected.
  const proj = makeProject('New Project', 'New Project', [])

  return {
    projects: [proj],
    currentProjectId: proj.id,
    crData: [],
  }
}
