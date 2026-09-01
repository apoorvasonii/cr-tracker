import { useEffect, useRef, useState } from 'react'
import TopBar from './components/layout/TopBar'
import Tabs from './components/layout/Tabs'
import Toast from './components/ui/Toast'
import ConfigureView from './views/ConfigureView'
import TrackerView from './views/TrackerView'
import BriefingView from './views/BriefingView'

export default function App() {
  const [tab, setTab] = useState('entry')
  const headerRef = useRef(null)

  // The header wraps at narrow widths, so anything sizing itself against it reads
  // the measured height instead of guessing.
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const publish = () =>
      document.documentElement.style.setProperty('--app-header-h', `${el.offsetHeight}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-full">
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-line bg-white">
        <TopBar onGoToConfig={() => setTab('config')} />
        <Tabs tab={tab} onChange={setTab} />
      </header>

      <main className="mx-auto w-full max-w-[1760px] space-y-4 px-6 py-5">
        {tab === 'entry' && <TrackerView />}
        {tab === 'mail' && <BriefingView />}
        {tab === 'config' && <ConfigureView />}
      </main>

      <Toast />
    </div>
  )
}
