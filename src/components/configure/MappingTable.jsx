import { useApp } from '../../state/AppContext'
import { clearColumnMapping, removeCustomColumn } from '../../state/actions'
import { isManualProject } from '../../lib/model'
import ConfigCard from './ConfigCard'

const DASH = '—'

/** Feature is required by sync, so it's the one mapping that can't be cleared here. */
const SOURCE_FIELDS = [
  { field: 'name', label: 'Feature', required: true },
  { field: 'section', label: 'Status' },
  { field: 'action', label: 'Next Action On' },
  { field: 'planned', label: 'Planned End Date' },
  { field: 'brdDateCol', label: 'BRD Date' },
  { field: 'movedDateCol', label: 'Moved to Current Status' },
  { field: 'idColumn', label: 'Unique ID' },
]

const TAG = {
  source: 'bg-brand-50 text-brand-700',
  calculated: 'bg-violet-50 text-violet-700',
  manual: 'bg-rose-50 text-rose-700',
}

function TypeTag({ type }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[10.5px] font-semibold capitalize ${TAG[type]}`}>
      {type}
    </span>
  )
}

export default function MappingTable({ onAddColumn }) {
  const { currentProject, update, showToast } = useApp()
  const m = currentProject.mapping
  const manual = isManualProject(currentProject)
  const hasHeaders = (currentProject.lastFetchedHeaders || []).length > 0

  const clear = (f) => {
    update(clearColumnMapping(f.field))
    showToast(`${f.label} unmapped — re-sync to apply`)
  }

  const remove = (col) => {
    update(removeCustomColumn(col.id))
    showToast(`Column "${col.label}" removed`)
  }

  return (
    <ConfigCard
      title={manual ? 'Tracker Columns' : 'Tracker Columns & Mapping'}
      sub={
        manual
          ? 'This project has no sheet: every column is filled in on the tracker, except the calculated ones.'
          : 'Source columns come from the sheet; calculated ones are derived; manual ones are only ever edited here.'
      }
      action={
        <button className="btn btn-sm" onClick={onAddColumn}>
          + Column
        </button>
      }
    >
      <table className="cfg-table">
        <thead>
          <tr>
            <th style={{ width: manual ? '60%' : '28%' }}>Tracker Column</th>
            {!manual && <th style={{ width: '42%' }}>Google Sheet Column</th>}
            <th style={{ width: '16%' }}>Type</th>
            <th style={{ width: '14%' }} />
          </tr>
        </thead>
        <tbody>
          {SOURCE_FIELDS.map((f) => {
            const value = m[f.field]
            return (
            <tr key={f.field}>
              <td className="font-medium">
                {f.label}
                {f.required && <span className="ml-1 text-ink-muted">*</span>}
              </td>
              {!manual && (
                <td className={value ? '' : 'text-ink-muted'}>
                  {f.required && !hasHeaders ? 'Connect a sheet to map' : value || 'Not mapped'}
                </td>
              )}
              <td>
                <TypeTag type={manual ? 'manual' : 'source'} />
              </td>
              <td className="text-right">
                {!manual && value && !f.required && (
                  <button
                    className="rounded-lg px-2 py-1 text-[15px] text-ink-muted hover:bg-red-50 hover:text-red-600"
                    title={`Unmap ${f.label}`}
                    onClick={() => clear(f)}
                  >
                    ×
                  </button>
                )}
              </td>
            </tr>
            )
          })}

          {['Overall Age', 'Age in Current State'].map((label) => (
            <tr key={label}>
              <td className="font-medium">{label}</td>
              {!manual && <td className="text-ink-muted">{DASH}</td>}
              <td>
                <TypeTag type="calculated" />
              </td>
              <td />
            </tr>
          ))}

          <tr>
            <td className="font-medium">Flags</td>
            {!manual && <td className="text-ink-muted">{DASH}</td>}
            <td>
              <TypeTag type="manual" />
            </td>
            <td />
          </tr>

          {(currentProject.customColumns || []).map((c) => (
            <tr key={c.id}>
              <td className="font-medium">{c.label}</td>
              {!manual && (
                <td className={c.type === 'manual' || !c.mappedColumn ? 'text-ink-muted' : ''}>
                  {c.type === 'manual' ? DASH : c.mappedColumn || 'Not mapped'}
                </td>
              )}
              <td>
                <TypeTag type={c.type === 'manual' ? 'manual' : 'source'} />
              </td>
              <td className="text-right">
                <button
                  className="rounded-lg px-2 py-1 text-[15px] text-ink-muted hover:bg-red-50 hover:text-red-600"
                  onClick={() => remove(c)}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ConfigCard>
  )
}
