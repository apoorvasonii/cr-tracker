import { Store } from './storage'
import { defaultGlobalCategories, defaultMapping, makeMetric, makeProject } from '../lib/model'

/** Backfills fields added by later versions onto older persisted projects. */
function migrateProject(p) {
  if (!p.statusMapping) p.statusMapping = []
  if (!p.discoveredStatusValues) p.discoveredStatusValues = []
  if (!p.ignoredStatusValues) p.ignoredStatusValues = []
  if (!p.customColumns) p.customColumns = []
  if (!p.sheetTabConfig) p.sheetTabConfig = []
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

  // The delivery-side party used to be hardcoded; it's project config now.
  if (!p.vendorName) p.vendorName = 'Delivery Partner'

  // Numeric sheet dates used to be read day-first for everyone.
  if (!p.dateOrder) p.dateOrder = 'dmy'

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

  if (!p.lastFetchedHeaders) p.lastFetchedHeaders = []
  return p
}

/** The 'salescode' action value predates the configurable delivery-partner name. */
function migrateRow(r) {
  if (r.action === 'salescode') r.action = 'vendor'
  if (r.sourceSnapshot && r.sourceSnapshot.action === 'salescode') r.sourceSnapshot.action = 'vendor'
  return r
}

/** App-wide display preferences (not per project). */
function defaultDisplay() {
  return { overallAgeUnit: 'weeks' } // 'weeks' | 'days'
}

/** Persisted state if there is any, otherwise the seeded first-run project. */
export function loadInitialState() {
  const saved = Store.load()

  if (saved && Array.isArray(saved.projects) && saved.projects.length) {
    const projects = saved.projects.map(migrateProject)
    return {
      projects,
      currentProjectId: saved.currentProjectId || projects[0].id,
      globalCategories:
        Array.isArray(saved.globalCategories) && saved.globalCategories.length
          ? saved.globalCategories
          : defaultGlobalCategories(),
      crData: (Array.isArray(saved.crData) ? saved.crData : []).map(migrateRow),
      display: { ...defaultDisplay(), ...(saved.display || {}) },
    }
  }

  // First run starts empty: no invented rows, and no status vocabulary — both come
  // from whatever sheet gets connected.
  const proj = makeProject('New Project', 'New Project', [])

  return {
    projects: [proj],
    currentProjectId: proj.id,
    globalCategories: defaultGlobalCategories(),
    crData: [],
    display: defaultDisplay(),
  }
}
