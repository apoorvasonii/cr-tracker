const TABS = [
  { id: 'entry', label: 'Tracker' },
  { id: 'mail', label: 'Briefing' },
  { id: 'config', label: 'Configure' },
]

export default function Tabs({ tab, onChange }) {
  return (
    <nav className="flex gap-7 px-6">
      {TABS.map((t) => {
        const active = tab === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`-mb-px border-b-2 pb-3 pt-1 text-[14px] font-semibold transition-colors ${
              active ? 'border-brand-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink-soft'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
