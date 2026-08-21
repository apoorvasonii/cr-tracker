import { useApp } from '../../state/AppContext'
import {
  addOverallMetric,
  moveOverallMetric,
  removeOverallMetric,
  toggleOverallMetricStatus,
  updateOverallMetric,
} from '../../state/actions'
import { METRIC_SOURCES, metricValue } from '../../lib/model'

function OrderButtons({ position, isFirst, isLast, onMove }) {
  const cls =
    'grid h-6 w-6 place-items-center rounded-md border border-line bg-white text-[10px] text-ink-soft ' +
    'enabled:hover:border-brand-500 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 ' +
    'disabled:cursor-not-allowed disabled:opacity-30'
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-4 text-[12px] font-semibold tabular-nums text-ink-muted">{position}</span>
      <div className="flex flex-col gap-0.5">
        <button className={cls} disabled={isFirst} title="Move up" onClick={() => onMove('up')}>
          ▲
        </button>
        <button className={cls} disabled={isLast} title="Move down" onClick={() => onMove('down')}>
          ▼
        </button>
      </div>
    </div>
  )
}

/** What a tile counts depends on its source, so the definition cell changes shape. */
function DefinitionCell({ metric, proj, categories, update }) {
  if (metric.source === 'all') {
    return <span className="text-[12px] text-ink-muted">Every CR in this project</span>
  }

  if (metric.source === 'manual') {
    return (
      <input
        type="number"
        className="field w-28 tabular-nums"
        value={metric.value ?? 0}
        onChange={(e) => update(updateOverallMetric(metric.id, 'value', parseInt(e.target.value, 10) || 0))}
      />
    )
  }

  if (metric.source === 'category') {
    return (
      <select
        className="field-select w-full max-w-[220px]"
        value={metric.categoryId || ''}
        onChange={(e) => update(updateOverallMetric(metric.id, 'categoryId', e.target.value))}
      >
        <option value="">— pick a category —</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    )
  }

  if (!proj.statusConfig.length) {
    return (
      <span className="text-[12px] text-ink-muted">
        No statuses yet — sync a sheet, or give a row a status on the tracker
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {proj.statusConfig.map((s) => {
        const active = (metric.statusKeys || []).includes(s.key)
        return (
          <label
            key={s.key}
            className={`chip ${active ? 'chip-active' : 'hover:border-ink-muted/40'}`}
            style={active ? { backgroundColor: s.color, borderColor: s.color } : undefined}
          >
            <input
              type="checkbox"
              className="hidden"
              checked={active}
              onChange={(e) => update(toggleOverallMetricStatus(metric.id, s.key, e.target.checked))}
            />
            {s.label}
          </label>
        )
      })}
    </div>
  )
}

export default function OverallMetricsTable() {
  const { state, currentProject: proj, update } = useApp()
  const metrics = proj.overallMetrics || []

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="card-title">Overall Status Tiles</h2>
          <p className="card-sub max-w-3xl">
            Every tile in the Briefing’s Overall Status panel — Total, Live, In Pipeline and any others — is defined
            the same way: set <b className="font-semibold">Counts</b> to “Chosen statuses” to say exactly which statuses
            it adds up. The <b className="font-semibold">first tile is the base</b> for the percentages on the rest.
          </p>
        </div>
        <button className="btn btn-sm" onClick={() => update(addOverallMetric())}>
          + Add tile
        </button>
      </div>

      <table className="cfg-table">
        <thead>
          <tr>
            <th style={{ width: '8%' }}>Order</th>
            <th style={{ width: '17%' }}>Tile Label</th>
            <th style={{ width: '6%' }}>Color</th>
            <th style={{ width: '14%' }}>Counts</th>
            <th style={{ width: '35%' }}>Definition</th>
            <th style={{ width: '7%' }} title="Show this tile's value as a % of the first tile">
              Show %
            </th>
            <th style={{ width: '7%' }}>Now</th>
            <th style={{ width: '6%' }} />
          </tr>
        </thead>
        <tbody>
          {metrics.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-ink-muted">
                No tiles — the Briefing’s Overall Status panel will be empty. Add one to start.
              </td>
            </tr>
          )}
          {metrics.map((m, i) => (
            <tr key={m.id}>
              <td>
                <OrderButtons
                  position={i + 1}
                  isFirst={i === 0}
                  isLast={i === metrics.length - 1}
                  onMove={(dir) => update(moveOverallMetric(m.id, dir))}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="field w-full font-semibold"
                  value={m.label}
                  onChange={(e) => update(updateOverallMetric(m.id, 'label', e.target.value))}
                />
              </td>
              <td>
                <input
                  type="color"
                  className="swatch"
                  value={m.color}
                  onChange={(e) => update(updateOverallMetric(m.id, 'color', e.target.value))}
                />
              </td>
              <td>
                <select
                  className="field-select w-full"
                  value={m.source}
                  onChange={(e) => update(updateOverallMetric(m.id, 'source', e.target.value))}
                >
                  {METRIC_SOURCES.map((src) => (
                    <option key={src.id} value={src.id}>
                      {src.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <DefinitionCell metric={m} proj={proj} categories={state.globalCategories} update={update} />
              </td>
              <td className="text-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  disabled={i === 0}
                  title={i === 0 ? 'The first tile is the percentage base' : undefined}
                  checked={i !== 0 && m.showPercent !== false}
                  onChange={(e) => update(updateOverallMetric(m.id, 'showPercent', e.target.checked))}
                />
              </td>
              <td className="text-[13px] font-semibold tabular-nums text-ink-soft">{metricValue(state, proj, m)}</td>
              <td className="text-center">
                <button
                  className="rounded-lg px-2 py-1 text-[15px] text-ink-muted hover:bg-red-50 hover:text-red-600"
                  onClick={() => update(removeOverallMetric(m.id))}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
