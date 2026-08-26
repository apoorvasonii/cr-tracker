import { useApp } from '../../state/AppContext'
import { addGlobalCategory, removeGlobalCategory, updateGlobalCategory } from '../../state/actions'
import ConfigCard from './ConfigCard'

export default function GlobalCategoriesTable() {
  const { state, update, showToast } = useApp()

  const usageCount = (cat) =>
    state.projects.reduce((sum, p) => sum + (p.statusConfig || []).filter((s) => s.category === cat.id).length, 0)

  const remove = (id) => {
    if (state.globalCategories.length <= 1) {
      showToast('You need at least one global category', true)
      return
    }
    update(removeGlobalCategory(id))
  }

  return (
    <ConfigCard
      title="Global Status Categories"
      sub="Shared across every project — each project's statuses map to one of these, which is what keeps the Overall Status tiles comparable between projects."
      action={
        <button className="btn btn-sm" onClick={() => update(addGlobalCategory())}>
          + Add category
        </button>
      }
    >
      <table className="cfg-table">
        <thead>
          <tr>
            <th style={{ width: '60%' }}>Category Label</th>
            <th style={{ width: '30%' }}>Usage</th>
            <th style={{ width: '10%' }} />
          </tr>
        </thead>
        <tbody>
          {state.globalCategories.map((c) => {
            const count = usageCount(c)
            return (
              <tr key={c.id}>
                <td>
                  <input
                    type="text"
                    className="field w-full font-semibold"
                    value={c.label}
                    onChange={(e) => update(updateGlobalCategory(c.id, e.target.value))}
                  />
                </td>
                <td className="text-[12px] text-ink-muted">
                  {count} status{count === 1 ? '' : 'es'} using it
                </td>
                <td className="text-center">
                  <button
                    className="rounded-lg px-2 py-1 text-[15px] text-ink-muted hover:bg-red-50 hover:text-red-600"
                    onClick={() => remove(c.id)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ConfigCard>
  )
}
