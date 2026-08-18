import { useEffect, useState } from 'react'
import Modal, { ModalActions } from '../ui/Modal'
import { useApp } from '../../state/AppContext'
import { addProject } from '../../state/actions'

export default function AddProjectModal({ open, onClose, onAdded }) {
  const { update, showToast } = useApp()
  const [name, setName] = useState('')

  useEffect(() => { if (open) setName('') }, [open])

  const confirm = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      showToast('Enter a project name first', true)
      return
    }
    update(addProject(trimmed))
    onClose()
    onAdded?.()
    showToast(`Project "${trimmed}" added — configure its Google Sheet below`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Add Project"
      sub="Give it a name — you can configure its Google Sheet and mapping afterward."
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
