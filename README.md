# CR Tracker

React port of `CR_Tracker_App-4.html`. Multiple projects in one hosted site, each
pulling its CR rows from its own Google Sheet, with a Configure surface, an
editable tracker, and a copy-to-email briefing.

## Run

```bash
npm install
npm run dev
```

No API keys. Sheets are read client-side via the public gviz/CSV endpoint, so a
sheet must be shared as "Anyone with the link can view" — or exposed through an
Apps Script Web App URL, which the fetch layer detects and handles.

## Structure

```
src/
├── App.jsx                    project bar + tabs + the three views
├── state/
│   ├── AppContext.jsx         the single store, update(), sync orchestration
│   ├── actions.js             every mutation, as a recipe over a draft state
│   ├── initialState.js        persisted-state load, migration, first-run seed
│   └── storage.js             the only localStorage caller
├── lib/
│   ├── model.js               project/record shapes, status + meta lookups
│   ├── sync.js                mapping -> normalize -> upsert (override-aware)
│   ├── sheets.js              the only code that talks to Google
│   ├── briefing.js            briefing aggregation, shared by preview + email
│   ├── emailHtml.js           table-based HTML for "Copy for Email"
│   ├── dates.js               business-day ages, sync timestamps
│   ├── colors.js  strings.js
├── views/                     ConfigureView, TrackerView, BriefingView
├── components/
│   ├── layout/  configure/  tracker/  briefing/  modals/  ui/
└── styles/app.css             the original stylesheet, class names unchanged
```

## How state works

One state object — `{ projects, currentProjectId, globalCategories, crData }` —
lives in `AppContext`. Nothing mutates it directly. Every change is a *recipe*
in `state/actions.js`:

```js
export const patchProject = (field, value) =>
  withCurrentProject((proj) => { proj[field] = value })

update(patchProject('lobName', 'Acme Foods'))   // from a component
```

`update()` clones the state, runs the recipe against the clone, and swaps it in.
That keeps the ported mutation-style logic readable while React still sees a new
object each time. It also runs eagerly rather than inside a `setState` updater,
so `syncProject` can read its result synchronously and two updates in one tick
compose instead of clobbering each other.

Persistence is a single effect: state changes → `Store.save` (debounced 400ms,
flushed on unload).

## Behaviour worth knowing

- **Record identity** is `projectId + sourceRecordId`, never CR name. Without a
  mapped Unique ID column it falls back to a hash of Feature/Status/Planned End
  Date — stable against row reordering, and it warns when two rows collide.
- **Manual edits win.** Editing a field marks it overridden, and sync will not
  overwrite it; the ↻ button on a row reverts to the last synced sheet values.
- **Ages are derived**, never stored: business days from BRD Date / Moved to
  Current Status, weekends excluded, falling back to whatever text is there.
- **All Projects** is read-only and aggregates via global status categories,
  since two projects can use completely different status vocabularies.

## Styling

`styles/app.css` is the original stylesheet, ported as-is so the app looks
identical; Tailwind is configured and available for new markup.

## Shared mode (multiple people, one tracker)

Without configuration the tracker saves to **one browser only** — Vercel serves
static files and stores nothing. Set two env vars and it switches to a shared
Supabase workspace instead, with live updates between everyone who has the link.

### Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste and run [`supabase/schema.sql`](supabase/schema.sql).
3. **Project Settings → API** → copy the Project URL and the `anon` public key.
4. Locally, put them in `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. On Vercel, add the same two under **Settings → Environment Variables**, then
   redeploy. `VITE_` vars are baked in at build time, so a redeploy is required —
   changing them without rebuilding has no effect.

The header shows where data is going: **Shared** (green), **Connecting…**,
**Not shared** (red — Supabase unreachable, edits staying local), or **This browser**
(no env vars configured).

### How concurrent editing works

State is decomposed into entities — one row per project, one per CR, one per global
setting — and only entities that actually changed are written ([`remoteStore.js`](src/state/remoteStore.js)):

| Two people edit… | Result |
|---|---|
| Different CRs, or different projects | Both edits survive; each appears live for the other |
| The same field of the same CR | Last write wins |

A project deletion removes its rows for everyone. `currentProjectId` is deliberately
**not** shared, so people can look at different clients simultaneously.

localStorage stays active as an offline cache: if Supabase is unreachable the app keeps
working from the last known state and warns that changes aren't being shared.

### Access

The schema's RLS policy grants the `anon` role full read/write — that is the
"anyone with the link can edit" model, and the anon key is public in any browser app.
Anyone with your URL can read and change every client's CR data. To put a door in
front of it, enable **Vercel → Settings → Deployment Protection**; for per-person
accounts, swap the policy for Supabase Auth.


## Deploy

`npm run build` → `dist/`. `vercel.json` covers SPA rewrites.
