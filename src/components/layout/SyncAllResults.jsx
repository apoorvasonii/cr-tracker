export default function SyncAllResults({ results, onDismiss }) {
  if (!results) return null

  return (
    <div className="card px-5 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="card-title">Sync All</h2>
        <button className="btn-ghost btn-sm" onClick={onDismiss}>
          Dismiss
        </button>
      </div>

      {results === 'pending' ? (
        <p className="text-[13px] text-ink-muted">Syncing projects…</p>
      ) : (
        <ul className="space-y-1.5 text-[13px]">
          {results.map(({ project, result }) => (
            <li key={project.id} className="flex items-start gap-2">
              <span className={result.success ? 'font-bold text-emerald-600' : 'font-bold text-red-600'}>
                {result.success ? '✓' : '✗'}
              </span>
              <span>
                <b className="font-semibold">{project.lobName}</b>{' '}
                {result.success ? (
                  <>
                    — {result.recordsCreated} added, {result.recordsUpdated} updated
                    {result.warnings.length > 0 && (
                      <span className="text-amber-700">
                        {' '}
                        ({result.warnings.length} warning{result.warnings.length === 1 ? '' : 's'})
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-red-600">— Failed: {result.errors[0] || 'unknown error'}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
