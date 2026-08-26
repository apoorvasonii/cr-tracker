import { useApp } from '../../state/AppContext'
import { addAssignee, removeAssignee, updateAssignee } from '../../state/actions'
import { ASSIGNEE_PREFIX, VENDOR_NAME } from '../../lib/model'
import ConfigCard from './ConfigCard'

/**
 * The two standard parties — the client LOB and Salescode — are fixed and shown
 * here only for context. Everything below them is a project-defined party a CR
 * can be handed to instead of being left unassigned.
 */
export default function AssigneesTable() {
  const { state, currentProject: proj, update } = useApp()
  const assignees = proj.assigneeConfig || []

  const countFor = (action) => state.crData.filter((r) => r.projectId === proj.id && r.action === action).length

  const Builtin = ({ label, action, color }) => (
    <tr className="text-ink-muted">
      <td>
        <span
          className="mr-2 inline-block h-[8px] w-[8px] rounded-full align-middle"
          style={{ background: color }}
        />
        {label}
      </td>
      <td className="text-[12px]">Built in</td>
      <td className="text-[12px]">
        {countFor(action)} CR{countFor(action) === 1 ? '' : 's'}
      </td>
      <td />
    </tr>
  )

  return (
    <ConfigCard
      title="Responsibility"
      sub="Who a CR can be pending on. Beyond the two standard parties, add anyone else who takes ownership — they then appear in the tracker's Next Action On dropdown."
      action={
        <button className="btn btn-sm" onClick={() => update(addAssignee(''))}>
          + Add assignee
        </button>
      }
    >
      <table className="cfg-table">
        <thead>
          <tr>
            <th style={{ width: '48%' }}>Assignee</th>
            <th style={{ width: '18%' }}>Colour</th>
            <th style={{ width: '18%' }}>Usage</th>
            <th style={{ width: '8%' }} />
          </tr>
        </thead>
        <tbody>
          <Builtin label={proj.lobName} action="client" color="#8a5a3f" />
          <Builtin label={VENDOR_NAME} action="vendor" color="#4a7fae" />
          <Builtin label={`${proj.lobName} + ${VENDOR_NAME}`} action="both" color="#6a5a9a" />

          {assignees.map((a) => {
            const count = countFor(ASSIGNEE_PREFIX + a.id)
            return (
              <tr key={a.id}>
                <td>
                  <input
                    type="text"
                    className="field w-full"
                    placeholder="Name of the person or team"
                    value={a.label}
                    onChange={(e) => update(updateAssignee(a.id, 'label', e.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="color"
                    className="swatch"
                    value={a.color}
                    onChange={(e) => update(updateAssignee(a.id, 'color', e.target.value))}
                  />
                </td>
                <td className="text-[12px] text-ink-muted">
                  {count} CR{count === 1 ? '' : 's'}
                </td>
                <td className="text-center">
                  <button
                    className="rounded-lg px-2 py-1 text-[15px] text-ink-muted hover:bg-red-50 hover:text-red-600"
                    title={
                      count
                        ? `Remove — the ${count} CR${count === 1 ? '' : 's'} on this assignee go back to Unassigned`
                        : 'Remove this assignee'
                    }
                    onClick={() => {
                      if (
                        count &&
                        !confirm(
                          `${count} CR${count === 1 ? ' is' : 's are'} assigned to "${a.label}". Removing sets ${count === 1 ? 'it' : 'them'} back to Unassigned.`
                        )
                      )
                        return
                      update(removeAssignee(a.id))
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            )
          })}

          {!assignees.length && (
            <tr>
              <td colSpan={4} className="py-3 text-[12px] text-ink-muted">
                No extra assignees yet — unassigned CRs can only be given to the two standard parties.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ConfigCard>
  )
}
