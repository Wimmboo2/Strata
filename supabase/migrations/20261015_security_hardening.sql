-- 2026-10-15 security hardening (additive only; safe to run on live data).
--
-- 1. install_states: single-use GitHub App setup tokens. RLS enabled with
--    NO policies, so only the service role can read/write (same pattern as
--    sync_state). Rows are never deleted so a page refresh after a completed
--    link can still report idempotent success.
create table if not exists install_states (
  token text primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);
alter table install_states enable row level security;

-- 2. webhook_deliveries: GitHub delivery idempotency log (service role only).
create table if not exists webhook_deliveries (
  delivery_id text primary key,
  status text not null check (status in ('processing', 'ok', 'failed')),
  received_at timestamptz not null default now()
);
alter table webhook_deliveries enable row level security;

-- 3. Provenance for activity rows. Existing rows default to 'manual', which is
--    the conservative label: only rows written through the verified backend
--    pipeline (service role) carry 'webhook' or 'api'.
alter table commits add column if not exists source text not null default 'manual'
  check (source in ('webhook', 'api', 'manual'));
alter table pull_requests add column if not exists source text not null default 'manual'
  check (source in ('webhook', 'api', 'manual'));
alter table issues add column if not exists source text not null default 'manual'
  check (source in ('webhook', 'api', 'manual'));

-- 4. Restrict browser (anon/authenticated) writes to manual rows only.
--    Verified rows can only ever be created by the service role, and no
--    browser write can flip a row's provenance in either direction.
drop policy if exists "commits_owner_write" on commits;
create policy "commits_owner_write" on commits
  for all using (
    source = 'manual' and exists (select 1 from project_repos join projects on projects.id = project_repos.project_id where project_repos.id = commits.project_repo_id and projects.owner_id = auth.uid())
  ) with check (
    source = 'manual' and exists (select 1 from project_repos join projects on projects.id = project_repos.project_id where project_repos.id = commits.project_repo_id and projects.owner_id = auth.uid())
  );
drop policy if exists "pull_requests_owner_write" on pull_requests;
create policy "pull_requests_owner_write" on pull_requests
  for all using (
    source = 'manual' and exists (select 1 from project_repos join projects on projects.id = project_repos.project_id where project_repos.id = pull_requests.project_repo_id and projects.owner_id = auth.uid())
  ) with check (
    source = 'manual' and exists (select 1 from project_repos join projects on projects.id = project_repos.project_id where project_repos.id = pull_requests.project_repo_id and projects.owner_id = auth.uid())
  );
drop policy if exists "issues_owner_write" on issues;
create policy "issues_owner_write" on issues
  for all using (
    source = 'manual' and exists (select 1 from project_repos join projects on projects.id = project_repos.project_id where project_repos.id = issues.project_repo_id and projects.owner_id = auth.uid())
  ) with check (
    source = 'manual' and exists (select 1 from project_repos join projects on projects.id = project_repos.project_id where project_repos.id = issues.project_repo_id and projects.owner_id = auth.uid())
  );
