import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Store, installStoreFlushHandlers } from './storage'
import { loadInitialState } from './initialState'
import { getProjectById, isManualProject } from '../lib/model'
import { fetchSheetForProject } from '../lib/sheets'
import { applySyncToProject, previewSync, recordSyncOutcome } from '../lib/sync'
import SyncConfirmModal from '../components/modals/SyncConfirmModal'
import { isSharedMode } from '../lib/supabase'
import { applyRemoteChange, entitiesToState, fetchAll, pushDiff, stateToEntities, subscribe } from './remoteStore'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, setState] = useState(loadInitialState)
  const [toast, setToast] = useState(null) // { message, isError, key }
  // A fetched sync waiting on the user: { projectName, preview, apply, cancel }
  const [pendingSync, setPendingSync] = useState(null)
  // 'local' | 'connecting' | 'shared' | 'error' — surfaced in the header so nobody
  // edits for ten minutes believing their work is shared when it isn't.
  const [remoteStatus, setRemoteStatus] = useState(isSharedMode ? 'connecting' : 'local')

  // Entities we believe the server already has, so each save writes only diffs.
  const pushedRef = useRef(new Map())
  // Set while we apply a remote change, so it isn't echoed straight back.
  const applyingRemoteRef = useRef(false)

  // Every mutation goes through update(), so this ref is the authoritative
  // latest state — including within the same tick, before React re-renders.
  const stateRef = useRef(state)

  /**
   * Applies a recipe to a draft clone of the whole state and returns whatever
   * the recipe returned. Runs eagerly (not inside a setState updater) so callers
   * like syncProject can read the result synchronously, and so two updates in
   * one tick compose instead of clobbering each other.
   */
  const update = useCallback((recipe) => {
    const draft = structuredClone(stateRef.current)
    const out = recipe(draft)
    stateRef.current = draft
    setState(draft)
    return out
  }, [])

  // The most recent undo, also reachable with Ctrl/Cmd+Z until it's used or replaced.
  const lastUndoRef = useRef(null)

  /** `undo` (optional) puts an Undo button on the toast. */
  const showToast = useCallback((message, isError = false, undo = null) => {
    lastUndoRef.current = undo
    setToast({ message, isError, undo, key: Math.random() })
  }, [])

  /**
   * Runs a recipe and returns a function that reverts it. Only the project and
   * rows the recipe actually touched are put back, so in a shared workspace an
   * undo never rolls back someone else's edits to other rows.
   */
  const updateWithUndo = useCallback(
    (recipe) => {
      const before = stateRef.current
      const out = update(recipe)
      const after = stateRef.current

      const json = (x) => JSON.stringify(x)
      const afterProjects = new Map(after.projects.map((p) => [p.id, json(p)]))
      const touchedProjects = before.projects.filter((p) => afterProjects.get(p.id) !== json(p))
      const beforeRows = new Map(before.crData.map((r, i) => [r.recordId, { row: r, index: i }]))
      const afterRows = new Map(after.crData.map((r) => [r.recordId, json(r)]))
      const touchedRows = before.crData.filter((r) => afterRows.get(r.recordId) !== json(r))
      const addedIds = after.crData.filter((r) => !beforeRows.has(r.recordId)).map((r) => r.recordId)
      if (!touchedProjects.length && !touchedRows.length && !addedIds.length) return { out, undo: null }

      const undo = () => {
        if (lastUndoRef.current === undo) lastUndoRef.current = null
        update((draft) => {
          touchedProjects.forEach((old) => {
            const i = draft.projects.findIndex((p) => p.id === old.id)
            if (i >= 0) draft.projects[i] = structuredClone(old)
            else draft.projects.push(structuredClone(old))
          })
          draft.crData = draft.crData.filter((r) => !addedIds.includes(r.recordId))
          touchedRows.forEach((old) => {
            const i = draft.crData.findIndex((r) => r.recordId === old.recordId)
            if (i >= 0) draft.crData[i] = structuredClone(old)
            else draft.crData.splice(Math.min(beforeRows.get(old.recordId).index, draft.crData.length), 0, structuredClone(old))
          })
        })
      }
      return { out, undo }
    },
    [update]
  )

  /** Runs a recipe and toasts `message` with an Undo button. */
  const undoable = useCallback(
    (recipe, message) => {
      const { out, undo } = updateWithUndo(recipe)
      showToast(message, false, undo && (() => { undo(); showToast('Undone') }))
      return out
    },
    [updateWithUndo, showToast]
  )

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      // Inside a text field, Cmd+Z belongs to the field.
      const t = e.target
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      const undo = lastUndoRef.current
      if (!undo) return
      e.preventDefault()
      undo()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    installStoreFlushHandlers()
    // Storage failures used to be swallowed; surface them so nobody keeps working
    // in a tab that isn't persisting anything.
    Store.onError((err) => setToast({ message: err.message, isError: true, key: Math.random() }))
  }, [])

  // localStorage stays on in shared mode: it's the offline cache and the fallback
  // when Supabase is unreachable.
  useEffect(() => { Store.save(state) }, [state])

  /* ---------------- shared mode: initial load ---------------- */
  useEffect(() => {
    if (!isSharedMode) return
    let cancelled = false

    fetchAll()
      .then(async (rows) => {
        if (cancelled) return
        const remote = entitiesToState(rows, stateRef.current)

        if (remote) {
          // Adopt the shared workspace.
          stateRef.current = remote
          setState(remote)
          pushedRef.current = stateToEntities(remote)
        } else {
          // Empty workspace — seed it from whatever this browser already had.
          const seeded = stateToEntities(stateRef.current)
          await pushDiff(new Map(), seeded)
          pushedRef.current = seeded
        }
        setRemoteStatus('shared')
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Shared storage unavailable:', err)
        setRemoteStatus('error')
        setToast({
          message: 'Shared storage unreachable — working from this browser only. Changes will not be shared.',
          isError: true,
          key: Math.random(),
        })
      })

    return () => { cancelled = true }
  }, [])

  /* ---------------- shared mode: push local changes ---------------- */
  useEffect(() => {
    if (!isSharedMode || remoteStatus !== 'shared') return
    if (applyingRemoteRef.current) return // don't bounce a remote change back

    // Debounced so a burst of keystrokes becomes one write, matching Store.save.
    const timer = setTimeout(() => {
      const next = stateToEntities(state)
      pushDiff(pushedRef.current, next)
        .then(() => { pushedRef.current = next })
        .catch((err) => {
          console.error('Shared save failed:', err)
          setToast({ message: 'A change could not be saved to shared storage.', isError: true, key: Math.random() })
        })
    }, 500)

    return () => clearTimeout(timer)
  }, [state, remoteStatus])

  /* ---------------- shared mode: receive others' changes ---------------- */
  useEffect(() => {
    if (!isSharedMode || remoteStatus !== 'shared') return

    return subscribe((change) => {
      const key = `${change.kind}:${change.id}`
      const known = pushedRef.current.get(key)
      // Ignore the echo of our own write.
      if (!change.deleted && known && JSON.stringify(known.data) === JSON.stringify(change.data)) return

      applyingRemoteRef.current = true
      update((draft) => applyRemoteChange(draft, change))
      // Record it as already-synced so the push effect doesn't rewrite it.
      if (change.deleted) pushedRef.current.delete(key)
      else pushedRef.current.set(key, { kind: change.kind, id: change.id, data: change.data })
      applyingRemoteRef.current = false
    })
  }, [remoteStatus, update])

  /**
   * Fetch happens outside the state update (it's async and can fail); only the
   * result is folded in. Never mutates crData in place — `update` clones first.
   */
  const syncProject = useCallback(
    (projectId) => {
      const snapshot = getProjectById(stateRef.current.projects, projectId)
      if (isManualProject(snapshot)) {
        // Nothing to pull: this project's rows only ever come from the tracker.
        return Promise.resolve({
          success: false, projectId, skipped: true, recordsFetched: 0, recordsProcessed: 0,
          recordsCreated: 0, recordsUpdated: 0, recordsRemoved: 0, warnings: [],
          errors: ['This is a tracker-only project — it has no Google Sheet to sync.'],
        })
      }
      if (!snapshot) {
        return Promise.resolve({
          success: false, projectId, recordsFetched: 0, recordsProcessed: 0,
          recordsCreated: 0, recordsUpdated: 0, recordsRemoved: 0, warnings: [], errors: ['Project not found'],
        })
      }

      const priorStatus = { syncStatus: snapshot.syncStatus, syncError: snapshot.syncError }
      update((draft) => {
        const proj = getProjectById(draft.projects, projectId)
        if (proj) { proj.syncStatus = 'syncing'; proj.syncError = null }
      })

      // A confirmed sync can be undone: the result carries `undo` for the caller's toast.
      const apply = (headers, rows) => {
        const { out, undo } = updateWithUndo((draft) => {
          const proj = getProjectById(draft.projects, projectId)
          if (!proj) return null
          const result = applySyncToProject(draft.crData, proj, headers, rows)
          recordSyncOutcome(proj, result)
          return result
        })
        return out && undo ? { ...out, undo } : out
      }

      return fetchSheetForProject(snapshot)
        .then(({ headers, rows }) => {
          // Dry-run first. A sync that would remove, add or change rows on the
          // tracker waits for the user to confirm; a no-op or failed one applies.
          const current = stateRef.current
          const proj = getProjectById(current.projects, projectId)
          if (!proj) return apply(headers, rows)
          const preview = previewSync(current.crData, proj, headers, rows)
          const { added, removed, changed } = preview
          if (!preview.result.success || !(added.length || removed.length || changed.length)) {
            return apply(headers, rows)
          }
          return new Promise((resolve) => {
            setPendingSync({
              projectName: proj.lobName,
              preview,
              apply: () => {
                setPendingSync(null)
                resolve(apply(headers, rows))
              },
              cancel: () => {
                setPendingSync(null)
                update((draft) => {
                  const p = getProjectById(draft.projects, projectId)
                  if (p) Object.assign(p, priorStatus)
                })
                resolve({ ...preview.result, success: false, cancelled: true, errors: ['Sync cancelled — nothing was changed.'] })
              },
            })
          })
        })
        .catch((err) => {
          const message = err && err.message ? err.message : String(err)
          const failed = {
            success: false, projectId, recordsFetched: 0, recordsProcessed: 0,
            recordsCreated: 0, recordsUpdated: 0, recordsRemoved: 0, warnings: [], errors: [message],
          }
          update((draft) => {
            const proj = getProjectById(draft.projects, projectId)
            if (proj) recordSyncOutcome(proj, failed)
          })
          return failed
        })
    },
    [update, updateWithUndo]
  )

  /** Applies rows already fetched by the Connect wizard, with no second request. */
  const applyFetchedRows = useCallback(
    (projectId, headers, rows) =>
      update((draft) => {
        const proj = getProjectById(draft.projects, projectId)
        if (!proj) return null
        const result = applySyncToProject(draft.crData, proj, headers, rows)
        recordSyncOutcome(proj, result)
        return result
      }),
    [update]
  )

  // The app always looks at exactly one project; if the selected id no longer
  // exists (deleted elsewhere, or an old saved selection), fall back to the first.
  const currentProject = useMemo(
    () => getProjectById(state.projects, state.currentProjectId) || state.projects[0] || null,
    [state.projects, state.currentProjectId]
  )

  const value = useMemo(
    () => ({
      state,
      currentProject,
      isSharedMode,
      remoteStatus,
      update,
      showToast,
      undoable,
      toast,
      syncProject,
      applyFetchedRows,
    }),
    [state, currentProject, remoteStatus, update, showToast, undoable, toast, syncProject, applyFetchedRows]
  )

  return (
    <AppContext.Provider value={value}>
      {children}
      <SyncConfirmModal
        pending={pendingSync}
        onConfirm={() => pendingSync.apply()}
        onCancel={() => pendingSync.cancel()}
      />
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
