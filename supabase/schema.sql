-- CR Tracker shared storage.
--
-- One row per entity rather than one row for the whole tracker: two people editing
-- different CRs (or different projects) then write different rows and never clobber
-- each other. Same-entity edits are still last-write-wins, which is expected.
--
-- Run this once in Supabase → SQL Editor.

create table if not exists tracker_entities (
  kind        text        not null,           -- 'project' | 'row' | 'global'
  id          text        not null,           -- project id, CR recordId, or global key
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  primary key (kind, id)
);

-- Rows are queried per project when a project is deleted.
create index if not exists tracker_entities_project_idx
  on tracker_entities ((data->>'projectId'))
  where kind = 'row';

alter table tracker_entities enable row level security;

-- "Anyone with the link can edit": the anon key is public in a browser app, so this
-- policy is the access model. Tighten it (or add Supabase Auth) if that changes.
drop policy if exists tracker_entities_anon_all on tracker_entities;
create policy tracker_entities_anon_all
  on tracker_entities for all
  to anon
  using (true)
  with check (true);

-- Broadcast changes to every open tab so edits appear without a refresh.
alter publication supabase_realtime add table tracker_entities;
