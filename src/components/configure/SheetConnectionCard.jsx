import { useApp } from '../../state/AppContext'
import { patchProject } from '../../state/actions'
import { relativeSyncTime } from '../../lib/dates'
import ConfigCard from './ConfigCard'

export default function SheetConnectionCard({ onOpenConnect }) {
  const { currentProject, update, showToast, syncProject } = useApp()
  const stats = currentProject.lastSyncStats

  const syncNow = () => {
    showToast('Syncing ' + currentProject.lobName + '...')
    syncProject(currentProject.id).then((result) => {
      if (result.success) showToast(`Synced: ${result.recordsCreated} added, ${result.recordsUpdated} updated`)
      else showToast(`Sync failed: ${result.errors[0] || 'unknown error'}`, true)
    })
  }

  return (
    <ConfigCard
      title="Google Sheet Connection"
      sub='Must be shared as "Anyone with the link can view" — or an Apps Script Web App URL for private sheets.'
    >
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          className="field min-w-[280px] flex-1"
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={currentProject.googleSheetUrl}
          onChange={(e) => update(patchProject('googleSheetUrl', e.target.value))}
        />
        <select
          className="field-select"
          value={currentProject.sheetTabValue || ''}
          onChange={(e) => update(patchProject('sheetTabValue', e.target.value))}
        >
          <option value="">Tab: from link (or first)</option>
          {currentProject.sheetTabConfig.map((t) => (
            <option key={t.id} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button className="btn-primary" onClick={onOpenConnect}>
          Connect &amp; configure mapping
        </button>
        <button className="btn" onClick={syncNow}>
          ↻ Sync now
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-slate-50/60 p-3 text-[12.5px] text-ink-soft">
        {currentProject.syncStatus === 'failed' ? (
          <p className="font-semibold text-red-600">Sync failed: {currentProject.syncError || 'unknown error'}</p>
        ) : (
          <p className="text-ink-muted">{relativeSyncTime(currentProject.lastSyncedAt)}</p>
        )}

        {stats && (
          <>
            <p className="mt-1">
              Last sync: {stats.recordsFetched} fetched, {stats.recordsCreated} added, {stats.recordsUpdated} updated
            </p>
            {stats.warnings?.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer font-semibold text-amber-700">
                  {stats.warnings.length} warning{stats.warnings.length === 1 ? '' : 's'}
                </summary>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-ink-muted">
                  {stats.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </ConfigCard>
  )
}
