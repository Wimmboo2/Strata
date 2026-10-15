import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { StatusPicker } from "../../../components/StatusPicker";
import { LabelChips } from "../../../components/LabelChips";
import { SyncButton } from "../../../components/SyncButton";
import { repoPageUrl } from "../../../lib/urls";
import { ActivityList, type CommitItem, type PullItem, type IssueItem } from "../../../components/ActivityList";
import { CountUp } from "../../../components/CountUp";
import { relativeTime } from "../../../lib/format";
import type { ProjectStatus } from "../../../lib/types";
import Link from "next/link";

function firstName(message: string) {
  return message.split("\n")[0];
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();

  const [projectRes, userRes, labelsRes, reposRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", params.id).single(),
    supabase.auth.getUser(),
    supabase.from("labels").select("*").eq("project_id", params.id),
    supabase.from("project_repos").select("*").eq("project_id", params.id)
  ]);

  const project = projectRes.data;
  if (!project) return <p>Project not found.</p>;

  const sessionUser = userRes.data.user ?? null;
  const isOwner = sessionUser?.id === project.owner_id;
  const labels = (labelsRes.data ?? []) as { id: string; name: string }[];
  const repos = (reposRes.data ?? []) as { id: string; repo_full_name: string }[];
  const primary = repos[0] ?? null;
  const primaryHref = primary ? repoPageUrl(primary.repo_full_name) : null;
  const repoIds = repos.map((r) => r.id);

  let commits: CommitItem[] = [];
  let pulls: PullItem[] = [];
  let issues: IssueItem[] = [];
  let suggestions: string[] = [];

  if (repoIds.length > 0) {
    const [cRes, pRes, iRes] = await Promise.all([
      supabase.from("commits").select("*").in("project_repo_id", repoIds).order("committed_at", { ascending: false }).limit(100),
      supabase.from("pull_requests").select("*").in("project_repo_id", repoIds).order("updated_at_github", { ascending: false }).limit(100),
      supabase.from("issues").select("*").in("project_repo_id", repoIds).order("updated_at_github", { ascending: false }).limit(100)
    ]);
    commits = (cRes.data ?? []) as CommitItem[];
    pulls = (pRes.data ?? []) as PullItem[];
    issues = (iRes.data ?? []) as IssueItem[];
  }

  if (isOwner && sessionUser) {
    const { data: ownProjects } = await supabase.from("projects").select("id").eq("owner_id", sessionUser.id);
    const ownIds = (ownProjects ?? []).map((p) => p.id);
    if (ownIds.length > 0) {
      const { data: ownLabels } = await supabase.from("labels").select("name").in("project_id", ownIds);
      suggestions = Array.from(new Set((ownLabels ?? []).map((l) => l.name as string))).sort();
    }
  }

  const latestCommit = commits[0] ?? null;
  const latestPull = pulls[0] ?? null;
  const latestIssue = issues[0] ?? null;
  const openPulls = pulls.filter((p) => p.state === "open").length;
  const mergedPulls = pulls.filter((p) => p.state === "merged").length;
  const openIssues = issues.filter((i) => i.state === "open").length;
  const closedIssues = issues.filter((i) => i.state === "closed").length;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0 }}>
          {primary && primaryHref ? (
            <a href={primaryHref} style={{ textDecoration: "none" }}>{primary.repo_full_name}</a>
          ) : primary ? (
            <span>{primary.repo_full_name}</span>
          ) : (
            project.name
          )}
        </h1>
        <StatusPicker projectId={project.id} status={project.status as ProjectStatus} editable={isOwner} />
      </div>
      {project.description ? <p>{project.description}</p> : null}
      <div className="dropdown-wrap">
        <LabelChips projectId={project.id} labels={labels.map((l) => l.name)} editable={isOwner} suggestions={suggestions} />
      </div>
      {isOwner ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link className="btn btn-secondary" href={"/projects/" + params.id + "/edit"}>Edit details</Link>
          {primary ? <SyncButton repos={[{ id: primary.id, repo_full_name: primary.repo_full_name }]} /> : null}
        </div>
      ) : null}

      <div className="grid-3">
        <div className="card" style={{ background: "var(--panel-1)" }}>
          <div className="card-kicker">Commits</div>
          <div className="stat-number" style={{ margin: "4px 0 8px" }}><CountUp value={commits.length} /></div>
          {latestCommit ? (
            <>
              <p className="card-body" style={{ margin: 0 }}>{firstName(latestCommit.message)}</p>
              <div className="card-meta">{(latestCommit.author_login ?? "unknown author") + ", " + relativeTime(latestCommit.committed_at)}</div>
            </>
          ) : (
            <p className="card-body" style={{ margin: 0 }}>Nothing synced yet. Press Sync.</p>
          )}
        </div>
        <div className="card" style={{ background: "var(--panel-2)" }}>
          <div className="card-kicker">Pull requests</div>
          <div className="stat-number" style={{ margin: "4px 0 8px" }}><CountUp value={pulls.length} /></div>
          <p className="card-body" style={{ margin: 0 }}>{openPulls + " open, " + mergedPulls + " merged"}</p>
          {latestPull ? <div className="card-meta">{latestPull.title}</div> : null}
        </div>
        <div className="card" style={{ background: "var(--panel-3)" }}>
          <div className="card-kicker">Issues</div>
          <div className="stat-number" style={{ margin: "4px 0 8px" }}><CountUp value={issues.length} /></div>
          <p className="card-body" style={{ margin: 0 }}>{openIssues + " open, " + closedIssues + " closed"}</p>
          {latestIssue ? <div className="card-meta">{latestIssue.title}</div> : null}
        </div>
      </div>

      <section style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Commits</h2>
        {commits.length === 0 ? (
          <p className="card-body">No commits synced yet.</p>
        ) : (
          <ActivityList kind="commit" items={commits} />
        )}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Pull requests</h2>
        {pulls.length === 0 ? (
          <p className="card-body">No pull requests synced yet.</p>
        ) : (
          <ActivityList kind="pr" items={pulls} />
        )}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Issues</h2>
        {issues.length === 0 ? (
          <p className="card-body">No issues synced yet.</p>
        ) : (
          <ActivityList kind="issue" items={issues} />
        )}
      </section>
    </div>
  );
}
