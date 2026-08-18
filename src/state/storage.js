/**
 * Single abstraction over localStorage. Nothing else in the app touches
 * localStorage directly, so a future backend can replace load()/save() alone.
 */
const KEY = 'crTrackerApp.state.v1'
const BACKUP_KEY = 'crTrackerApp.state.v1.corrupt'

let cache = null
let writeTimer = null
let onWriteError = null

export const Store = {
  /** Called with an Error when a write fails (quota, private mode, …). */
  onError(handler) {
    onWriteError = handler
  },

  load() {
    if (cache) return cache
    let raw = null
    try {
      raw = localStorage.getItem(KEY)
      cache = raw ? JSON.parse(raw) : null
    } catch (err) {
      // Never let unreadable data be silently overwritten by a fresh state: keep a
      // copy under a backup key so it can be recovered by hand.
      cache = null
      if (raw) {
        try {
          localStorage.setItem(BACKUP_KEY, raw)
        } catch {
          /* nothing more we can do */
        }
      }
      onWriteError?.(
        new Error(
          'Saved data could not be read and has been set aside under "crTrackerApp.state.v1.corrupt". Starting fresh.'
        )
      )
    }
    return cache
  },

  /** Keeps the in-memory cache current immediately but defers the expensive
      stringify + write, so rapid calls (one per keystroke) collapse into one. */
  save(state) {
    cache = state
    clearTimeout(writeTimer)
    writeTimer = setTimeout(() => Store.flush(), 400)
  },

  flush() {
    clearTimeout(writeTimer)
    if (!cache) return true
    try {
      localStorage.setItem(KEY, JSON.stringify(cache))
      return true
    } catch (err) {
      // Storage full, or blocked (Safari private browsing). The app keeps working
      // from memory, but the user must know their changes aren't being persisted.
      onWriteError?.(
        new Error(
          err && err.name === 'QuotaExceededError'
            ? 'Browser storage is full — changes are NOT being saved. Delete an unused project, or export before closing this tab.'
            : 'Changes could not be saved to this browser.'
        )
      )
      return false
    }
  },
}

export function installStoreFlushHandlers() {
  window.addEventListener('beforeunload', () => Store.flush())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Store.flush()
  })
}
