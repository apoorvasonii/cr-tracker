import { useState } from 'react'
import { useApp } from '../../state/AppContext'
import { deleteProject, selectProject } from '../../state/actions'
import { relativeSyncTime } from '../../lib/dates'
import { isManualProject } from '../../lib/model'
import AddProjectModal from '../modals/AddProjectModal'
import { removedText } from '../../lib/sync'

function SyncLine({ project }) {
  if (!project) {
    return <div className="hidden text-[12px] leading-tight text-ink-muted lg:block">All projects · read-only view</div>
  }

  if (isManualProject(project)) {
    return (
      <div className="hidden text-[12px] leading-tight text-ink-muted lg:block">Tracker-only · no Google Sheet</div>
    )
  }

  const state = project.syncStatus
  const dot =
    state === 'failed' ? 'bg-red-500' : state === 'syncing' ? 'bg-brand-500 animate-pulse' : state === 'success' ? 'bg-emerald-500' : 'bg-slate-300'
  const statusLabel =
    state === 'failed' ? 'Sync failed' : state === 'syncing' ? 'Syncing…' : state === 'success' ? 'Synced' : 'Never synced'

  return (
    <div className="hidden min-w-0 text-[12px] leading-tight lg:block">
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-ink-muted">
          {project.lastSyncedAt ? relativeSyncTime(project.lastSyncedAt).replace('Synced ', 'Updated ') : 'Never synced'}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className={state === 'failed' ? 'font-semibold text-red-600' : 'font-semibold text-ink-soft'}>
          {statusLabel}
        </span>
      </div>
      <div className="truncate text-ink-muted">
        Google Sheet · {project.sheetTabValue || 'tab from link'}
      </div>
    </div>
  )
}

/** Where this tab's data is going: shared workspace, or this browser only. */
function StorageBadge({ status }) {
  const map = {
    shared: { label: 'Shared', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500',
      title: 'Changes are saved to the shared workspace and appear for everyone' },
    connecting: { label: 'Connecting…', cls: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500 animate-pulse',
      title: 'Loading the shared workspace' },
    error: { label: 'Not shared', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500',
      title: 'Shared storage unreachable — changes are staying in this browser' },
    local: { label: 'This browser', cls: 'bg-slate-100 text-ink-soft', dot: 'bg-slate-400',
      title: 'No shared storage configured — data lives in this browser only' },
  }
  const s = map[status] || map.local
  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold lg:inline-flex ${s.cls}`}
      title={s.title}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

export default function TopBar({ onGoToConfig, onSyncAllResults }) {
  const { state, currentProject, remoteStatus, update, showToast, syncProject, syncAllProjects } = useApp()
  const [addOpen, setAddOpen] = useState(false)

  const title = currentProject ? currentProject.displayName : 'No project'
  const subtitle = currentProject ? currentProject.lobName : 'Add a project to get started'
  const initial = (currentProject?.lobName || 'A').charAt(0).toUpperCase()

  const syncCurrent = () => {
    if (!currentProject) return
    const name = currentProject.lobName
    showToast('Syncing ' + name + '...')
    syncProject(currentProject.id).then((result) => {
      if (result.success) {
        const warn = result.warnings.length
          ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'})`
          : ''
        showToast(`Synced ${name}: ${result.recordsCreated} added, ${result.recordsUpdated} updated${removedText(result)}${warn}`)
      } else {
        showToast(`Sync failed for ${name}: ${result.errors[0] || 'unknown error'}`, true)
      }
    })
  }

  const syncAll = () => {
    onSyncAllResults('pending')
    syncAllProjects().then(onSyncAllResults)
  }

  const removeProject = () => {
    if (!currentProject) return
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
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500 text-[17px] font-semibold text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[19px] font-semibold leading-tight text-ink">{title}</h1>
            <p className="truncate text-[12px] text-ink-muted">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="field-select min-w-[190px] font-semibold"
            value={currentProject?.id || ''}
            onChange={(e) => update(selectProject(e.target.value))}
          >
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.lobName}
              </option>
            ))}
          </select>
          <button className="btn-icon" title="Add project" onClick={() => setAddOpen(true)}>
            +
          </button>
          <button className="btn-icon hover:text-red-600" title="Delete this project" onClick={removeProject}>
            🗑
          </button>
        </div>

        <SyncLine project={currentProject} />
        <StorageBadge status={remoteStatus} />

        <div className="ml-auto flex items-center gap-2">
          {!isManualProject(currentProject) && (
            <button className="btn" onClick={syncCurrent}>
              <span className="text-ink-muted">↻</span> Sync
            </button>
          )}
          <button className="btn-primary" onClick={syncAll}>
            ↻ Sync All
          </button>
        </div>
      </div>

      <AddProjectModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={onGoToConfig} />
    </>
  )
}
