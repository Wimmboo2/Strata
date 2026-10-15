-- 2026-10-15: reads require login. Previously all *_public_read policies
-- allowed anonymous SELECT; now only authenticated users (auth.uid() not
-- null) can read. Owner-write policies unchanged. Applied live via
-- apply_migration as "require_login_for_reads".
drop policy if exists "profiles_public_read" on profiles;
create policy "profiles_public_read" on profiles
  for select using (auth.uid() is not null);
drop policy if exists "projects_public_read" on projects;
create policy "projects_public_read" on projects
  for select using (auth.uid() is not null);
drop policy if exists "labels_public_read" on labels;
create policy "labels_public_read" on labels
  for select using (auth.uid() is not null);
drop policy if exists "project_repos_public_read" on project_repos;
create policy "project_repos_public_read" on project_repos
  for select using (auth.uid() is not null);
drop policy if exists "commits_public_read" on commits;
create policy "commits_public_read" on commits
  for select using (auth.uid() is not null);
drop policy if exists "pull_requests_public_read" on pull_requests;
create policy "pull_requests_public_read" on pull_requests
  for select using (auth.uid() is not null);
drop policy if exists "issues_public_read" on issues;
create policy "issues_public_read" on issues
  for select using (auth.uid() is not null);
