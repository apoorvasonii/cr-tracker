import Papa from 'papaparse'
import { normalize } from './strings'

export function extractSheetId(url) {
  const m = (url || '').match(/\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : null
}

export function isAppsScriptUrl(url) {
  return /script\.google(usercontent)?\.com\/macros\//.test(url || '')
}

export function fetchAppsScriptSheets(url) {
  return fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error('Apps Script fetch failed: HTTP ' + res.status)
      return res.json()
    })
    .then((data) => {
      if (!data || !Array.isArray(data.sheets) || !data.sheets.length) throw new Error('Apps Script response had no sheets')
      return data.sheets
    })
}

/**
 * gviz answers with JSONP — a comment marker, then a call to
 * google.visualization.Query.setResponse wrapping the payload. Slicing the object
 * out by hand keeps us from having to eval anything.
 */
function parseGvizJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('gviz response was not JSON')
  const payload = JSON.parse(text.slice(start, end + 1))
  if (payload.status === 'error') {
    const reason = (payload.errors || []).map((e) => e.detailed_message || e.message).join('; ')
    throw new Error(reason || 'gviz query failed')
  }
  return payload.table
}

/**
 * One gviz cell -> the string the rest of the app works with.
 *
 * Date cells arrive typed — `Date(2026,7,26)` — which is the whole point of using
 * JSON: the year survives even when the sheet displays "25-Aug". Everything else
 * keeps its formatted text, so numbers and text read exactly as they do on screen.
 */
function gvizCellValue(cell, type) {
  if (!cell || cell.v === null || cell.v === undefined) return ''
  if ((type === 'date' || type === 'datetime') && typeof cell.v === 'string') {
    const m = cell.v.match(/^Date\((\d+),(\d+),(\d+)/)
    if (m) {
      const [y, mo, d] = [+m[1], +m[2] + 1, +m[3]]
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  if (cell.f !== undefined && cell.f !== null) return String(cell.f)
  return String(cell.v)
}

/** gviz table -> the same { headers, rows } shape the CSV path produces. */
function gvizTableToRows(table) {
  const cols = table.cols || []
  const headers = cols.map((c, i) => {
    const label = (c.label || '').trim()
    return label || String.fromCharCode(65 + i) // unlabelled columns keep a stable name
  })
  const rows = (table.rows || []).map((r) => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = gvizCellValue((r.c || [])[i], cols[i]?.type) })
    return obj
  })
  return { headers, rows }
}

function csvRowsToObjects(headers, rows) {
  return rows.map((r) => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = r[i] === null || r[i] === undefined ? '' : r[i] })
    return obj
  })
}

/**
 * Resolves to { headers: string[], rows: object[] } for a single tab, given any
 * { googleSheetUrl, sheetTabValue } pair. Both the Connect wizard and Sync go
 * through here, so there is exactly one place that knows how to talk to Google.
 */
export function fetchSheetForProject(proj) {
  const url = (proj.googleSheetUrl || '').trim()
  if (!url) return Promise.reject(new Error('No Google Sheet URL configured for this project.'))

  if (isAppsScriptUrl(url)) {
    return fetchAppsScriptSheets(url).then((sheets) => {
      const pickedTab = (proj.sheetTabValue || '').trim()
      let sheet = sheets[0]
      if (sheets.length > 1) {
        const match = sheets.find((s) => String(s.gid) === pickedTab || s.name === pickedTab)
        if (!match) {
          throw new Error(
            `This workbook has ${sheets.length} tabs — set "Sheet/Tab" to one of: ${sheets.map((s) => s.name).join(', ')}`
          )
        }
        sheet = match
      }
      const headers = (sheet.headers || []).map((h) => (h === null || h === undefined ? '' : String(h)))
      return { headers, rows: csvRowsToObjects(headers, sheet.rows || []) }
    })
  }

  const id = extractSheetId(url)
  if (!id) return Promise.reject(new Error('Could not find a sheet ID in that link.'))

  const pickedTab = (proj.sheetTabValue || '').trim()
  const gidMatch = url.match(/[?&#]gid=(\d+)/)
  let tabParam
  if (pickedTab) tabParam = /^\d+$/.test(pickedTab) ? `gid=${pickedTab}` : `sheet=${encodeURIComponent(pickedTab)}`
  else if (gidMatch) tabParam = `gid=${gidMatch[1]}`
  else tabParam = 'gid=0'

  const gvizJsonUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&headers=1&${tabParam}`
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&${tabParam}`
  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&${tabParam}`
  const tryFetch = (u) =>
    fetch(u).then((res) => {
      if (!res.ok) throw new Error('fetch failed: HTTP ' + res.status)
      return res.text()
    })

  // JSON first: it carries typed dates, so a cell displayed as "25-Aug" still
  // arrives with its year. CSV only ever carries what the sheet displays, so it
  // stays as the fallback rather than the default.
  return tryFetch(gvizJsonUrl)
    .then((text) => {
      if (text.trimStart().startsWith('<')) throw new Error('fetch failed: sign-in page')
      return gvizTableToRows(parseGvizJson(text))
    })
    .catch(() => tryFetch(gvizUrl).catch(() => tryFetch(exportUrl)).then(parseCsvResponse))
    .catch((err) => {
      // Only the network failures need the sharing/tab hint; parse-stage errors
      // already say exactly what went wrong, so don't bury them.
      if (err instanceof Error && !/^fetch failed/.test(err.message)) throw err
      throw new Error(
        'Could not fetch that sheet — check it’s shared as "Anyone with the link can view", or that the tab name/GID is correct. (' +
          (err.message || err) +
          ')'
      )
    })
}

/** The CSV fallback path: whatever the sheet displays, parsed by PapaParse. */
function parseCsvResponse(text) {
  if (!text || !text.trim()) throw new Error('Empty response from Google Sheets.')
  // A restricted sheet answers with a sign-in page rather than CSV.
  if (text.trimStart().startsWith('<')) {
    throw new Error(
      'That sheet returned a sign-in page instead of data — set its sharing to "Anyone with the link can view", or use an Apps Script Web App URL.'
    )
  }
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (!parsed.data.length) throw new Error('No rows parsed from that sheet/tab.')
  return { headers: parsed.meta.fields || [], rows: parsed.data }
}

/**
 * Headers worth offering in a mapping dropdown. Sheets routinely carry trailing
 * empty columns, which arrive unnamed or auto-named by PapaParse (`_1`, `_2`, …);
 * they stay in the parsed rows, they're just noise in a picker.
 */
export function usefulHeaders(headers = []) {
  return headers.filter((h) => {
    const t = (h || '').trim()
    return t !== '' && !/^_\d+$/.test(t)
  })
}

/** First header matching any candidate, exact-normalized first then substring. */
export function guessColumn(headers, ...candidates) {
  for (const c of candidates) {
    const hit = headers.find((h) => normalize(h) === normalize(c))
    if (hit) return hit
  }
  for (const c of candidates) {
    const hit = headers.find((h) => normalize(h).includes(normalize(c)))
    if (hit) return hit
  }
  return ''
}
