import { useState } from 'react'
import TopBar from './components/layout/TopBar'
import Tabs from './components/layout/Tabs'
import SyncAllResults from './components/layout/SyncAllResults'
import Toast from './components/ui/Toast'
import ConfigureView from './views/ConfigureView'
import TrackerView from './views/TrackerView'
import BriefingView from './views/BriefingView'

export default function App() {
  const [tab, setTab] = useState('entry')
  const [syncAllResults, setSyncAllResults] = useState(null)

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <TopBar onGoToConfig={() => setTab('config')} onSyncAllResults={setSyncAllResults} />
        <Tabs tab={tab} onChange={setTab} />
      </header>

      <main className="mx-auto w-full max-w-[1760px] space-y-4 px-6 py-5">
        <SyncAllResults results={syncAllResults} onDismiss={() => setSyncAllResults(null)} />

        {tab === 'entry' && <TrackerView />}
        {tab === 'mail' && <BriefingView />}
        {tab === 'config' && <ConfigureView />}
      </main>

      <Toast />
    </div>
  )
}
