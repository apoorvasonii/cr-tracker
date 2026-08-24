import { normalize } from './strings'
import { formatPlanned, parseDateValue, toIsoDate } from './dates'
import {
  OVERRIDABLE_FIELDS,
  makeNewRecord,
  makeStatusFromSheetValue,
  mapSheetStatusToProjectStatus,
  stableFallbackId,
  VENDOR_NAME,
} from './model'

/**
 * Reads responsibility off the mapped column's own value: it belongs to the
 * delivery side when the cell names it, and to the client when it names the
 * project's LOB. Returns null when the value matches neither, so the caller can
 * warn about it instead of quietly picking a side.
 */
export function resolveAction(proj, rawValue) {
  const value = normalize(rawValue)
  if (!value) return null

  const names = (a, b) => a && b && (a.includes(b) || b.includes(a))
  const vendor = names(value, normalize(VENDOR_NAME))
  const client = names(value, normalize(proj.lobName))
  // A cell naming both parties — "Salescode & Acme", "both" — is a joint action,
  // not a coin toss between the two.
  if ((vendor && client) || value === 'both') return 'both'
  if (vendor) return 'vendor'
  if (client) return 'client'
  return null
}

/**
 * Resolves a raw sheet value to a status key, creating the status when it's new.
 * The sheet is the source of the vocabulary; nothing is invented or substituted.
 * Values the user dismissed stay unmapped ('') rather than becoming statuses.
 */
function resolveStatus(proj, rawValue, created) {
  const raw = (rawValue ?? '').toString().trim()
  if (!raw) return ''

  const existingKey = mapSheetStatusToProjectStatus(proj, raw)
  if (existingKey) return existingKey

  const ignored = (proj.ignoredStatusValues || []).some((v) => normalize(v) === normalize(raw))
  if (ignored) return ''

  const status = makeStatusFromSheetValue(raw, proj.statusConfig)
  proj.statusConfig.push(status)
  created.push(status.label)
  return status.key
}

/** Sheet values win, except on fields the user has manually overridden. */
function upsertRecord(existing, incoming) {
  // Source data, not user-editable, so it's refreshed unconditionally.
  if ('rawSection' in incoming) existing.rawSection = incoming.rawSection
  OVERRIDABLE_FIELDS.forEach((field) => {
    if (!(field in incoming)) return
    existing.sourceSnapshot = existing.sourceSnapshot || {}
    existing.sourceSnapshot[field] = incoming[field]
    if (existing.overrides && existing.overrides[field]) return // manual override wins
    existing[field] = incoming[field]
  })
  if (incoming.custom) {
    existing.custom = existing.custom || {}
    existing.customSourceSnapshot = existing.customSourceSnapshot || {}
    Object.keys(incoming.custom).forEach((colId) => {
      existing.customSourceSnapshot[colId] = incoming.custom[colId]
      if (existing.customOverrides && existing.customOverrides[colId]) return
      existing.custom[colId] = incoming.custom[colId]
    })
  }
}

/**
 * fetch -> apply mapping -> normalize -> upsert. Mutates `proj` and `crData`,
 * which are always draft copies owned by the caller's state update.
 *
 * Never appends duplicates: matching is by recordId (projectId + a stable
 * sourceRecordId), never by CR name.
 */
