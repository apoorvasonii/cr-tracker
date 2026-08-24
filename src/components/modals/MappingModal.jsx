import { useEffect, useState } from 'react'
import Modal, { FieldGrid, FieldLabel, ModalActions, ModalSection } from '../ui/Modal'
import { useApp } from '../../state/AppContext'
import { saveMapping, setFetchedHeaders } from '../../state/actions'
import { guessColumn, usefulHeaders } from '../../lib/sheets'
import { removedText } from '../../lib/sync'

/**
 * Guess lists are ordered: exact (normalized) matches are tried across the whole
 * list first, then substring matches — so put the most specific spelling first.
 * Real sheets phrase these very differently ("Responsibility" for Next Action On,
 * "Date of BRD Signoff" for BRD Date), hence the long lists.
 */
const STANDARD_FIELDS = [
  {
    key: 'name',
    label: 'Feature (CR Name) *',
    guesses: ['CR', 'CR Name', 'Feature', 'Name', 'Requirement', 'Change Request'],
  },
  { key: 'section', label: 'Status', guesses: ['Status', 'Stage', 'Section', 'Current Stage', 'Current Status'] },
  {
    key: 'action',
    label: 'Next Action On',
    guesses: ['Next Action On', 'Responsibility', 'Action On', 'Owner', 'PIC', 'Responsible', 'Pending On'],
  },
  {
    key: 'planned',
    label: 'Planned End Date',
    guesses: [
      'Planned End Date',
      'UAT Timeline',
      'Final timeline',
      'End date',
      'UAT Delivered On',
      'Planned Date',
      'UAT Date',
      'Target Date',
      'Timeline',
    ],
  },
  {
    key: 'brdDateCol',
    label: 'BRD Date',
    guesses: [
      'Date of BRD Signoff',
      'Date of BRD Sign-off',
      'BRD Signoff Date',
      'BRD Sign-off Date',
      'Date of BRD',
      'BRD Date',
      'Sign-off Date',
      'BRD Approval',
      'Requirement Clarification Date',
    ],
  },
  {
    key: 'movedDateCol',
    label: 'Moved to Current Status',
    guesses: [
      'Date of last action',
      'Moved to Current Status',
      'Last Action Date',
      'Date of Last Action',
      'Status Change Date',
      'Latest Action Date',
    ],
  },
  // Deliberately not guessing ticket-reference columns (e.g. Jira): they're often
  // blank, and a blank identity is worse than no mapping at all.
  { key: 'idColumn', label: 'Unique ID Column', guesses: ['CR ID', 'Unique ID', 'Record ID', 'ID'] },
]

function HeaderSelect({ headers, value, onChange }) {
  return (
    <select className="field-select w-full" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— None —</option>
      {headers.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
      {/* A previously mapped column that's missing from this fetch would otherwise
          silently reset the select to "None". */}
      {value && !headers.includes(value) && <option value={value}>{value} (not in this sheet)</option>}
    </select>
  )
}

/** `fetched` is { headers, rows } from the Connect wizard; null keeps this closed. */
export default function MappingModal({ fetched, onClose }) {
  const { currentProject: proj, update, showToast, applyFetchedRows } = useApp()
  const [draft, setDraft] = useState({})
  const [customDraft, setCustomDraft] = useState({})

  const headers = fetched?.headers || []
  const rows = fetched?.rows || []
  // Pickers hide the sheet's empty trailing columns; parsing keeps them.
  const pickable = usefulHeaders(headers)

  useEffect(() => {
    if (!fetched || !proj) return
    update(setFetchedHeaders(headers))
    const m = proj.mapping
    const next = {}
    STANDARD_FIELDS.forEach((f) => {
      next[f.key] = m[f.key] || guessColumn(headers, ...f.guesses)
    })
    setDraft(next)
    const custom = {}
    ;(proj.customColumns || []).filter((c) => c.type === 'sheet').forEach((c) => { custom[c.id] = c.mappedColumn || '' })
    setCustomDraft(custom)
    // Re-derive only when a new fetch arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetched])

  if (!fetched || !proj) return null

  const garbledCount = headers.filter((h) => /^_\d+$/.test((h || '').trim()) || !h || !h.trim()).length
  const showHeaderWarning = headers.length > 0 && garbledCount / headers.length > 0.4
  const sheetCustoms = (proj.customColumns || []).filter((c) => c.type === 'sheet')

  const save = () => {
    if (!draft.name) {
      showToast('Please map the Feature (CR Name) column first', true)
      return
    }
    // The sheet was fetched for one project; saving after switching projects would
    // write the mapping — and the rows — onto the wrong one.
    if (fetched.projectId && fetched.projectId !== proj.id) {
      showToast('Project changed since this sheet was fetched — re-run Connect & Configure Mapping', true)
      onClose()
      return
    }
    update(
      saveMapping(
        {
          name: draft.name,
          section: draft.section,
          action: draft.action,
          planned: draft.planned,
          idColumn: draft.idColumn,
          brdDateCol: draft.brdDateCol,
          movedDateCol: draft.movedDateCol,
        },
        customDraft
      )
    )

    const result = applyFetchedRows(proj.id, headers, rows)
    onClose()
    if (result) {
      const warn = result.warnings.length
        ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'})`
        : ''
      showToast(`Mapping saved. Synced: ${result.recordsCreated} added, ${result.recordsUpdated} updated${removedText(result)}${warn}`)
    } else {
      showToast('Mapping saved')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Map Columns"
      sub={`Found ${pickable.length} usable columns and ${rows.length} rows.`}
    >
      {showHeaderWarning && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[12.5px] leading-relaxed text-red-800">
          <b className="block font-semibold">⚠ Your header row doesn’t look right.</b>
          Most columns came through unnamed. Check the correct tab is selected and that the sheet’s first row is a real
          header row.
        </div>
      )}

      <ModalSection title="Column Mapping">
        <FieldGrid labelWidth="200px">
          {STANDARD_FIELDS.map((f) => (
            <div key={f.key} className="contents">
              <FieldLabel>{f.label}</FieldLabel>
              <HeaderSelect
                headers={pickable}
                value={draft[f.key] || ''}
                onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
              />
            </div>
          ))}
        </FieldGrid>
      </ModalSection>

      {sheetCustoms.length > 0 && (
        <ModalSection title="Custom Columns">
          <FieldGrid labelWidth="200px">
            {sheetCustoms.map((c) => (
              <div key={c.id} className="contents">
                <FieldLabel>{c.label}</FieldLabel>
                <HeaderSelect
                  headers={pickable}
                  value={customDraft[c.id] || ''}
                  onChange={(v) => setCustomDraft((d) => ({ ...d, [c.id]: v }))}
                />
              </div>
            ))}
          </FieldGrid>
        </ModalSection>
      )}

      <p className="text-[12px] leading-relaxed text-ink-muted">
        Overall Age and Age in Current State are calculated from BRD Date / Moved to Current Status in business days —
        Saturdays and Sundays are excluded, and a week is five of them — so they don’t need their own mapping.
      </p>

      <ModalActions>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={save}>
          ↻ Save mapping &amp; sync
        </button>
      </ModalActions>
    </Modal>
  )
}
