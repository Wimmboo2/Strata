-- Strata v1 schema. Run in Supabase SQL editor.
-- Auth users live in auth.users. Public profile data lives in profiles.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  github_profile_url text not null,
  github_username text,
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text default '',
  status text not null check (status in ('building','finished','paused')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  unique (project_id, name)
);

create table if not exists project_repos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  repo_full_name text not null,
  installation_id bigint,
  created_at timestamptz default now(),
  unique (project_id, repo_full_name)
);

create table if not exists commits (
  id uuid primary key default gen_random_uuid(),
  project_repo_id uuid not null references project_repos(id) on delete cascade,
  github_sha text not null,
  message text not null,
  author_login text,
  url text not null,
  committed_at timestamptz not null,
  unique (project_repo_id, github_sha)
);

create table if not exists pull_requests (
  id uuid primary key default gen_random_uuid(),
  project_repo_id uuid not null references project_repos(id) on delete cascade,
  github_number int not null,
  title text not null,
  state text not null,
  author_login text,
  url text not null,
  updated_at_github timestamptz not null,
  unique (project_repo_id, github_number)
);

create table if not exists issues (
  id uuid primary key default gen_random_uuid(),
  project_repo_id uuid not null references project_repos(id) on delete cascade,
  github_number int not null,
  title text not null,
  state text not null,
  author_login text,
  url text not null,
  updated_at_github timestamptz not null,
  unique (project_repo_id, github_number)
);

create table if not exists github_installations (
  installation_id bigint primary key,
  github_account_login text not null,
  owner_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists sync_state (
  project_repo_id uuid not null references project_repos(id) on delete cascade,
  resource text not null check (resource in ('commits','pulls','issues')),
  last_etag text,
  last_synced_at timestamptz,
  primary key (project_repo_id, resource)
);

-- Row Level Security
alter table profiles enable row level security;
alter table projects enable row level security;
alter table labels enable row level security;
alter table project_repos enable row level security;
alter table commits enable row level security;
alter table pull_requests enable row level security;
alter table issues enable row level security;
alter table github_installations enable row level security;
alter table sync_state enable row level security;

-- profiles: owner read/write, public read for browsing
drop policy if exists "profiles_owner_write" on profiles;
create policy "profiles_owner_write" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_public_read" on profiles;
create policy "profiles_public_read" on profiles
  for select using (true);

-- projects: owner write, public read
drop policy if exists "projects_owner_write" on projects;
create policy "projects_owner_write" on projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "projects_public_read" on projects;
create policy "projects_public_read" on projects
  for select using (true);

-- labels: write via parent ownership, public read
drop policy if exists "labels_owner_write" on labels;
create policy "labels_owner_write" on labels
  for all using (
    exists (select 1 from projects where projects.id = labels.project_id and projects.owner_id = auth.uid())
  ) with check (
    exists (select 1 from projects where projects.id = labels.project_id and projects.owner_id = auth.uid())
  );
drop policy if exists "labels_public_read" on labels;
create policy "labels_public_read" on labels
  for select using (true);

-- project_repos: write via parent ownership, public read
drop policy if exists "project_repos_owner_write" on project_repos;
create policy "project_repos_owner_write" on project_repos
  for all using (
    exists (select 1 from projects where projects.id = project_repos.project_id and projects.owner_id = auth.uid())
  ) with check (
    exists (select 1 from projects where projects.id = project_repos.project_id and projects.owner_id = auth.uid())
  );
drop policy if exists "project_repos_public_read" on project_repos;
create policy "project_repos_public_read" on project_repos
  for select using (true);

-- activity tables: public read only; owner writes go through the *_owner_write policies below (used by the dashboard Sync button)
drop policy if exists "commits_public_read" on commits;
create policy "commits_public_read" on commits for select using (true);
drop policy if exists "pull_requests_public_read" on pull_requests;
create policy "pull_requests_public_read" on pull_requests for select using (true);
drop policy if exists "issues_public_read" on issues;
create policy "issues_public_read" on issues for select using (true);

-- github_installations: owner only, no public read
drop policy if exists "installations_owner_all" on github_installations;
create policy "installations_owner_all" on github_installations
  for all using (auth.uid() = owner_profile_id) with check (auth.uid() = owner_profile_id);

-- sync_state: no user access, service role only (no policies for anon/authenticated)
