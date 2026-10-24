import crypto from "node:crypto";
import { getAdminClient } from "../lib/supabase-admin";
import { isValidRepoFullName, normalizeRepoFullName } from "../lib/urls";
import { syncRepo, type ProjectRepoRow } from "./repo-sync";
import { repoVisibility, tokenForOwner } from "./token";

export type SyncJobState = "running" | "done" | "error";

export interface SyncJob {
  id: string;
  userId: string;
  state: SyncJobState;
  startedAt: number;
  finishedAt: number | null;
  repos: number;
  synced: number;
  skipped: number;
  error: string | null;
}

/**
 * Job registry for user-triggered syncs.
 *
 * Lives in memory on purpose: a job lasts seconds, the backend runs as a
 * single instance on Render, and nothing durable needs to survive a
 * restart. If the process is recycled mid-job the status endpoint reports
 * the job as unknown, and the client treats that as "finished, refresh".
 */
const jobs = new Map<string, SyncJob>();
const JOB_TTL_MS = 10 * 60 * 1000;
const MAX_JOBS = 200;

function pruneJobs(now: number): void {
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt > JOB_TTL_MS) jobs.delete(id);
  }
  while (jobs.size > MAX_JOBS) {
    const oldest = jobs.keys().next();
    if (oldest.done) break;
    jobs.delete(oldest.value);
  }
}

export function getJob(id: string): SyncJob | undefined {
  return jobs.get(id);
}

/**
 * Resolve which repos a user is allowed to sync.
 *
 * The requested ids are only ever used as a filter: the set is intersected
 * with the repos that actually belong to the caller's own projects, so a
 * caller cannot ask the backend to touch someone else's repo.
 */
async function resolveRepos(userId: string, requestedIds: string[] | null): Promise<ProjectRepoRow[]> {
  const supabase = getAdminClient();

  // Two plain queries instead of an embedded join: the ownership rule is
  // then explicit and does not depend on PostgREST resolving the FK.
  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("owner_id", userId);
  if (projectError) throw projectError;

  const projectIds = (projects ?? []).map((p) => p.id as string);
  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from("project_repos")
    .select("id,repo_full_name")
    .in("project_id", projectIds);
  if (error) throw error;

  let rows = (data ?? []) as unknown as ProjectRepoRow[];
  if (requestedIds && requestedIds.length > 0) {
    const wanted = new Set(requestedIds);
    rows = rows.filter((r) => wanted.has(r.id));
  }
  return rows.filter((r) => isValidRepoFullName(r.repo_full_name));
}

async function runJob(job: SyncJob, requestedIds: string[] | null): Promise<void> {
  const now = () => Date.now();
  try {
    const repos = await resolveRepos(job.userId, requestedIds);
    job.repos = repos.length;

    for (const repo of repos) {
      const [owner, name] = normalizeRepoFullName(repo.repo_full_name).split("/");
      const token = await tokenForOwner(owner);
      const visibility = await repoVisibility(owner, name, token);
      if (visibility !== "public") {
        // Never ingest a repo we cannot prove is public.
        job.skipped += 1;
        continue;
      }
      try {
        await syncRepo(repo, token);
        job.synced += 1;
      } catch (err) {
        console.error(`Sync failed for ${repo.repo_full_name}`, err);
      }
    }

    job.state = "done";
    job.finishedAt = now();
  } catch (err) {
    console.error("user sync job failed", err);
    job.state = "error";
    job.error = err instanceof Error ? err.message : "sync failed";
    job.finishedAt = now();
  }
}

/**
 * Start a background sync for a user and return the job handle.
 *
 * The work happens after the HTTP response is sent: a sync of many repos
 * takes far longer than a proxy is willing to wait, and the client polls
 * /sync/status instead.
 */
export function startUserSync(userId: string, requestedIds: string[] | null): SyncJob {
  const now = Date.now();
  pruneJobs(now);
  const job: SyncJob = {
    id: crypto.randomBytes(16).toString("hex"),
    userId,
    state: "running",
    startedAt: now,
    finishedAt: null,
    repos: 0,
    synced: 0,
    skipped: 0,
    error: null
  };
  jobs.set(job.id, job);
  setImmediate(() => {
    void runJob(job, requestedIds);
  });
  return job;
}
