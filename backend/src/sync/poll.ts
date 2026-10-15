import "dotenv/config";
import { getAdminClient } from "../lib/supabase-admin";
import { isValidRepoFullName, normalizeRepoFullName, safeGithubUrl } from "../lib/urls";
import { conditionalRequest } from "./github-client";

interface ProjectRepoRow {
  id: string;
  repo_full_name: string;
}

interface GithubCommit {
  sha: string;
  commit: { message: string; author?: { date?: string } };
  author?: { login?: string } | null;
  html_url: string;
}

interface GithubPull {
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  user?: { login?: string } | null;
  html_url: string;
  updated_at: string;
}

interface GithubIssue {
  number: number;
  title: string;
  state: string;
  user?: { login?: string } | null;
  html_url: string;
  updated_at: string;
  pull_request?: unknown;
}

async function getEtag(repoId: string, resource: string): Promise<string | null> {
  const supabase = getAdminClient();
  const { data } = await supabase.from("sync_state").select("*").eq("project_repo_id", repoId).eq("resource", resource).single();
  return (data?.last_etag as string | null) ?? null;
}

async function setEtag(repoId: string, resource: string, etag: string | null) {
  const supabase = getAdminClient();
  await supabase.from("sync_state").upsert(
    { project_repo_id: repoId, resource, last_etag: etag, last_synced_at: new Date().toISOString() },
    { onConflict: "project_repo_id,resource" }
  );
}

async function syncRepo(repo: ProjectRepoRow) {
  const supabase = getAdminClient();
  if (!isValidRepoFullName(repo.repo_full_name)) return;
  const [owner, name] = normalizeRepoFullName(repo.repo_full_name).split("/");

  const commitsRes = await conditionalRequest<GithubCommit[]>(
    `/repos/${owner}/${name}/commits`,
    await getEtag(repo.id, "commits")
  );
  if (commitsRes.status === 200 && commitsRes.data) {
    for (const c of commitsRes.data.slice(0, 100)) {
      const url = safeGithubUrl(c.html_url);
      if (!url) continue;
      await supabase.from("commits").upsert(
        {
          project_repo_id: repo.id,
          github_sha: c.sha,
          message: c.commit.message,
          author_login: c.author?.login ?? null,
          url,
          committed_at: c.commit.author?.date ?? new Date().toISOString(),
          source: "api"
        },
        { onConflict: "project_repo_id,github_sha" }
      );
    }
    await setEtag(repo.id, "commits", commitsRes.etag);
  } else {
    await setEtag(repo.id, "commits", commitsRes.etag);
  }

  const pullsRes = await conditionalRequest<GithubPull[]>(
    `/repos/${owner}/${name}/pulls?state=all`,
    await getEtag(repo.id, "pulls")
  );
  if (pullsRes.status === 200 && pullsRes.data) {
    for (const p of pullsRes.data.slice(0, 100)) {
      const url = safeGithubUrl(p.html_url);
      if (!url) continue;
      await supabase.from("pull_requests").upsert(
        {
          project_repo_id: repo.id,
          github_number: p.number,
          title: p.title,
          state: p.merged_at ? "merged" : p.state,
          author_login: p.user?.login ?? null,
          url,
          updated_at_github: p.updated_at,
          source: "api"
        },
        { onConflict: "project_repo_id,github_number" }
      );
    }
    await setEtag(repo.id, "pulls", pullsRes.etag);
  } else {
    await setEtag(repo.id, "pulls", pullsRes.etag);
  }

  const issuesRes = await conditionalRequest<GithubIssue[]>(
    `/repos/${owner}/${name}/issues?state=all`,
    await getEtag(repo.id, "issues")
  );
  if (issuesRes.status === 200 && issuesRes.data) {
    for (const i of issuesRes.data.slice(0, 100)) {
      if (i.pull_request) continue;
      const url = safeGithubUrl(i.html_url);
      if (!url) continue;
      await supabase.from("issues").upsert(
        {
          project_repo_id: repo.id,
          github_number: i.number,
          title: i.title,
          state: i.state,
          author_login: i.user?.login ?? null,
          url,
          updated_at_github: i.updated_at,
          source: "api"
        },
        { onConflict: "project_repo_id,github_number" }
      );
    }
    await setEtag(repo.id, "issues", issuesRes.etag);
  } else {
    await setEtag(repo.id, "issues", issuesRes.etag);
  }
}

export async function runPoll() {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("project_repos").select("id,repo_full_name");
  if (error) throw error;
  for (const repo of (data ?? []) as ProjectRepoRow[]) {
    try {
      await syncRepo(repo);
    } catch (err) {
      console.error(`Sync failed for ${repo.repo_full_name}`, err);
    }
  }
}

const isMain = process.argv[1]?.endsWith("poll.ts");
if (isMain) {
  runPoll()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
