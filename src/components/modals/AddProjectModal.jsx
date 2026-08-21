import { useEffect, useState } from 'react'
import Modal, { ModalActions } from '../ui/Modal'
import { useApp } from '../../state/AppContext'
import { addProject } from '../../state/actions'

const SOURCES = [
  {
    value: 'sheet',
    title: 'From a Google Sheet',
    sub: 'CRs are pulled from a sheet and kept in sync. You map its columns next.',
  },
  {
    value: 'manual',
    title: 'Tracker only',
    sub: 'No sheet. You add and edit CRs directly in the tracker.',
  },
]

export default function AddProjectModal({ open, onClose, onAdded }) {
  const { update, showToast } = useApp()
  const [name, setName] = useState('')
  const [source, setSource] = useState('sheet')

  useEffect(() => {
    if (open) {
      setName('')
      setSource('sheet')
    }
  }, [open])

  const confirm = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      showToast('Enter a project name first', true)
      return
    }
    update(addProject(trimmed, source))
    onClose()
    onAdded?.()
    showToast(
      source === 'manual'
        ? `Project "${trimmed}" added — add its CRs in the tracker`
        : `Project "${trimmed}" added — configure its Google Sheet below`
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Add Project"
      sub="Name it, then choose where its CRs come from."
    >
      <input
        type="text"
        className="field w-full"
        placeholder="e.g. the client or line of business"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && confirm()}
      />

      <div className="mt-3 space-y-2">
        {SOURCES.map((s) => (
          <label
            key={s.value}
            className={`flex cursor-pointer gap-2.5 rounded-xl border p-3 ${
              source === s.value ? 'border-brand-500 bg-brand-50/60' : 'border-line hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name="project-source"
              className="mt-0.5"
              value={s.value}
              checked={source === s.value}
              onChange={() => setSource(s.value)}
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">{s.title}</span>
              <span className="block text-[12px] text-ink-muted">{s.sub}</span>
            </span>
          </label>
        ))}
      </div>

      <ModalActions>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={confirm}>
          Add project
        </button>
      </ModalActions>
    </Modal>
  )
}
