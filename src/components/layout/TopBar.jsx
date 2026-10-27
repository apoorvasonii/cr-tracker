import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../state/AppContext'
import { deleteProject, selectProject } from '../../state/actions'
import { relativeSyncTime } from '../../lib/dates'
import { isManualProject } from '../../lib/model'
import AddProjectModal from '../modals/AddProjectModal'
import { removedText } from '../../lib/sync'

function ProjectPicker({ projects, currentId, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = projects.find((p) => p.id === currentId)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="field-select min-w-[190px] text-left font-semibold"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {current?.lobName || 'Select project'}
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-80 min-w-full overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg"
        >
          {projects.map((p) => {
            const active = p.id === currentId
            return (
              <li key={p.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 whitespace-nowrap px-3 py-2 text-left text-[13px] hover:bg-slate-50 ${
                    active ? 'font-semibold text-brand-600' : 'text-ink'
                  }`}
                  onClick={() => {
                    onSelect(p.id)
                    setOpen(false)
                  }}
                >
                  {p.lobName}
                  {active && <span aria-hidden>✓</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SyncLine({ project }) {
  if (!project) return null

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

export default function TopBar({ onGoToConfig }) {
  const { state, currentProject, remoteStatus, update, showToast, syncProject } = useApp()
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
        showToast(`Synced ${name}: ${result.recordsCreated} added, ${result.recordsUpdated} updated${removedText(result)}${warn}`, false, result.undo && (() => { result.undo(); showToast('Sync undone') }))
      } else if (result.cancelled) {
        showToast('Sync cancelled — nothing was changed')
      } else {
        showToast(`Sync failed for ${name}: ${result.errors[0] || 'unknown error'}`, true)
      }
    })
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
          <ProjectPicker
            projects={state.projects}
            currentId={currentProject?.id}
            onSelect={(id) => update(selectProject(id))}
          />
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
            <button className="btn-primary" onClick={syncCurrent}>
              ↻ Sync
            </button>
          )}
        </div>
      </div>

      <AddProjectModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={onGoToConfig} />
    </>
  )
}
