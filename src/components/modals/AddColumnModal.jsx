import { useEffect, useState } from 'react'
import Modal, { FieldGrid, FieldLabel, ModalActions } from '../ui/Modal'
import { useApp } from '../../state/AppContext'
import { addCustomColumn } from '../../state/actions'
import { usefulHeaders } from '../../lib/sheets'
import { isManualProject } from '../../lib/model'

export default function AddColumnModal({ open, onClose }) {
  const { currentProject: proj, update, showToast } = useApp()
  const [label, setLabel] = useState('')
  const [type, setType] = useState('sheet')
  const [sheetCol, setSheetCol] = useState('')

  const headers = usefulHeaders(proj?.lastFetchedHeaders || [])
  const manualProject = isManualProject(proj)

  useEffect(() => {
    if (!open) return
    setLabel('')
    setType(manualProject ? 'manual' : 'sheet')
    setSheetCol(headers[0] || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!proj) return null

  const confirm = () => {
    const trimmed = label.trim()
    if (!trimmed) {
      showToast('Enter a column name first', true)
      return
    }
    update(addCustomColumn(trimmed, type, type === 'sheet' ? sheetCol : ''))
    onClose()
    showToast(`Column "${trimmed}" added`)
  }

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Add Column" sub="A custom tracker column for this project.">
      <FieldGrid labelWidth="130px">
        <FieldLabel>Column name</FieldLabel>
        <input
          type="text"
          className="field w-full"
          placeholder="e.g. Business Priority"
          value={label}
          autoFocus
          onChange={(e) => setLabel(e.target.value)}
        />

        {!manualProject && <FieldLabel>Type</FieldLabel>}
        {!manualProject && <select className="field-select w-full" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="sheet">Google Sheet mapped</option>
          <option value="manual">Manual</option>
        </select>}

        {!manualProject && type === 'sheet' && (
          <>
            <FieldLabel>Sheet column</FieldLabel>
            <select className="field-select w-full" value={sheetCol} onChange={(e) => setSheetCol(e.target.value)}>
              {headers.length ? (
                headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))
              ) : (
                <option value="">— connect a sheet first —</option>
              )}
            </select>
          </>
        )}
      </FieldGrid>

      <ModalActions>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={confirm}>
          Add column
        </button>
      </ModalActions>
    </Modal>
  )
}
