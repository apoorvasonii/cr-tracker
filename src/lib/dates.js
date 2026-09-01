import { isNonWorkingDay } from './holidays'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const monthIndex = (name) => MONTHS.indexOf(name.slice(0, 3).toLowerCase())

const atMidnight = (y, m, d) => {
  const date = new Date(y, m, d)
  date.setHours(0, 0, 0, 0)
  // Rejects overflow like 31 Feb, which JS would silently roll into March.
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d ? date : null
}

/**
 * A date with no year written down is a past date in this app (BRD sign-offs, last
 * actions), so default to this year and step back a year if that lands in the future.
 */
function resolveMissingYear(month, day) {
  const now = new Date()
  const candidate = atMidnight(now.getFullYear(), month, day)
  if (!candidate) return null
  const tomorrow = new Date()
  tomorrow.setHours(0, 0, 0, 0)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (candidate <= tomorrow) return candidate
  return atMidnight(now.getFullYear() - 1, month, day)
}

/**
 * Parses the date formats real sheets contain, deliberately NOT delegating to
 * `new Date(string)`: that reads "2 July" as the year 2001 and refuses day-first
 * numeric dates like 31/07/2026 outright.
 *
 * Numeric dates are read DAY-FIRST (31/07 = 31 July), matching the sheets this
 * tracker is pointed at, except when the first number can only be a month.
 * Unrecognized text ("To be Planned", "-") returns null and is displayed as-is.
 */
export function parseDateValue(v, order = 'dmy') {
  if (!v) return null
  if (v instanceof Date) return isNaN(v) ? null : v

  const s = v.toString().trim()
  if (!s || s === '-') return null

  // ISO: 2026-07-31 (also the value of every <input type="date">)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return atMidnight(+m[1], +m[2] - 1, +m[3])

  // Numeric: 31/07/2026, 31-7-26, 31.07.2026
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) {
    let [a, b, y] = [+m[1], +m[2], +m[3]]
    if (y < 100) y += 2000
    // Whichever number can't be a month settles it; otherwise the project's
    // configured order decides (31/07 is unambiguous, 1/2 is not).
    let day, month
    if (a > 12 && b <= 12) [day, month] = [a, b]
    else if (b > 12 && a <= 12) [day, month] = [b, a]
    else [day, month] = order === 'mdy' ? [b, a] : [a, b]
    return atMidnight(y, month - 1, day)
  }

  // Day and month with no year: "2 July", "2nd Jul"
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,})\.?$/i)
  if (m) {
    const month = monthIndex(m[2])
    return month < 0 ? null : resolveMissingYear(month, +m[1])
  }

  // Month and day with no year: "July 2", "Jul 2nd"
  m = s.match(/^([a-z]{3,})\.?[\s-]+(\d{1,2})(?:st|nd|rd|th)?$/i)
  if (m) {
    const month = monthIndex(m[1])
    return month < 0 ? null : resolveMissingYear(month, +m[2])
  }

  // Spelled-out month with a year: "2 July 2026", "Jul 2, 2026"
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,})\.?[\s,]+(\d{4})$/i)
  if (m) {
    const month = monthIndex(m[2])
    return month < 0 ? null : atMidnight(+m[3], month, +m[1])
  }
  m = s.match(/^([a-z]{3,})\.?[\s-]+(\d{1,2})(?:st|nd|rd|th)?[\s,]+(\d{4})$/i)
  if (m) {
    const month = monthIndex(m[1])
    return month < 0 ? null : atMidnight(+m[3], month, +m[2])
  }

  // Spreadsheet serial number (days since 1899-12-30), in case a cell arrives raw.
  if (/^\d{5}$/.test(s)) {
    const serial = +s
    const date = new Date(Date.UTC(1899, 11, 30 + serial))
    return atMidnight(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  }

  return null
}

/** Business days between `date` and today, weekends and holidays excluded, end-exclusive. */
export function businessDaysFromDate(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  if (start >= today) return 0

  let days = 0
  const cur = new Date(start)
  cur.setDate(cur.getDate() + 1)
  while (cur < today) {
    if (!isNonWorkingDay(cur)) days++
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

/** Calendar days between `date` and today — every day counts, weekend or holiday. */
export function calendarDaysFromDate(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  if (start >= today) return 0
  return Math.round((today - start) / 86400000)
}

export function toIsoDate(date) {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

export const todayIso = () => toIsoDate(new Date())

/** The app's one written date format: 31/07/2026. */
export function formatDmy(date) {
  const d = String(date.getDate()).padStart(2, '0')
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}/${mo}/${date.getFullYear()}`
}

/**
 * Planned End Date is always shown as dd/mm/yyyy, whatever the sheet wrote or the
 * user typed. Anything that isn't a date — "To be Planned", "TBD", a blank cell —
 * reads as "-", so the column only ever holds a date or a dash.
 */
export function formatPlanned(value, order = 'dmy') {
  const raw = (value ?? '').toString().trim()
  if (!raw || raw === '-') return '-'
  const d = parseDateValue(raw, order)
  return d ? formatDmy(d) : '-'
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * The Briefing reads dates the way people say them — "21 Aug" — and only spells the
 * year out when it isn't the current one, where leaving it off would mislead.
 */
export function formatPlannedShort(value, order = 'dmy') {
  const raw = (value ?? '').toString().trim()
  if (!raw || raw === '-') return '-'
  const d = parseDateValue(raw, order)
  if (!d) return '-'
  const short = `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`
  return d.getFullYear() === new Date().getFullYear() ? short : `${short} ${d.getFullYear()}`
}

/** A week is seven calendar days — the ordinary sense of "a week has passed". */
export const DAYS_PER_WEEK = 7

export const formatAgeDays = (days) => days + 'd'

/** Whole weeks only: six days is still 0w, thirteen is 1w. */
export const formatAgeWeeks = (calendarDays) => Math.floor(calendarDays / DAYS_PER_WEEK) + 'w'

export function relativeSyncTime(ts) {
  if (!ts) return 'Never synced'
  const diffMin = Math.round((Date.now() - ts) / 60000)
  if (diffMin < 1) return 'Synced just now'
  if (diffMin < 60) return `Synced ${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `Synced ${diffHr}h ago`
  return 'Synced ' + new Date(ts).toLocaleString()
}

/* Age columns are derived, never stored: a date column wins when mapped,
   otherwise whatever text came from the sheet / was typed in. */
export function computeOverallAge(row, unit = 'weeks') {
  // brdDate/movedDate are always stored ISO, so no order is needed here.
  const d = parseDateValue(row.brdDate)
  if (!d) return row.overall || '-'
  // Weeks are counted the way people say them — seven days since the BRD date is
  // one week — while days report working time, with weekends and holidays out.
  return unit === 'days' ? formatAgeDays(businessDaysFromDate(d)) : formatAgeWeeks(calendarDaysFromDate(d))
}

export function computeAgeInState(row) {
  const d = parseDateValue(row.movedDate)
  if (d) return formatAgeDays(businessDaysFromDate(d))
  return row.age || '-'
}
