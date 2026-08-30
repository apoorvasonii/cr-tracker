import { useApp } from '../../state/AppContext'
import { actionColorOf, actionLabelOf, percentBase, scopedTiles, VENDOR_NAME } from '../../lib/model'
import { computeAgeInState, computeOverallAge, formatPlannedShort } from '../../lib/dates'
import { tintOf, titleOf } from '../../lib/colors'
import {
  actionableLines,
  briefingRows,
  briefingTitles,
  excludedFromBriefing,
  pctOf,
  rowFlags,
  statusGroups,
  usedFlags,
} from '../../lib/briefing'

function Breakdown({ lines }) {
  return (
    <>
      {lines.map((l) => (
        <div key={l.label}>
          <span className="lbl">
            <span className="dot" style={{ backgroundColor: l.color }} />
            {l.label}
          </span>
          <span className="val">{l.count}</span>
        </div>
      ))}
    </>
  )
}

function StatusSection({ state, group }) {
  const vendorLabel = VENDOR_NAME
  const { project, status: s, rows } = group
  const ageUnit = project.overallAgeUnit
  const tint = tintOf(s.color)
  const title = titleOf(s.color)

  return (
    <div className="status-section">
      <div className="status-heading">
        <span className="title" style={{ color: title }}>
          {s.label} — {rows.length} Item
          {rows.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="table-card">
        <table>
          <thead style={{ backgroundColor: tint }}>
            <tr>
              <th style={{ width: '30%', color: title }}>CR</th>
              <th style={{ width: '14%', color: title }}>Status</th>
              <th style={{ width: '12%', color: title }}>Next Action On</th>
              <th style={{ width: '14%', color: title }}>Planned End Date</th>
              <th style={{ width: '15%', color: title }} className="center">
                Overall Age
              </th>
              <th style={{ width: '15%', color: title }} className="center">
                Age in Current State
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const flags = rowFlags(state, r)
              const overallDisplay = computeOverallAge(r, ageUnit)
              const ageDisplay = computeAgeInState(r)
              const actionColor = actionColorOf(project, r.action)
              const actionLabel = actionLabelOf(project, r.action)

              return (
                <tr key={r.recordId}>
                  <td className="cr-name">
                    {flags.map((f) => (
                      <span key={f.id} style={{ color: f.color, fontWeight: 800 }}>
                        {f.symbol}{' '}
                      </span>
                    ))}
                    {r.name}
                  </td>
                  <td>
                    <span className="pill" style={{ backgroundColor: s.color }}>
                      {s.label}
                    </span>
                  </td>
                  <td className="center">
                    <span className="pill" style={{ backgroundColor: actionColor }}>
                      {actionLabel}
                    </span>
                  </td>
                  <td className={r.planned === '-' ? 'planned tbd' : 'planned'}>{formatPlannedShort(r.planned, project.dateOrder)}</td>
                  <td className={`center overall-age${overallDisplay === '-' ? ' dash' : ''}`}>{overallDisplay}</td>
                  <td className={`center age${ageDisplay === '-' ? ' dash' : ''}`}>{ageDisplay}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function BriefingPreview() {
  const { state } = useApp()
  // Tiles count everything in scope; the listing below shows only rows whose status
  // is set to appear in the Briefing.
  const rows = briefingRows(state)
  const excluded = excludedFromBriefing(state)
  const { displayTitle, headerLabel, subheaderLabel, lobLabel, vendorLabel } = briefingTitles(state)
  const tiles = scopedTiles(state)
  const base = percentBase(tiles)

  // Joint rows get their own block rather than being counted twice or split.
  const clientRows = rows.filter((r) => r.action === 'client')
  const vendorRows = rows.filter((r) => r.action === 'vendor')
  const bothRows = rows.filter((r) => r.action === 'both')
  // Nothing pending on both sides means there's no such category to report.
  const hasBoth = bothRows.length > 0

  return (
    // `briefing` scopes the email-mirroring stylesheet in styles/app.css.
    <div className="briefing">
      <div className="masthead">
        <h1>
          {displayTitle} — {headerLabel}
        </h1>
        {subheaderLabel && <div className="sub">{subheaderLabel}</div>}
      </div>

      <div className="panel">
        <div className="panel-head">Overall Status</div>
        <div className="overall-grid" style={{ gridTemplateColumns: `repeat(${Math.max(tiles.length, 1)},1fr)` }}>
          {tiles.length === 0 && (
            <div className="cell">
              <div className="n">—</div>
              <div className="l">NO TILES CONFIGURED</div>
            </div>
          )}
          {tiles.map((t) => (
            <div className="cell" key={t.key}>
              <div className="n" style={{ color: t.color }}>
                {t.value}
                {t.showPercent && <span className="pct">({pctOf(t.value, base)}%)</span>}
              </div>
              <div className="l">{t.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {excluded.length > 0 && (
        <p className="mb-3.5 text-[11.5px] italic text-[#9a958a]">
          Counted above but not listed below:{' '}
          {excluded.map((e) => `${e.count} ${e.label}`).join(', ')} — change this per status under Configure → Statuses
          (“List in Briefing”).
        </p>
      )}

      <div className="panel">
        <div className="panel-head">Actionable Points</div>
        <div
          className="team-grid"
          style={{ gridTemplateColumns: hasBoth ? 'auto 1fr auto 1fr auto 1fr' : 'auto 1fr auto 1fr' }}
        >
          <div className="team-block">
            <div className="team-name red">{lobLabel.toUpperCase()}</div>
            <div className="team-n red">{clientRows.length}</div>
          </div>
          <div className="breakdown">
            <Breakdown lines={actionableLines(state, clientRows)} />
          </div>
          <div className="team-block">
            <div className="team-name blue">{vendorLabel.toUpperCase()}</div>
            <div className="team-n blue">{vendorRows.length}</div>
          </div>
          <div className="breakdown" style={hasBoth ? undefined : { borderRight: 'none' }}>
            <Breakdown lines={actionableLines(state, vendorRows)} />
          </div>
          {hasBoth && (
            <>
              <div className="team-block">
                <div className="team-name violet">{`${lobLabel} + ${vendorLabel}`.toUpperCase()}</div>
                <div className="team-n violet">{bothRows.length}</div>
              </div>
              <div className="breakdown" style={{ borderRight: 'none' }}>
                <Breakdown lines={actionableLines(state, bothRows)} />
              </div>
            </>
          )}
        </div>
      </div>

      {statusGroups(state, rows).map((group) => (
        <StatusSection key={group.key} state={state} group={group} />
      ))}

      {usedFlags(state, rows).map((f) => (
        <div className="footnote" key={f.id + f.symbol}>
          <span className="star" style={{ color: f.color }}>
            {f.symbol}
          </span>{' '}
          {f.note}
        </div>
      ))}

      <div className="footer">
        {lobLabel} · {vendorLabel} · Project Delivery Tracker · {rows.length} Actionable CRs
      </div>
    </div>
  )
}
