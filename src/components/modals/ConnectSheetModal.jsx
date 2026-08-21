import { useEffect, useRef, useState } from 'react'
import Modal, { ModalActions, ModalSection } from '../ui/Modal'
import { useApp } from '../../state/AppContext'
import { patchProject } from '../../state/actions'
import { fetchAppsScriptSheets, fetchSheetForProject, isAppsScriptUrl } from '../../lib/sheets'

/**
 * Step 1: paste the link. Step 2: fetch it — the workbook's own tab names are
 * offered only when there is more than one to choose between, otherwise the single
 * tab (or the one named by the link) is taken without asking. On success it hands
 * the fetched { headers, rows } up, so Map Columns never re-requests the sheet.
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
        const message = err.message || String(err)
        setHint(message)
        showToast(message, true)
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
          // One tab needs no decision — take it and go straight to the columns.
          if (sheets.length === 1) {
            fetchNow('')
            return
          }
          setAppsScriptTabs(sheets)
          setTab(sheets[0].name)
          setHint(`That workbook has ${sheets.length} tabs — choose the one holding the CRs:`)
        })
        .catch((err) => {
          setHint(
            'Could not read that Apps Script link — check it’s deployed with access set to "Anyone", then go back and check the link. (' +
              err.message +
              ')'
          )
        })
      return
    }

    // A plain sheet link doesn't expose its tab list to the browser, so there's
    // nothing to choose from: fetch the tab the link names, or the first one.
    setAppsScriptTabs(null)
    setTab('')
    setHint('Fetching the tab from that link — or its first tab if the link doesn’t name one…')
    fetchNow('')
  }

  if (!proj) return null

  // Only an Apps Script workbook with several tabs leaves anything to pick.
  const hasTabChoice = !!appsScriptTabs && appsScriptTabs.length > 1

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
          <ModalSection title={hasTabChoice ? 'Select a tab' : 'Fetching the sheet'}>
            <p className="text-[12.5px] leading-relaxed text-ink-muted">{hint}</p>
            {hasTabChoice && (
              <select
                className="field-select mt-3 w-full"
                value={tab}
                onChange={(e) => setTab(e.target.value)}
              >
                {appsScriptTabs.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </ModalSection>
          <ModalActions>
            <button className="btn" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn-primary" disabled={busy} onClick={() => fetchNow(hasTabChoice ? tab : '')}>
              {busy ? 'Fetching…' : hasTabChoice ? 'Fetch this tab' : 'Retry fetch'}
            </button>
          </ModalActions>
        </>
      )}
    </Modal>
  )
}