export function applySyncToProject(crData, proj, headers, rows) {
  const warnings = []
  const errors = []
  proj.lastFetchedHeaders = headers
  const m = proj.mapping

  const emptyResult = (extra) => ({
    success: false,
    projectId: proj.id,
    recordsFetched: rows.length,
    recordsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsRemoved: 0,
    warnings,
    errors,
    ...extra,
  })

  if (!m.name) {
    errors.push(
      'No "Feature" column mapped yet — open "Connect & Configure Mapping" and map at least the Feature (CR Name) column.'
    )
    return emptyResult()
  }

  // Without the Feature column every row parses as nameless, which would look
  // exactly like "the sheet was emptied" — and take every record with it. A
  // renamed or deleted Feature column is a mapping problem, not a data change.
  if (!headers.includes(m.name)) {
    errors.push(
      `The mapped Feature column "${m.name}" is not in the sheet any more — fix the mapping under "Connect & Configure Mapping". Nothing was changed or removed.`
    )
    return emptyResult()
  }

  ;[
    ['section', 'Status'],
    ['action', 'Next Action On'],
    ['planned', 'Planned End Date'],
    ['brdDateCol', 'BRD Date'],
    ['movedDateCol', 'Moved to Current Status'],
    ['idColumn', 'Unique ID'],
  ].forEach(([key, label]) => {
    const col = m[key]
    if (col && !headers.includes(col)) {
      warnings.push(
        `Mapped column "${col}" (for ${label}) was not found in the sheet — that field will be left blank until the mapping is fixed.`
      )
    }
  })
  ;(proj.customColumns || []).forEach((c) => {
    if (c.type === 'sheet' && c.mappedColumn && !headers.includes(c.mappedColumn)) {
      warnings.push(`Custom column "${c.label}"'s mapped sheet column "${c.mappedColumn}" was not found.`)
    }
  })

  const hasUniqueIdColumn = !!(m.idColumn && headers.includes(m.idColumn))
  const statusValuesSeen = new Set()
  const actionValuesSeen = new Set()
  const unrecognizedActions = new Set()
  let blankActions = 0
  const statusesCreated = []
  const fallbackIdCounts = {}
  let created = 0
  let updated = 0
  let processed = 0
  let removed = 0

  const computed = rows
    .map((row) => {
      const name = m.name ? (row[m.name] || '').toString().trim() : ''
      if (!name) return null

      if (m.action) {
        const seen = (row[m.action] ?? '').toString().trim()
        if (seen) actionValuesSeen.add(seen)
      }

      const statusRaw = m.section ? row[m.section] : ''
      const rawSection = (statusRaw ?? '').toString().trim()
      if (rawSection) statusValuesSeen.add(rawSection)
      const section = resolveStatus(proj, statusRaw, statusesCreated)

      // Whose court the CR is in, read off the mapped column itself.
      const actionCell = m.action ? (row[m.action] ?? '').toString().trim() : ''
      const action = resolveAction(proj, actionCell)
      if (m.action) {
        if (!actionCell) blankActions++
        else if (action === null) unrecognizedActions.add(actionCell)
      }

      // Stored in the app's dd/mm/yyyy form, however the sheet happened to write it.
      const planned = m.planned && row[m.planned] ? formatPlanned(row[m.planned], proj.dateOrder) : '-'

      const incoming = { name, section, action: action || '', planned, rawSection }

      if (m.brdDateCol && row[m.brdDateCol]) {
        const d = parseDateValue(row[m.brdDateCol], proj.dateOrder)
        if (d) incoming.brdDate = toIsoDate(d)
      }
      if (m.movedDateCol && row[m.movedDateCol]) {
        const d = parseDateValue(row[m.movedDateCol], proj.dateOrder)
        if (d) incoming.movedDate = toIsoDate(d)
      }

      incoming.custom = {}
      ;(proj.customColumns || []).forEach((c) => {
        if (c.type === 'sheet' && c.mappedColumn) incoming.custom[c.id] = (row[c.mappedColumn] || '').toString()
      })

      // A mapped ID column can still be blank on individual rows; falling back per
      // row keeps them distinct instead of collapsing them all onto one empty id.
      const mappedId = hasUniqueIdColumn ? (row[m.idColumn] ?? '').toString().trim() : ''
      const usedFallback = !mappedId
      const sourceRecordId = mappedId || stableFallbackId(m, row)
      if (usedFallback) fallbackIdCounts[sourceRecordId] = (fallbackIdCounts[sourceRecordId] || 0) + 1

      return { sourceRecordId, incoming, name, usedFallback }
    })
    .filter(Boolean)

  computed.forEach(({ sourceRecordId, incoming, name, usedFallback }) => {
    processed++
    if (usedFallback && fallbackIdCounts[sourceRecordId] > 1) {
      warnings.push(
        `"${name}" could not be reliably distinguished from another row with the same Feature/Status/Planned End Date — configure a Unique ID Column to fix this.`
      )
    }
    const recordId = proj.id + '::' + sourceRecordId
    const existing = crData.find((r) => r.recordId === recordId)
    if (existing) {
      upsertRecord(existing, incoming)
      updated++
    } else {
      crData.push(makeNewRecord(proj.id, sourceRecordId, recordId, incoming))
      created++
    }
  })

  // A feature deleted from the sheet should disappear from the tracker too. Rows
  // typed into the app by hand were never in the sheet, so they are never swept.
  // A fetch that yields no usable rows is treated as "nothing to compare
  // against" rather than "the sheet is empty", so a blank or malformed read
  // can't wipe a project.
  if (computed.length) {
    const seenIds = new Set(computed.map((c) => proj.id + '::' + c.sourceRecordId))
    for (let i = crData.length - 1; i >= 0; i--) {
      const r = crData[i]
      if (r.projectId !== proj.id) continue
      if ((r.sourceRecordId || '').startsWith('manual:')) continue
      if (seenIds.has(r.recordId)) continue
      crData.splice(i, 1)
      removed++
    }
    if (removed) {
      warnings.push(
        `Removed ${removed} row${removed === 1 ? '' : 's'} that ${removed === 1 ? 'is' : 'are'} no longer in the sheet.`
      )
    }
  } else if (crData.some((r) => r.projectId === proj.id)) {
    warnings.push(
      'The sheet returned no usable rows, so nothing was removed — existing tracker rows were left untouched.'
    )
  }

  proj.discoveredStatusValues = [...statusValuesSeen]
  proj.discoveredActionValues = [...actionValuesSeen]

  if (unrecognizedActions.size) {
    warnings.push(
      `${unrecognizedActions.size} value${unrecognizedActions.size === 1 ? '' : 's'} in "${m.action}" named neither side, so those rows were left unassigned — set them on the tracker: ${[...unrecognizedActions].join(', ')}.`
    )
  }
  if (blankActions) {
    warnings.push(
      `${blankActions} row${blankActions === 1 ? ' has' : 's have'} an empty "${m.action}" cell — those were left unassigned until someone picks a side.`
    )
  }

  if (statusesCreated.length) {
    warnings.push(
      `Added ${statusesCreated.length} status${statusesCreated.length === 1 ? '' : 'es'} found in the sheet: ${statusesCreated.join(', ')}. Set their colour, order and global category under Configure → Statuses.`
    )
  }

  const blankIds = hasUniqueIdColumn ? computed.filter((c) => c.usedFallback).length : 0
  if (blankIds) {
    warnings.push(
      `${blankIds} row${blankIds === 1 ? '' : 's'} had an empty "${m.idColumn}" cell — those were matched on Feature/Status/Planned End Date instead. Fill the ID column in the sheet to make them stable.`
    )
  }

  if (!hasUniqueIdColumn) {
    warnings.push(
      'This sheet has no configured Unique ID Column — records are matched using a stable combination of the Feature, Status, and Planned End Date columns instead. If a sheet can have two genuinely different rows with identical values in all three, they will not be told apart. Configure a Unique ID Column under Column Mapping if your sheet has one.'
    )
  }

  return {
    success: errors.length === 0,
    projectId: proj.id,
    recordsFetched: rows.length,
    recordsProcessed: processed,
    recordsCreated: created,
    recordsUpdated: updated,
    recordsRemoved: removed,
    warnings,
    errors,
  }
}

/** Records the outcome of a sync attempt onto the project. */
export function recordSyncOutcome(proj, result) {
  proj.syncStatus = result.errors.length ? 'failed' : 'success'
  proj.syncError = result.errors[0] || null
  proj.lastSyncedAt = Date.now()
  proj.lastSyncStats = result
}

/** " , N removed" — omitted entirely when a sync removed nothing. */
export const removedText = (result) =>
  result && result.recordsRemoved ? `, ${result.recordsRemoved} removed` : ''
