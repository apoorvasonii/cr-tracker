/** Section wrapper for the Configure tab: title, optional blurb, body, footer action. */
export default function ConfigCard({ title, sub, action, children }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="card-title">{title}</h2>
          {sub && <p className="card-sub max-w-3xl">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
