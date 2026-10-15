import { getAdminClient } from "../lib/supabase-admin";
import { isValidGithubSha, isValidRepoFullName, normalizeRepoFullName, safeGithubUrl } from "../lib/urls";

interface RepoRef {
  id: string;
  project_id: string;
  repo_full_name: string;
}

async function findReposByFullName(fullName: string): Promise<RepoRef[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("project_repos").select("*").eq("repo_full_name", fullName.toLowerCase());
  if (error) throw error;
  return (data ?? []) as RepoRef[];
}

async function touchSync(repoId: string) {
  const supabase = getAdminClient();
  const resources = ["commits", "pulls", "issues"];
  for (const resource of resources) {
    await supabase.from("sync_state").upsert(
      { project_repo_id: repoId, resource, last_synced_at: new Date().toISOString() },
      { onConflict: "project_repo_id,resource" }
    );
  }
}

export async function handlePush(payload: { repository?: { full_name?: string }; commits?: { id: string; message: string; author?: { username?: string }; url?: string; timestamp?: string }[] }) {
  const rawName = payload.repository?.full_name;
  if (!isValidRepoFullName(rawName)) return;
  const fullName = normalizeRepoFullName(rawName);
  const repos = await findReposByFullName(fullName);
  const supabase = getAdminClient();
  for (const repo of repos) {
    for (const c of payload.commits ?? []) {
      if (!isValidGithubSha(c.id)) continue;
      const url = safeGithubUrl(c.url) ?? `https://github.com/${fullName}/commit/${c.id}`;
      await supabase.from("commits").upsert(
        {
          project_repo_id: repo.id,
          github_sha: c.id,
          message: typeof c.message === "string" ? c.message : "",
          author_login: c.author?.username ?? null,
          url,
          committed_at: c.timestamp ?? new Date().toISOString(),
          source: "webhook"
        },
        { onConflict: "project_repo_id,github_sha" }
      );
    }
    await touchSync(repo.id);
  }
}

export async function handlePullRequest(payload: {
  action?: string;
  repository?: { full_name?: string };
  pull_request?: { number: number; title: string; state: string; merged?: boolean; user?: { login?: string }; html_url: string; updated_at: string };
}) {
  const rawName = payload.repository?.full_name;
  const pr = payload.pull_request;
  if (!isValidRepoFullName(rawName) || !pr) return;
  const fullName = normalizeRepoFullName(rawName);
  const repos = await findReposByFullName(fullName);
  const supabase = getAdminClient();
  const state = pr.merged ? "merged" : pr.state;
  const url = safeGithubUrl(pr.html_url);
  if (url === null || !Number.isInteger(pr.number)) return;
  for (const repo of repos) {
    await supabase.from("pull_requests").upsert(
      {
        project_repo_id: repo.id,
        github_number: pr.number,
        title: typeof pr.title === "string" ? pr.title : "",
        state,
        author_login: pr.user?.login ?? null,
        url,
        updated_at_github: pr.updated_at,
        source: "webhook"
      },
      { onConflict: "project_repo_id,github_number" }
    );
    await touchSync(repo.id);
  }
}

export async function handleIssues(payload: {
  repository?: { full_name?: string };
  issue?: { number: number; title: string; state: string; user?: { login?: string }; html_url: string; updated_at: string; pull_request?: unknown };
}) {
  const rawName = payload.repository?.full_name;
  const issue = payload.issue;
  if (!isValidRepoFullName(rawName) || !issue) return;
  if (issue.pull_request) return;
  const repos = await findReposByFullName(normalizeRepoFullName(rawName));
  const supabase = getAdminClient();
  const url = safeGithubUrl(issue.html_url);
  if (url === null || !Number.isInteger(issue.number)) return;
  for (const repo of repos) {
    await supabase.from("issues").upsert(
      {
        project_repo_id: repo.id,
        github_number: issue.number,
        title: typeof issue.title === "string" ? issue.title : "",
        state: issue.state,
        author_login: issue.user?.login ?? null,
        url,
        updated_at_github: issue.updated_at,
        source: "webhook"
      },
      { onConflict: "project_repo_id,github_number" }
    );
    await touchSync(repo.id);
  }
}

export async function handleInstallation(payload: { action?: string; installation?: { id: number; account?: { login?: string } } }) {
  const installation = payload.installation;
  if (!installation) return;
  if (payload.action === "deleted") {
    const supabase = getAdminClient();
    await supabase.from("github_installations").delete().eq("installation_id", installation.id);
    return;
  }
  if (payload.action !== "created" && payload.action !== "new_permissions_accepted") return;
  // Owner linkage is completed via the install callback's single-use setup
  // token (see webhooks/install.ts). A bare webhook cannot map an
  // installation to a Strata user, so only refresh rows already linked.
  const supabase = getAdminClient();
  const { data: known } = await supabase.from("github_installations").select("*").eq("installation_id", installation.id).single();
  if (known) {
    await supabase
      .from("github_installations")
      .update({ github_account_login: installation.account?.login ?? known.github_account_login })
      .eq("installation_id", installation.id);
  }
}
