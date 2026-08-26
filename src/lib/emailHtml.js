/**
 * Table-based email HTML for "Copy for Email". Deliberately separate from the
 * React preview: mail clients need inline styles and <table> layout, so this
 * stays a string builder. Both read the same aggregation helpers.
 */
import { INK, LINE, MUTED, tintOf, titleOf } from './colors'
import { computeAgeInState, computeOverallAge, formatPlannedShort } from './dates'
import { actionColorOf, actionLabelOf, percentBase, scopedTiles } from './model'
import {
  actionableLines,
  briefingRows,
  briefingTitles,
  pctOf,
  rowFlags,
  statusGroups,
} from './briefing'

function escapeHtml(s) {
  return (s || '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statCell(n, pct, rawLabel, color, isLast) {
  // Labels can originate in sheet text (status names), so escape here rather than
  // trusting every call site.
  const label = escapeHtml(rawLabel)
  const border = isLast ? '' : `border-right:1px solid ${LINE};`
  const pctHtml =
    pct !== null ? `<span style="font-size:12px; font-weight:600; color:${MUTED}; margin-left:4px;">(${pct}%)</span>` : ''
  return `<td align="center" style="padding:18px 6px; ${border}">
    <div style="font-size:24px; font-weight:800; color:${color};">${n}${pctHtml}</div>
    <div style="font-size:10px; font-weight:700; letter-spacing:0.6px; color:${MUTED}; margin-top:5px;">${label}</div>
  </td>`
}

function breakdownLines(lines) {
  if (!lines.length) return ''
  return lines
    .map(
      ([label, val]) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:230px; margin:0 auto;"><tr>
      <td style="font-size:12px; color:#4a4a4a; padding:3px 0;">${escapeHtml(label)}</td>
      <td align="right" style="font-size:12px; font-weight:800; color:${INK}; padding:3px 0;">${val}</td>
    </tr></table>`
    )
    .join('')
}

export function buildEmailHtml(state) {
  // Tiles count every CR in scope (that's what scopedTiles does); everything below
  // them lists only the rows whose status is set to appear in the Briefing.
  const rows = briefingRows(state)
  const { displayTitle, headerLabel, subheaderLabel, lobLabel, vendorLabel } = briefingTitles(state)
  const F = 'font-family:Arial,Helvetica,sans-serif;'
  const ageUnit = state.display?.overallAgeUnit

  const tiles = scopedTiles(state)
  const base = percentBase(tiles)
  const tileCells = tiles
    .map((t, idx) =>
      statCell(t.value, t.showPercent ? pctOf(t.value, base) : null, t.label.toUpperCase(), t.color, idx === tiles.length - 1)
    )
    .join('')

  // Joint rows get their own block rather than being counted twice or split.
  const clientRows = rows.filter((r) => r.action === 'client')
  const vendorRows = rows.filter((r) => r.action === 'vendor')
  const bothRows = rows.filter((r) => r.action === 'both')

  let html = `<div style="${F} max-width:1100px;">`
  html += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#2f7d8c; border-radius:10px; margin-bottom:14px;">
    <tr><td style="padding:26px 34px; color:#ffffff; ${F}">
      <div style="font-size:26px; font-weight:800;">${escapeHtml(displayTitle)} &mdash; ${escapeHtml(headerLabel)}</div>
      ${subheaderLabel ? `<div style="font-size:14px; font-weight:600; margin-top:7px; opacity:0.9;">${escapeHtml(subheaderLabel)}</div>` : ''}
    </td></tr>
  </table>`

  html += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE}; border-radius:10px; margin-bottom:14px; ${F}">
    <tr><td style="background-color:#2f7d8c; color:#fff; text-align:center; padding:12px; font-size:13px; font-weight:800; letter-spacing:1.5px;">OVERALL STATUS</td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        ${tileCells || statCell('—', null, 'NO TILES CONFIGURED', INK, true)}
      </tr></table>
    </td></tr>
  </table>`

  const clientLines = actionableLines(state, clientRows)
  const vendorLines = actionableLines(state, vendorRows)
  const bothLines = actionableLines(state, bothRows)
  // Nothing pending on both sides means there's no such category to report.
  const hasBoth = bothRows.length > 0
  const nameW = hasBoth ? '13%' : '20%'
  const listW = hasBoth ? '20%' : '30%'
  html += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE}; border-radius:10px; margin-bottom:20px; ${F}">
    <tr><td style="background-color:#2f7d8c; color:#fff; text-align:center; padding:12px; font-size:13px; font-weight:800; letter-spacing:1.5px;">ACTIONABLE POINTS</td></tr>
    <tr><td style="padding:10px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="width:${nameW}; text-align:center; vertical-align:top; padding:16px 8px;">
          <div style="font-size:12.5px; font-weight:800; color:#b3372c;">${escapeHtml(lobLabel.toUpperCase())}</div>
          <div style="font-size:24px; font-weight:800; color:#b3372c; margin-top:6px;">${clientRows.length}</div>
        </td>
        <td style="width:${listW}; vertical-align:middle; padding:14px 14px; border-left:1px solid ${LINE}; border-right:1px solid ${LINE};">
          ${breakdownLines(clientLines.map((l) => [l.label, l.count]))}
        </td>
        <td style="width:${nameW}; text-align:center; vertical-align:top; padding:16px 8px;">
          <div style="font-size:12.5px; font-weight:800; color:#2f5fa8;">${escapeHtml(vendorLabel.toUpperCase())}</div>
          <div style="font-size:24px; font-weight:800; color:#2f5fa8; margin-top:6px;">${vendorRows.length}</div>
        </td>
        <td style="width:${listW}; vertical-align:middle; padding:14px 14px;${hasBoth ? ` border-left:1px solid ${LINE}; border-right:1px solid ${LINE};` : ''}">
          ${breakdownLines(vendorLines.map((l) => [l.label, l.count]))}
        </td>
        ${
          hasBoth
            ? `<td style="width:14%; text-align:center; vertical-align:top; padding:16px 8px;">
          <div style="font-size:12.5px; font-weight:800; color:#6a5a9a;">${escapeHtml(`${lobLabel} + ${vendorLabel}`.toUpperCase())}</div>
          <div style="font-size:24px; font-weight:800; color:#6a5a9a; margin-top:6px;">${bothRows.length}</div>
        </td>
        <td style="width:20%; vertical-align:middle; padding:14px 14px;">
          ${breakdownLines(bothLines.map((l) => [l.label, l.count]))}
        </td>`
            : ''
        }
      </tr></table>
    </td></tr>
  </table>`

  const flagsSeen = new Map()

  statusGroups(state, rows).forEach(({ project: p, status: s, rows: groupRows }) => {
    const tint = tintOf(s.color)
    const title = titleOf(s.color)
    const heading = escapeHtml(s.label.toUpperCase())
    const th = `padding:10px 14px; font-size:10.5px; font-weight:800; letter-spacing:0.6px; color:${title}; text-transform:uppercase;`

    html += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE}; border-radius:10px; margin-bottom:18px; ${F}">
      <tr><td style="background-color:#ffffff; text-align:center; padding:14px; font-size:14px; font-weight:800; letter-spacing:1.2px; color:${title}; border-bottom:1px solid ${LINE};">${heading} &mdash; ${groupRows.length} ITEM${groupRows.length > 1 ? 'S' : ''}</td></tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr style="background-color:${tint};">
            <th align="left" style="${th}">CR</th>
            <th align="center" style="${th}">Status</th>
            <th align="center" style="${th}">Next Action On</th>
            <th align="center" style="${th}">Planned End Date</th>
            <th align="center" style="${th}">Overall Age</th>
            <th align="center" style="${th}">Age in Current State</th>
          </tr>`

    groupRows.forEach((r, idx) => {
      const flags = rowFlags(state, r)
      flags.forEach((f) => flagsSeen.set(r.projectId + '::' + f.id, f))
      const flagPrefix = flags
        .map((f) => `<span style="color:${escapeHtml(f.color)};font-weight:800;">${escapeHtml(f.symbol)}</span>`)
        .join(' ')
      const border = idx < groupRows.length - 1 ? `border-bottom:1px solid ${LINE};` : ''
      const overallDisplay = computeOverallAge(r, ageUnit)
      const ageDisplay = computeAgeInState(r)
      const plannedDisplay = formatPlannedShort(r.planned, p.dateOrder)
      const isDashPlanned = plannedDisplay === '-'
      const actionColor = actionColorOf(p, r.action)
      const actionLabel = actionLabelOf(p, r.action)

      html += `<tr>
        <td style="padding:12px 14px; font-size:12.5px; font-weight:700; color:#3a3a3a; ${border}">${flagPrefix ? flagPrefix + ' ' : ''}${escapeHtml(r.name)}</td>
        <td align="center" style="padding:12px 14px; ${border}"><span style="display:inline-block; padding:4px 11px; border-radius:16px; font-size:10.5px; font-weight:800; color:#fff; background-color:${s.color};">${escapeHtml(s.label)}</span></td>
        <td align="center" style="padding:12px 14px; ${border}"><span style="display:inline-block; padding:4px 11px; border-radius:16px; font-size:10.5px; font-weight:800; color:#fff; background-color:${actionColor};">${escapeHtml(actionLabel)}</span></td>
        <td align="center" style="padding:12px 14px; font-size:12.5px; font-weight:600; color:${isDashPlanned ? MUTED : '#5c5c5c'}; font-style:${isDashPlanned ? 'italic' : 'normal'}; ${border}">${escapeHtml(plannedDisplay)}</td>
        <td align="center" style="padding:12px 14px; font-size:12.5px; font-weight:500; color:${MUTED}; font-style:${overallDisplay === '-' ? 'italic' : 'normal'}; ${border}">${escapeHtml(overallDisplay)}</td>
        <td align="center" style="padding:12px 14px; font-size:14px; font-weight:800; color:${ageDisplay === '-' ? MUTED : INK}; font-style:${ageDisplay === '-' ? 'italic' : 'normal'}; ${border}">${escapeHtml(ageDisplay)}</td>
      </tr>`
    })

    html += `</table></td></tr></table>`
  })

  ;[...flagsSeen.values()].forEach((f) => {
    html += `<div style="padding:6px 4px 14px; font-size:11.5px; font-style:italic; color:#7a7568; ${F}"><span style="color:${escapeHtml(f.color)};font-weight:800;">${escapeHtml(f.symbol)}</span> ${escapeHtml(f.note)}</div>`
  })

  html += `<div style="text-align:center; padding:14px; color:${MUTED}; font-size:11.5px; ${F}">${escapeHtml(lobLabel)} &middot; ${escapeHtml(vendorLabel)} &middot; Project Delivery Tracker &middot; ${rows.length} Actionable CRs</div>`
  html += `</div>`
  return html
}
