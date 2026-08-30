import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import { isManualProject } from '../lib/model'
import { normalize } from '../lib/strings'
import ProjectDetailsCard from '../components/configure/ProjectDetailsCard'
import SheetConnectionCard from '../components/configure/SheetConnectionCard'
import MappingTable from '../components/configure/MappingTable'
import StatusMappingTable from '../components/configure/StatusMappingTable'
import StatusesTable from '../components/configure/StatusesTable'
import OverallMetricsTable from '../components/configure/OverallMetricsTable'
import AssigneesTable from '../components/configure/AssigneesTable'
import FlagsTable from '../components/configure/FlagsTable'
import GlobalCategoriesTable from '../components/configure/GlobalCategoriesTable'
import SectionRail from '../components/configure/SectionRail'
import ConnectSheetModal from '../components/modals/ConnectSheetModal'
import MappingModal from '../components/modals/MappingModal'
import AddColumnModal from '../components/modals/AddColumnModal'

/** Mapped columns that the last fetch didn't contain — sync leaves those fields blank. */
function missingMappedColumns(proj) {
  const headers = proj.lastFetchedHeaders || []
  if (!headers.length) return 0
  const mapped = Object.values(proj.mapping || {}).filter(Boolean)
  const custom = (proj.customColumns || []).filter((c) => c.type === 'sheet' && c.mappedColumn).map((c) => c.mappedColumn)
  return [...mapped, ...custom].filter((col) => !headers.includes(col)).length
}

/** Sheet values seen by the last sync that this project has neither mapped nor dismissed. */
function unmappedStatusValues(proj) {
  const ignored = proj.ignoredStatusValues || []
  return (proj.discoveredStatusValues || []).filter(
    (v) => !(proj.statusMapping || []).some((sm) => normalize(sm.sheetValue) === normalize(v)) && !ignored.includes(v)
  ).length
}

export default function ConfigureView() {
  const { currentProject, state } = useApp()
  const manual = isManualProject(currentProject)
  const [connectOpen, setConnectOpen] = useState(false)
  const [addColumnOpen, setAddColumnOpen] = useState(false)
  // Set once the Connect wizard has fetched a sheet: { headers, rows }.
  const [fetched, setFetched] = useState(null)
  // Which section each project was last left on, so switching projects to compare
  // the same setting doesn't drop you back at the top every time.
  const [sectionByProject, setSectionByProject] = useState({})

  const sections = useMemo(() => {
    if (!currentProject) return []
    const p = currentProject
    const missing = missingMappedColumns(p)
    const unmapped = unmappedStatusValues(p)
    return [
      { id: 'project', label: 'Project' },
      ...(manual
        ? []
        : [
            {
              id: 'sheet',
              label: 'Sheet & Mapping',
              warning:
                p.syncStatus === 'failed'
                  ? 'The last sync failed'
                  : missing
                    ? `${missing} mapped column${missing === 1 ? '' : 's'} missing from the sheet`
                    : '',
            },
          ]),
      {
        id: 'statuses',
        label: 'Statuses',
        badge: p.statusConfig.length,
        warning: unmapped ? `${unmapped} sheet value${unmapped === 1 ? '' : 's'} not mapped yet` : '',
      },
      { id: 'display', label: 'Tracker Display' },
      { id: 'global', label: 'Global', badge: state.globalCategories.length },
    ]
  }, [currentProject, manual, state.globalCategories.length])

  // A section can disappear (a project switched to tracker-only loses Sheet &
  // Mapping), so the stored choice is always validated against what's on offer.
  const stored = currentProject ? sectionByProject[currentProject.id] : null
  const active = sections.some((s) => s.id === stored) ? stored : sections[0]?.id
  const setActive = (id) => setSectionByProject((prev) => ({ ...prev, [currentProject.id]: id }))

  return (
    <div className="space-y-4">
      {!currentProject && (
        <div className="card p-5 text-[13px] text-ink-muted">
          No project yet — add one from the header to configure it.
        </div>
      )}

      {currentProject && (
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="md:sticky md:top-4">
            <SectionRail sections={sections} active={active} onChange={setActive} />
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            {active === 'project' && <ProjectDetailsCard />}

            {active === 'sheet' && !manual && (
              <>
                <SheetConnectionCard onOpenConnect={() => setConnectOpen(true)} />
                <MappingTable onAddColumn={() => setAddColumnOpen(true)} />
              </>
            )}

            {active === 'statuses' && (
              <>
                {!manual && <StatusMappingTable />}
                <StatusesTable />
              </>
            )}

            {active === 'display' && (
              <>
                <OverallMetricsTable />
                <AssigneesTable />
                <FlagsTable />
              </>
            )}

            {active === 'global' && <GlobalCategoriesTable />}
          </div>
        </div>
      )}

      <ConnectSheetModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onFetched={(payload) => {
          setConnectOpen(false)
          // Stamp the owning project so the mapping can't be applied to another.
          setFetched({ ...payload, projectId: currentProject?.id })
        }}
      />
      <MappingModal fetched={fetched} onClose={() => setFetched(null)} />
      <AddColumnModal open={addColumnOpen} onClose={() => setAddColumnOpen(false)} />
    </div>
  )
}
