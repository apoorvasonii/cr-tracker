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

  const gvizUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&${tabParam}`
  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&${tabParam}`
  const tryFetch = (u) =>
    fetch(u).then((res) => {
      if (!res.ok) throw new Error('fetch failed: HTTP ' + res.status)
      return res.text()
    })

  return tryFetch(gvizUrl)
    .catch(() => tryFetch(exportUrl))
    .then((text) => {
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
    })
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
