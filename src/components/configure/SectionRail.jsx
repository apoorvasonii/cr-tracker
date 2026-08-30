/**
 * Section navigation for the Configure tab. Configure is a "go to one thing and
 * change it" surface, so only the chosen section is rendered — the alternative
 * was one column tall enough that Flags and Global Categories sat off-screen.
 *
 * On narrow screens the rail becomes a horizontally scrolling strip of pills
 * rather than a stack, so it never eats the height it was meant to save.
 */
export default function SectionRail({ sections, active, onChange }) {
  return (
    <nav
      className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:w-[188px] md:flex-col
                 md:overflow-visible md:px-0 md:pb-0"
    >
      {sections.map((s) => {
        const isActive = s.id === active
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            title={s.warning || undefined}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px]
                        font-semibold transition-colors md:w-full ${
                          isActive
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-ink-muted hover:bg-slate-50 hover:text-ink-soft'
                        }`}
          >
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            {/* Something needs attention in there — an unmapped column, a status
                the sheet uses that this project hasn't placed, a failed sync. */}
            {s.warning && <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-amber-500" />}
            {s.badge != null && (
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums ${
                  isActive ? 'bg-white/70 text-brand-700' : 'bg-slate-100 text-ink-muted'
                }`}
              >
                {s.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
