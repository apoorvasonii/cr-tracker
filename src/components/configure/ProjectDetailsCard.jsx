import { useApp } from '../../state/AppContext'
import { deleteProject, patchProject } from '../../state/actions'
import ConfigCard from './ConfigCard'

export default function ProjectDetailsCard() {
  const { state, currentProject, update, showToast } = useApp()

  const remove = () => {
    if (state.projects.length <= 1) {
      showToast('You need at least one project', true)
      return
    }
    if (!confirm(`Delete project "${currentProject.lobName}" and all its CR rows? This cannot be undone.`)) return
    const name = currentProject.lobName
    update(deleteProject(currentProject.id))
    showToast(`Project "${name}" deleted`)
  }

  return (
    <ConfigCard
      title="Project Details"
      sub="LOB name labels the client side of the tracker, display name titles the briefing, and the data source decides whether CRs come from a sheet."
      action={
        <button className="btn-danger btn-sm" onClick={remove}>
          Delete project
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl lg:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
            LOB Name
          </span>
          <input
            type="text"
            className="field w-full"
            value={currentProject.lobName}
            onChange={(e) => update(patchProject('lobName', e.target.value))}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
            Data Source
          </span>
          <select
            className="field-select w-full"
            title="Tracker only hides all sheet configuration and keeps this project out of Sync All"
            value={currentProject.source === 'manual' ? 'manual' : 'sheet'}
            onChange={(e) => update(patchProject('source', e.target.value))}
          >
            <option value="sheet">Google Sheet — synced</option>
            <option value="manual">Tracker only — no sheet</option>
          </select>
        </label>
        {currentProject.source !== 'manual' && (
        <label className="block">
          <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
            Sheet Date Format
          </span>
          <select
            className="field-select w-full"
            title="How to read ambiguous numeric dates like 1/2/2026 in this client's sheet"
            value={currentProject.dateOrder || 'dmy'}
            onChange={(e) => update(patchProject('dateOrder', e.target.value))}
          >
            <option value="dmy">Day first — 1/2/2026 is 1 Feb</option>
            <option value="mdy">Month first — 1/2/2026 is 2 Jan</option>
          </select>
        </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
            Project Display Name
          </span>
          <input
            type="text"
            className="field w-full"
            value={currentProject.displayName}
            onChange={(e) => update(patchProject('displayName', e.target.value))}
          />
        </label>
      </div>
    </ConfigCard>
  )
}
