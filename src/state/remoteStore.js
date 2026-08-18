import { TABLE, supabase } from '../lib/supabase'

/**
 * Shared persistence, entity by entity.
 *
 * The local app keeps one big state object, but writing that whole object on every
 * keystroke would mean two people editing different CRs overwrite each other. So
 * state is decomposed into entities — one per project, one per CR row, one per
 * global — and only the entities that actually changed are written.
 *
 * Same-entity concurrent edits are last-write-wins. Different-entity edits merge.
 */

/* ---------------- state <-> entities ---------------- */

/** currentProjectId is deliberately absent: which project you're looking at is personal. */
export function stateToEntities(state) {
  const entities = new Map()
  state.projects.forEach((p) => entities.set(`project:${p.id}`, { kind: 'project', id: p.id, data: p }))
  state.crData.forEach((r) => entities.set(`row:${r.recordId}`, { kind: 'row', id: r.recordId, data: r }))
  entities.set('global:categories', { kind: 'global', id: 'categories', data: { value: state.globalCategories } })
  entities.set('global:display', { kind: 'global', id: 'display', data: { value: state.display } })
  return entities
}

/** Rebuilds app state from whatever rows the table holds. */
export function entitiesToState(rows, fallback) {
  const projects = []
  const crData = []
  let globalCategories = null
  let display = null

  rows.forEach((row) => {
    if (row.kind === 'project') projects.push(row.data)
    else if (row.kind === 'row') crData.push(row.data)
    else if (row.kind === 'global' && row.id === 'categories') globalCategories = row.data?.value
    else if (row.kind === 'global' && row.id === 'display') display = row.data?.value
  })

  if (!projects.length) return null // empty workspace: let the caller seed it

  return {
    projects,
    crData,
    globalCategories: globalCategories?.length ? globalCategories : fallback.globalCategories,
    display: display || fallback.display,
    // Keep viewing whatever this person had selected, if it still exists.
    currentProjectId:
      fallback.currentProjectId === 'ALL' || projects.some((p) => p.id === fallback.currentProjectId)
        ? fallback.currentProjectId
        : projects[0].id,
  }
}

/* ---------------- reads ---------------- */

export async function fetchAll() {
  const { data, error } = await supabase.from(TABLE).select('kind,id,data')
  if (error) throw error
  return data || []
}

/* ---------------- writes ---------------- */

/**
 * Writes only what changed between two snapshots. `previous` is the last set of
 * entities we know the server has; returns the keys written so callers can ignore
 * the realtime echo of their own changes.
 */
export async function pushDiff(previous, next) {
  const upserts = []
  const deletes = []

  next.forEach((entity, key) => {
    const before = previous.get(key)
    // Cheap structural comparison: these objects are small and already JSON-safe.
    if (!before || JSON.stringify(before.data) !== JSON.stringify(entity.data)) upserts.push(entity)
  })

  previous.forEach((entity, key) => {
    if (!next.has(key)) deletes.push(entity)
  })

  if (upserts.length) {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        upserts.map((e) => ({ kind: e.kind, id: e.id, data: e.data, updated_at: new Date().toISOString() })),
        { onConflict: 'kind,id' }
      )
    if (error) throw error
  }

  // Deletes go one kind at a time; there are rarely many in a single change.
  for (const e of deletes) {
    const { error } = await supabase.from(TABLE).delete().eq('kind', e.kind).eq('id', e.id)
    if (error) throw error
  }

  return { written: upserts.length, removed: deletes.length }
}

/* ---------------- realtime ---------------- */

/**
 * Calls `onChange({ kind, id, data, deleted })` for every remote edit. Supabase
 * sends our own writes back too; the caller filters those out.
 */
export function subscribe(onChange) {
  const channel = supabase
    .channel('tracker_entities_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
      const record = payload.new && Object.keys(payload.new).length ? payload.new : payload.old
      if (!record) return
      onChange({
        kind: record.kind,
        id: record.id,
        data: record.data,
        deleted: payload.eventType === 'DELETE',
      })
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}

/** Folds a single remote entity change into a draft state. */
export function applyRemoteChange(draft, change) {
  const { kind, id, data, deleted } = change

  if (kind === 'project') {
    if (deleted) {
      draft.projects = draft.projects.filter((p) => p.id !== id)
      draft.crData = draft.crData.filter((r) => r.projectId !== id)
      if (!draft.projects.some((p) => p.id === draft.currentProjectId) && draft.currentProjectId !== 'ALL') {
        draft.currentProjectId = draft.projects[0]?.id ?? 'ALL'
      }
      return
    }
    const i = draft.projects.findIndex((p) => p.id === id)
    if (i >= 0) draft.projects[i] = data
    else draft.projects.push(data)
    return
  }

  if (kind === 'row') {
    if (deleted) {
      draft.crData = draft.crData.filter((r) => r.recordId !== id)
      return
    }
    const i = draft.crData.findIndex((r) => r.recordId === id)
    if (i >= 0) draft.crData[i] = data
    else draft.crData.push(data)
    return
  }

  if (kind === 'global' && !deleted) {
    if (id === 'categories') draft.globalCategories = data.value
    if (id === 'display') draft.display = data.value
  }
}
