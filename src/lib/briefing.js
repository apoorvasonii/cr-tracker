/**
 * Briefing aggregation — reads normalized crData only, never Google Sheets.
 * Shared by the on-screen preview and the email HTML builder so the two
 * can't drift in what they count.
 */
import { getFlag, getProjectById, getStatus, VENDOR_NAME } from './model'

export function scopeRows(state) {
  return state.crData.filter((r) => r.projectId === state.currentProjectId)
}

/**
 * Rows the Briefing actually lists. Statuses with "List in Briefing" off (typically
 * Live/closed work) still count in the Overall Status tiles — they're just not
 * tabled as items needing attention.
 */
export function briefingRows(state) {
  return scopeRows(state).filter((r) => getStatus(state.projects, r.section, r.projectId).showInBriefing !== false)
}

/** Count of rows excluded from the listing by that setting, for an on-screen hint. */
export function excludedFromBriefing(state) {
  const all = scopeRows(state)
  const counts = new Map()
  all.forEach((r) => {
    const s = getStatus(state.projects, r.section, r.projectId)
    if (s.showInBriefing === false) counts.set(s.label, (counts.get(s.label) || 0) + 1)
  })
  return [...counts.entries()].map(([label, count]) => ({ label, count }))
}

export function pctOf(n, total) {
  if (!total) return '0.0'
  return ((n / total) * 100).toFixed(1)
}

/**
 * Groups by (projectId, statusKey) so mixed-project labels and colors are
 * always resolved against the CR's own project, never another's vocabulary.
 */
export function actionableLines(state, rows) {
  const seen = new Map()
  rows.forEach((r) => {
    const proj = getProjectById(state.projects, r.projectId)
    if (!proj) return
    const s = getStatus(state.projects, r.section, r.projectId)
    if (!s.showInActionable) return
    const key = r.projectId + '::' + s.key
    if (!seen.has(key)) {
      seen.set(key, {
        label: s.label,
        color: s.color,
        count: 0,
        projectRank: state.projects.findIndex((p) => p.id === r.projectId),
        statusRank: proj.statusConfig.findIndex((x) => x.key === s.key),
      })
    }
    seen.get(key).count++
  })
  // Same sequence as the sections below it, so the two panels read together.
  return [...seen.values()].sort((a, b) => a.projectRank - b.projectRank || a.statusRank - b.statusRank)
}

/**
 * One section per status, sequenced by the order statuses are listed in
 * Configure → Statuses — not by which CR happened to appear first.
 */
export function statusGroups(state, rows) {
  const groups = new Map()
  rows.forEach((r) => {
    const proj = getProjectById(state.projects, r.projectId)
    if (!proj) return
    const key = r.projectId + '::' + r.section
    if (!groups.has(key)) {
      groups.set(key, { key, project: proj, status: getStatus(state.projects, r.section, r.projectId), rows: [] })
    }
    groups.get(key).rows.push(r)
  })

  const projectRank = (id) => state.projects.findIndex((p) => p.id === id)
  const statusRank = (group) => {
    const i = group.project.statusConfig.findIndex((s) => s.key === group.status.key)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i // unknown statuses sink to the end
  }

  return [...groups.values()].sort(
    (a, b) => projectRank(a.project.id) - projectRank(b.project.id) || statusRank(a) - statusRank(b)
  )
}

/** Flags actually used by the rows in scope, deduped per project. */
export function usedFlags(state, rows) {
  const seen = new Map()
  rows.forEach((r) =>
    (r.flags || []).forEach((fid) => {
      const flag = getFlag(state.projects, fid, r.projectId)
      if (flag) seen.set(r.projectId + '::' + fid, flag)
    })
  )
  return [...seen.values()]
}

export const rowFlags = (state, row) =>
  (row.flags || []).map((fid) => getFlag(state.projects, fid, row.projectId)).filter(Boolean)

export function briefingTitles(state) {
  const proj = getProjectById(state.projects, state.currentProjectId)
  return {
    displayTitle: proj ? proj.displayName : '',
    headerLabel: (proj && proj.briefingHeader) || 'CR Tracker',
    subheaderLabel: (proj && proj.briefingSubheader) || '',
    lobLabel: proj ? proj.lobName : 'Client',
    vendorLabel: VENDOR_NAME,
  }
}
