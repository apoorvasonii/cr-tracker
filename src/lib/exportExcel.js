import { actionLabelOf, deliveryHistory, getStatus } from './model'
import { computeAgeInState, computeOverallAge, parseDateValue, todayIso } from './dates'

/**
 * A real Excel date where the value parses as one, so the sheet sorts and
 * filters by date. Built at UTC midnight: ExcelJS writes dates in UTC, and a
 * local (IST) midnight would land on the previous day.
 */
const asDate = (value, order) => {
  if (!value || value === '-') return ''
  const d = parseDateValue(value, order)
  return d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : value
}

function styleSheet(ws, widths) {
  ws.columns.forEach((c, i) => {
    c.width = widths[i] || 16
  })
  const header = ws.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5FA8' } }
  header.alignment = { vertical: 'middle' }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } }
}

/**
 * One workbook for a project: the tracker's CR rows on one sheet and the
 * delivered history on another. ExcelJS is loaded only when someone exports.
 */
export async function exportProjectWorkbook(state, proj) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const dateFmt = 'dd mmm yyyy'

  // ---- Tracker ----
  const custom = proj.customColumns || []
  const ws = wb.addWorksheet('Tracker')
  ws.addRow([
    '#', 'Feature', 'Status', 'Next Action On', 'Planned End Date', 'UAT Date', 'BRD Date',
    'Last Action Date', 'Overall Age', 'Age in Current State', ...custom.map((c) => c.label), 'Flags',
  ])
  const rows = state.crData.filter((r) => r.projectId === proj.id)
  rows.forEach((r, i) => {
    ws.addRow([
      i + 1,
      r.name,
      getStatus(state.projects, r.section, r.projectId).label,
      actionLabelOf(proj, r.action) || '',
      asDate(r.planned, proj.dateOrder),
      asDate(r.uatDate),
      asDate(r.brdDate),
      asDate(r.movedDate),
      computeOverallAge(r, proj.overallAgeUnit),
      computeAgeInState(r),
      ...custom.map((c) => (r.custom && r.custom[c.id]) || ''),
      (r.flags || [])
        .map((id) => (proj.flagConfig.find((f) => f.id === id) || {}).label)
        .filter(Boolean)
        .join(', '),
    ])
  })
  ;[5, 6, 7, 8].forEach((col) => (ws.getColumn(col).numFmt = dateFmt))
  styleSheet(ws, [5, 48, 24, 18, 16, 14, 14, 16, 12, 18, ...custom.map(() => 18), 16])

  // ---- Live CRs ----
  const wd = wb.addWorksheet('Live CRs')
  wd.addRow(['Went Live On', 'Item', 'Status', 'Source', 'Note'])
  deliveryHistory(proj, state.crData)
    .filter((e) => !e.revertedAt)
    .forEach((e) => {
      wd.addRow([
        asDate(e.at),
        e.name,
        e.statusLabel || '',
        e.source === 'manual' ? 'Added by hand' : e.estimated ? 'Tracker (date from Last Action Date)' : e.source === 'sheet' ? 'Sheet sync' : 'Tracker',
        [e.note, e.deleted && 'row since deleted'].filter(Boolean).join(' · '),
      ])
    })
  wd.getColumn(1).numFmt = dateFmt
  styleSheet(wd, [16, 50, 20, 34, 40])

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(proj.lobName || 'project').replace(/[^\w -]+/g, '')} CR Tracker ${todayIso()}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { crs: rows.length }
}
