import { useState } from 'react'
import { useApp } from '../state/AppContext'
import ProjectDetailsCard from '../components/configure/ProjectDetailsCard'
import SheetConnectionCard from '../components/configure/SheetConnectionCard'
import MappingTable from '../components/configure/MappingTable'
import StatusMappingTable from '../components/configure/StatusMappingTable'
import StatusesTable from '../components/configure/StatusesTable'
import OverallMetricsTable from '../components/configure/OverallMetricsTable'
import FlagsTable from '../components/configure/FlagsTable'
import SheetTabsTable from '../components/configure/SheetTabsTable'
import GlobalCategoriesTable from '../components/configure/GlobalCategoriesTable'
import ConnectSheetModal from '../components/modals/ConnectSheetModal'
import MappingModal from '../components/modals/MappingModal'
import AddColumnModal from '../components/modals/AddColumnModal'

export default function ConfigureView() {
  const { currentProject } = useApp()
  const [connectOpen, setConnectOpen] = useState(false)
  const [addColumnOpen, setAddColumnOpen] = useState(false)
  // Set once the Connect wizard has fetched a sheet: { headers, rows }.
  const [fetched, setFetched] = useState(null)

  return (
    <div className="space-y-4">
      {!currentProject && (
        <div className="card p-5 text-[13px] text-ink-muted">
          Select a specific project above (not “All Projects”) to edit its configuration.
        </div>
      )}

      {currentProject && (
        <>
          <ProjectDetailsCard />
          <SheetConnectionCard onOpenConnect={() => setConnectOpen(true)} />
          <MappingTable onAddColumn={() => setAddColumnOpen(true)} />
          <StatusMappingTable />
          <StatusesTable />
          <OverallMetricsTable />
          <FlagsTable />
          <SheetTabsTable />
        </>
      )}

      <GlobalCategoriesTable />

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
