"use client";
import { useState } from "react";
import { createClient } from "../lib/supabase-client";

export interface SyncRepo {
  id: string;
  repo_full_name: string;
}

function etagKey(repoId: string, resource: string) {
  return `strata-etag:${repoId}:${resource}`;
}

async function conditionalGet(url: string, key: string): Promise<{ fresh: false } | { fresh: true; data: unknown[] }> {
  const etag = localStorage.getItem(key);
  const res = await fetch(url, { headers: etag ? { "If-None-Match": etag } : {} });
  if (res.status === 304) return { fresh: false };
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  const next = res.headers.get("etag");
  if (next) localStorage.setItem(key, next);
  else localStorage.removeItem(key);
  return { fresh: true, data: (await res.json()) as unknown[] };
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={spinning ? "sync-spin" : undefined} style={{ display: "inline-flex" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

export function SyncButton({ repos }: { repos: SyncRepo[] }) {
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSync() {
    if (state === "syncing" || repos.length === 0) return;
    setState("syncing");
    setMessage(null);
    try {
      const supabase = createClient();
      for (const repo of repos) {
        const [owner, name] = repo.repo_full_name.split("/");
        if (!owner || !name) throw new Error(`Invalid repo name: ${repo.repo_full_name}`);
        const base = `https://api.github.com/repos/${owner}/${name}`;

        const commits = await conditionalGet(`${base}/commits?per_page=100`, etagKey(repo.id, "commits"));
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

        const pulls = await conditionalGet(`${base}/pulls?state=all&per_page=100`, etagKey(repo.id, "pulls"));
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

        const issues = await conditionalGet(`${base}/issues?state=all&per_page=100`, etagKey(repo.id, "issues"));
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
      setState("done");
      setMessage("Synced just now");
      window.location.reload();
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Sync failed");
    }
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button
        className="btn btn-secondary"
        onClick={onSync}
        disabled={state === "syncing" || repos.length === 0}
        title={repos.length === 0 ? "Link a repo to a project first" : "Pull latest GitHub activity"}
        style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
      >
        <RefreshIcon spinning={state === "syncing"} />
        {state === "syncing" ? "Syncing" : "Sync"}
      </button>
      {message && state !== "syncing" ? <span className="card-meta" style={{ marginTop: 0 }}>{message}</span> : null}
    </span>
  );
}
