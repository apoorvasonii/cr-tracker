import { useApp } from '../../state/AppContext'
import { setOverallAgeUnit } from '../../state/actions'
import ConfigCard from './ConfigCard'

const UNITS = [
  { id: 'weeks', label: 'Weeks' },
  { id: 'days', label: 'Days' },
]

/** Per-project presentation choices — what the Briefing prints, not what it measures. */
export default function DisplayCard() {
  const { currentProject, update } = useApp()
  const unit = currentProject.overallAgeUnit ?? 'weeks'

  return (
    <ConfigCard
      title="Briefing Display"
      sub="How this project's Briefing presents its numbers."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-ink">Overall Age unit</div>
          <p className="card-sub max-w-2xl">
            How this project's Briefing and email express Overall Age. Ages are counted in business days either way;
            weeks simply divides by five and rounds.
          </p>
        </div>
        <div className="flex h-10 items-center gap-0.5 rounded-lg border border-line bg-slate-50 p-0.5">
          {UNITS.map((o) => (
            <button
              key={o.id}
              onClick={() => update(setOverallAgeUnit(o.id))}
              className={`h-8 rounded-md px-3 text-[12px] font-semibold transition-colors ${
                unit === o.id ? 'bg-white text-ink shadow-card' : 'text-ink-muted hover:text-ink-soft'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </ConfigCard>
  )
}
