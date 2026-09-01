/**
 * Non-working days, on top of weekends, used by every business-day calculation.
 *
 * Transcribed from the company holiday calendar, one entry per observed day
 * (Diwali spans two). Years the list doesn't cover fall back to weekends only,
 * so ages stay sane rather than silently wrong — add the next year here when
 * the calendar is published.
 */
export const HOLIDAYS = {
  2025: [
    ['01-01', 'New Year'],
    ['02-26', 'Maha Shivaratri'],
    ['03-14', 'Holi'],
    ['03-31', 'Eid al-Fitr'],
    ['04-18', 'Good Friday'],
    ['08-15', 'Independence Day'],
    ['08-27', 'Ganesh Chaturthi'],
    ['10-02', 'Gandhi Jayanti'],
    ['10-20', 'Diwali'],
    ['10-21', 'Diwali'],
    ['11-05', 'Gurpurab'],
    ['12-25', 'Christmas'],
  ],
  2026: [
    ['01-01', 'New Year'],
    ['01-26', 'Republic Day'],
    ['03-04', 'Holi'],
    ['04-03', 'Good Friday'],
    ['05-01', 'Labour Day'],
    ['08-28', 'Rakshabandhan'],
    ['09-04', 'Janmashtami'],
    ['10-02', 'Gandhi Jayanti'],
    ['10-20', 'Dussehra'],
    ['11-09', 'Diwali'],
    ['11-10', 'Diwali (Bhaidooj)'],
    ['12-25', 'Christmas'],
  ],
}

/** ISO dates ('2026-01-26') -> holiday name, flattened once at module load. */
const BY_ISO = new Map(
  Object.entries(HOLIDAYS).flatMap(([year, days]) => days.map(([md, name]) => [`${year}-${md}`, name]))
)

/** The years the calendar actually covers — outside these, only weekends are excluded. */
export const COVERED_YEARS = Object.keys(HOLIDAYS).map(Number)

/** Local-date components, deliberately not toISOString(): that shifts by timezone. */
function isoOf(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const holidayName = (date) => BY_ISO.get(isoOf(date)) || null

/** A weekend or a listed holiday — either way, not working time. */
export function isNonWorkingDay(date) {
  const dow = date.getDay()
  return dow === 0 || dow === 6 || BY_ISO.has(isoOf(date))
}
