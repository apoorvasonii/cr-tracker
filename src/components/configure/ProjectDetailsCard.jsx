import { useApp } from '../../state/AppContext'
import { patchProject } from '../../state/actions'
import ConfigCard from './ConfigCard'

export default function ProjectDetailsCard() {
  // Deleting a project lives only in the top bar, so it can't be hit while
  // someone is editing this card's fields.
  const { currentProject, update } = useApp()

  return (
    <ConfigCard title="Project Details">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <label className="block">
          <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
            Briefing Header
          </span>
          <input
            type="text"
            className="field w-full"
            placeholder="CR Tracker"
            title="The line across the top of the Briefing and the email, after the display name"
            value={currentProject.briefingHeader || ''}
            onChange={(e) => update(patchProject('briefingHeader', e.target.value))}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
            Briefing Sub-heading
          </span>
          <input
            type="text"
            className="field w-full"
            placeholder="optional — e.g. Weekly status, week 34"
            title="Smaller line under the Briefing header; left out entirely when empty"
            value={currentProject.briefingSubheader || ''}
            onChange={(e) => update(patchProject('briefingSubheader', e.target.value))}
          />
        </label>
      </div>
    </ConfigCard>
  )
}
