import { useState } from 'react'
import { useApp } from '../../state/AppContext'
import { exportProjectWorkbook } from '../../lib/exportExcel'

/** Downloads this project's tracker rows and delivered history as one .xlsx. */
export default function ExportButton() {
  const { state, currentProject, showToast } = useApp()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!currentProject || busy) return
    setBusy(true)
    try {
      await exportProjectWorkbook(state, currentProject)
      showToast('Excel downloaded — Tracker and Live CRs sheets')
    } catch (err) {
      showToast(`Export failed: ${err.message || err}`, true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button className="btn" onClick={run} disabled={busy} title="Download the tracker and Live CRs history as Excel">
      {busy ? 'Exporting…' : '⤓ Export Excel'}
    </button>
  )
}
