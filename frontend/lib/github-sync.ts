"use client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SyncRepo {
  id: string;
  repo_full_name: string;
}

function etagKey(repoId: string, resource: string) {
  return "strata-etag:" + repoId + ":" + resource;
}

export async function conditionalGet(url: string, key: string): Promise<{ fresh: false } | { fresh: true; data: unknown[] }> {
  const etag = localStorage.getItem(key);
  const res = await fetch(url, { headers: etag ? { "If-None-Match": etag } : {} });
  if (res.status === 304) return { fresh: false };
  if (!res.ok) throw new Error("GitHub responded " + res.status);
  const next = res.headers.get("etag");
  if (next) localStorage.setItem(key, next);
  else localStorage.removeItem(key);
  return { fresh: true, data: (await res.json()) as unknown[] };
}

export async function syncRepoActivity(supabase: SupabaseClient, repo: SyncRepo): Promise<void> {
  const [owner, name] = repo.repo_full_name.split("/");
  if (!owner || !name) throw new Error("Invalid repo name: " + repo.repo_full_name);
  const base = "https://api.github.com/repos/" + owner + "/" + name;

  const commits = await conditionalGet(base + "/commits?per_page=100", etagKey(repo.id, "commits"));
  if (commits.fresh) {
    for (const c of commits.data.slice(0, 100) as Record<string, any>[]) {
      const { error } = await supabase.from("commits").upsert(
        {
          project_repo_id: repo.id,
          github_sha: c.sha,
          message: c.commit?.message ?? "",
          author_login: c.author?.login ?? null,
          url: c.html_url,
          committed_at: c.commit?.author?.date ?? new Date().toISOString()
        },
        { onConflict: "project_repo_id,github_sha" }
      );
      if (error) throw error;
    }
  }

  const pulls = await conditionalGet(base + "/pulls?state=all&per_page=100", etagKey(repo.id, "pulls"));
  if (pulls.fresh) {
    for (const p of pulls.data.slice(0, 100) as Record<string, any>[]) {
      const { error } = await supabase.from("pull_requests").upsert(
        {
          project_repo_id: repo.id,
          github_number: p.number,
          title: p.title,
          state: p.merged_at ? "merged" : p.state,
          author_login: p.user?.login ?? null,
          url: p.html_url,
          updated_at_github: p.updated_at
        },
        { onConflict: "project_repo_id,github_number" }
      );
      if (error) throw error;
    }
  }

  const issues = await conditionalGet(base + "/issues?state=all&per_page=100", etagKey(repo.id, "issues"));
  if (issues.fresh) {
    const onlyIssues = (issues.data as Record<string, any>[]).filter((i) => !i.pull_request).slice(0, 100);
    for (const i of onlyIssues) {
      const { error } = await supabase.from("issues").upsert(
        {
          project_repo_id: repo.id,
          github_number: i.number,
          title: i.title,
          state: i.state,
          author_login: i.user?.login ?? null,
          url: i.html_url,
          updated_at_github: i.updated_at
        },
        { onConflict: "project_repo_id,github_number" }
      );
      if (error) throw error;
    }
  }
}

export async function importProfileRepos(supabase: SupabaseClient, userId: string, opts?: { force?: boolean }): Promise<number> {
  const { data: profile } = await supabase.from("profiles").select("github_username").eq("id", userId).single();
  const username = (profile?.github_username as string | null) ?? null;
  if (!username) return 0;

  const url = "https://api.github.com/users/" + encodeURIComponent(username) + "/repos?per_page=100&sort=updated";
  const listKey = "strata-repolist:v2:" + username;
  let fresh: Record<string, any>[] | null = null;

  if (opts?.force) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("GitHub responded " + res.status);
    const etag = res.headers.get("etag");
    if (etag) localStorage.setItem(listKey, etag);
    fresh = (await res.json()) as Record<string, any>[];
  } else {
    const result = await conditionalGet(url, listKey);
    if (!result.fresh) return 0;
    fresh = result.data as Record<string, any>[];
  }

  const repos = fresh.filter((r) => r && typeof r.full_name === "string");
  if (repos.length === 0) return 0;

  const { data: myProjects } = await supabase.from("projects").select("id").eq("owner_id", userId);
  const projectIds = (myProjects ?? []).map((p) => p.id);
  const existing = new Map<string, { id: string; pushed_at: string | null }>();
  if (projectIds.length > 0) {
    const { data: repoRows } = await supabase.from("project_repos").select("id,repo_full_name,pushed_at").in("project_id", projectIds);
    for (const row of repoRows ?? []) {
      existing.set(String(row.repo_full_name).toLowerCase(), { id: row.id as string, pushed_at: (row.pushed_at as string | null) ?? null });
    }
  }

  let added = 0;
  for (const r of repos) {
    const fullName = String(r.full_name).toLowerCase();
    const pushedAt = typeof r.pushed_at === "string" ? r.pushed_at : null;
    const known = existing.get(fullName);
    if (known) {
      if (pushedAt && pushedAt !== known.pushed_at) {
        await supabase.from("project_repos").update({ pushed_at: pushedAt }).eq("id", known.id);
      }
      continue;
    }
    const { data: created, error } = await supabase
      .from("projects")
      .insert({
        owner_id: userId,
        name: typeof r.name === "string" && r.name ? r.name : fullName,
        description: typeof r.description === "string" ? r.description : "",
        status: "building"
      })
      .select()
      .single();
    if (error || !created) continue;
    const { error: linkError } = await supabase.from("project_repos").insert({ project_id: created.id, repo_full_name: fullName, pushed_at: pushedAt });
    if (linkError) {
      await supabase.from("projects").delete().eq("id", created.id);
      continue;
    }
    added++;
  }
  return added;
}
