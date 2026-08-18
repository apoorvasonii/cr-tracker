import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Store, installStoreFlushHandlers } from './storage'
import { loadInitialState } from './initialState'
import { getProjectById } from '../lib/model'
import { fetchSheetForProject } from '../lib/sheets'
import { applySyncToProject, recordSyncOutcome } from '../lib/sync'
import { isSharedMode } from '../lib/supabase'
import { applyRemoteChange, entitiesToState, fetchAll, pushDiff, stateToEntities, subscribe } from './remoteStore'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, setState] = useState(loadInitialState)
  const [toast, setToast] = useState(null) // { message, isError, key }
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

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError, key: Math.random() })
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
      if (!snapshot) {
        return Promise.resolve({
          success: false, projectId, recordsFetched: 0, recordsProcessed: 0,
          recordsCreated: 0, recordsUpdated: 0, warnings: [], errors: ['Project not found'],
        })
      }

      update((draft) => {
        const proj = getProjectById(draft.projects, projectId)
        if (proj) { proj.syncStatus = 'syncing'; proj.syncError = null }
      })

      return fetchSheetForProject(snapshot)
        .then(({ headers, rows }) =>
          update((draft) => {
            const proj = getProjectById(draft.projects, projectId)
            if (!proj) return null
            const result = applySyncToProject(draft.crData, proj, headers, rows)
            recordSyncOutcome(proj, result)
            return result
          })
        )
        .catch((err) => {
          const message = err && err.message ? err.message : String(err)
          const failed = {
            success: false, projectId, recordsFetched: 0, recordsProcessed: 0,
            recordsCreated: 0, recordsUpdated: 0, warnings: [], errors: [message],
          }
          update((draft) => {
            const proj = getProjectById(draft.projects, projectId)
            if (proj) recordSyncOutcome(proj, failed)
          })
          return failed
        })
    },
    [update]
  )

  const syncAllProjects = useCallback(
    () =>
      Promise.all(
        stateRef.current.projects.map((p) => syncProject(p.id).then((result) => ({ project: p, result })))
      ),
    [syncProject]
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

  const currentProject = useMemo(
    () => (state.currentProjectId === 'ALL' ? null : getProjectById(state.projects, state.currentProjectId)),
    [state.projects, state.currentProjectId]
  )

  const value = useMemo(
    () => ({
      state,
      currentProject,
      isAllProjects: state.currentProjectId === 'ALL',
      isSharedMode,
      remoteStatus,
      update,
      showToast,
      toast,
      syncProject,
      syncAllProjects,
      applyFetchedRows,
    }),
    [state, currentProject, remoteStatus, update, showToast, toast, syncProject, syncAllProjects, applyFetchedRows]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
