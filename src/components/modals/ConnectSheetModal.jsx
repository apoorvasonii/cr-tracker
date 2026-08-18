import { useEffect, useRef, useState } from 'react'
import Modal, { ModalActions, ModalSection } from '../ui/Modal'
import { useApp } from '../../state/AppContext'
import { patchProject } from '../../state/actions'
import { fetchAppsScriptSheets, fetchSheetForProject, isAppsScriptUrl } from '../../lib/sheets'

/**
 * Step 1: paste the link. Step 2: pick a tab. On success it hands the fetched
 * { headers, rows } up, so the Map Columns step never re-requests the sheet.
 */
export default function ConnectSheetModal({ open, onClose, onFetched }) {
  const { currentProject: proj, update, showToast } = useApp()
  const [step, setStep] = useState(1)
  const [url, setUrl] = useState('')
  const [tab, setTab] = useState('')
  const [hint, setHint] = useState('')
  const [appsScriptTabs, setAppsScriptTabs] = useState(null)
  const [busy, setBusy] = useState(false)

  // Read the project inside the reset effect through a ref, never as a dependency:
  // update() returns a freshly cloned state, so `proj` gets a new identity on every
  // edit — depending on it would reset the wizard back to step 1 mid-flow.
  const projRef = useRef(proj)
  projRef.current = proj

  useEffect(() => {
    if (!open) return
    setStep(1)
    setUrl(projRef.current?.googleSheetUrl || '')
    setTab(projRef.current?.sheetTabValue || '')
    setAppsScriptTabs(null)
    setHint('')
    setBusy(false)
  }, [open, proj?.id])

  const fetchNow = (tabValue) => {
    update(patchProject('sheetTabValue', tabValue))
    setBusy(true)
    fetchSheetForProject({ googleSheetUrl: url, sheetTabValue: tabValue })
      .then(({ headers, rows }) => {
        setBusy(false)
        if (!rows.length) {
          showToast('No rows found in that sheet/tab', true)
          return
        }
        onFetched({ headers, rows })
      })
      .catch((err) => {
        setBusy(false)
        showToast(err.message || String(err), true)
      })
  }

  const goToStep2 = () => {
    const trimmed = url.trim()
    if (!trimmed) {
      showToast('Paste a Google Sheet link first', true)
      return
    }
    update(patchProject('googleSheetUrl', trimmed))
    setStep(2)

    if (isAppsScriptUrl(trimmed)) {
      setHint('Checking that link for tabs…')
      setAppsScriptTabs([])
      fetchAppsScriptSheets(trimmed)
        .then((sheets) => {
          if (sheets.length === 1) {
            fetchNow('')
            return
          }
          setAppsScriptTabs(sheets)
          setTab(sheets[0].name)
          setHint(`Found ${sheets.length} tabs in that workbook — choose one:`)
        })
        .catch((err) => {
          setHint(
            'Could not read that Apps Script link — check it’s deployed with access set to "Anyone", then go back and check the link. (' +
              err.message +
              ')'
          )
        })
    } else {
      setAppsScriptTabs(null)
      setHint(
        'Pick a saved tab (Configure → Sheet Tabs), or leave the default to use the tab already in the link — or the first tab if it doesn’t specify one.'
      )
    }
  }

  if (!proj) return null

  return (
    <Modal open={open} onClose={onClose} title="Connect Google Sheet" sub={`Step ${step} of 2`}>
      {step === 1 ? (
        <>
          <ModalSection>
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              Paste the link to your Google Sheet. It must be shared as{' '}
              <b className="font-semibold text-ink">"Anyone with the link can view"</b> — or use an Apps Script Web App
              URL for private sheets.
            </p>
            <input
              type="text"
              className="field mt-3 w-full"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={url}
              autoFocus
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && goToStep2()}
            />
          </ModalSection>
          <ModalActions>
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" onClick={goToStep2}>
              Next
            </button>
          </ModalActions>
        </>
      ) : (
        <>
          <ModalSection title="Select a tab">
            <p className="mb-3 text-[12.5px] leading-relaxed text-ink-muted">{hint}</p>
            <select className="field-select w-full" value={tab} onChange={(e) => setTab(e.target.value)}>
              {appsScriptTabs ? (
                appsScriptTabs.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="">Tab: from link (or first)</option>
                  {proj.sheetTabConfig.map((t) => (
                    <option key={t.id} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </>
              )}
            </select>
          </ModalSection>
          <ModalActions>
            <button className="btn" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn-primary" disabled={busy} onClick={() => fetchNow(tab)}>
              {busy ? 'Fetching…' : 'Fetch sheet'}
            </button>
          </ModalActions>
        </>
      )}
    </Modal>
  )
}
