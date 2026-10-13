import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { StatusBadge } from "../../../components/StatusBadge";
import { SyncButton } from "../../../components/SyncButton";
import { relativeTime } from "../../../lib/format";
import Link from "next/link";

interface CommitRow {
  github_sha: string;
  message: string;
  author_login: string | null;
  url: string;
  committed_at: string;
}

interface PullRow {
  github_number: number;
  title: string;
  state: string;
  author_login: string | null;
  url: string;
  updated_at_github: string;
}

interface IssueRow {
  github_number: number;
  title: string;
  state: string;
  author_login: string | null;
  url: string;
  updated_at_github: string;
}

function stateTagClass(state: string) {
  if (state === "open") return "tag tag-accent-2";
  if (state === "merged") return "tag tag-accent";
  return "tag tag-neutral";
}

function firstName(message: string) {
  return message.split("\n")[0];
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) return <p>Project not found.</p>;

  const { data: userData } = await supabase.auth.getUser();
  const isOwner = userData.user?.id === project.owner_id;

  const { data: labels } = await supabase.from("labels").select("*").eq("project_id", params.id);
  const { data: repos } = await supabase.from("project_repos").select("*").eq("project_id", params.id);
  const primary = (repos ?? [])[0] ?? null;
  const repoIds = (repos ?? []).map((r) => r.id);

  let commits: CommitRow[] = [];
  let pulls: PullRow[] = [];
  let issues: IssueRow[] = [];
  if (repoIds.length > 0) {
    const { data: c } = await supabase.from("commits").select("*").in("project_repo_id", repoIds).order("committed_at", { ascending: false }).limit(100);
    const { data: p } = await supabase.from("pull_requests").select("*").in("project_repo_id", repoIds).order("updated_at_github", { ascending: false }).limit(100);
    const { data: i } = await supabase.from("issues").select("*").in("project_repo_id", repoIds).order("updated_at_github", { ascending: false }).limit(100);
    commits = (c ?? []) as CommitRow[];
    pulls = (p ?? []) as PullRow[];
    issues = (i ?? []) as IssueRow[];
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
          {primary ? (
            <a href={"https://github.com/" + primary.repo_full_name} style={{ textDecoration: "none" }}>{primary.repo_full_name}</a>
          ) : project.name}
        </h1>
        <StatusBadge status={project.status} />
      </div>
      {project.description ? <p>{project.description}</p> : null}
      {(labels ?? []).length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(labels ?? []).map((l: { id: string; name: string }) => (<span key={l.id} className="tag tag-neutral">{l.name}</span>))}
        </div>
      ) : null}
      {isOwner ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link className="btn btn-secondary" href={"/projects/" + params.id + "/edit"}>Edit</Link>
          {primary ? <SyncButton repos={[{ id: primary.id, repo_full_name: primary.repo_full_name }]} /> : null}
        </div>
      ) : null}

      <div className="grid-3">
        <div className="card" style={{ background: "var(--panel-1)" }}>
          <div className="card-kicker">Commits</div>
          <div className="card-title" style={{ fontSize: 32, margin: "4px 0 8px" }}>{commits.length}</div>
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
          <div className="card-title" style={{ fontSize: 32, margin: "4px 0 8px" }}>{pulls.length}</div>
          <p className="card-body" style={{ margin: 0 }}>{openPulls + " open, " + mergedPulls + " merged"}</p>
          {latestPull ? <div className="card-meta">{latestPull.title}</div> : null}
        </div>
        <div className="card" style={{ background: "var(--panel-3)" }}>
          <div className="card-kicker">Issues</div>
          <div className="card-title" style={{ fontSize: 32, margin: "4px 0 8px" }}>{issues.length}</div>
          <p className="card-body" style={{ margin: 0 }}>{openIssues + " open, " + closedIssues + " closed"}</p>
          {latestIssue ? <div className="card-meta">{latestIssue.title}</div> : null}
        </div>
      </div>

      <section style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Commits</h2>
        {commits.length === 0 ? (
          <p className="card-body">No commits synced yet.</p>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            {commits.map((c, idx) => (
              <div key={c.github_sha} style={{ padding: "14px 22px", borderTop: idx === 0 ? "none" : "1px solid var(--color-divider)" }}>
                <a href={c.url}>{firstName(c.message)}</a>
                <div className="card-meta" style={{ marginTop: 2 }}>{(c.author_login ?? "unknown author") + ", " + relativeTime(c.committed_at)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Pull requests</h2>
        {pulls.length === 0 ? (
          <p className="card-body">No pull requests synced yet.</p>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            {pulls.map((p, idx) => (
              <div key={p.github_number} style={{ padding: "14px 22px", borderTop: idx === 0 ? "none" : "1px solid var(--color-divider)" }}>
                <a href={p.url}>{"#" + p.github_number + " " + p.title}</a>{" "}
                <span className={stateTagClass(p.state)}>{p.state}</span>
                <div className="card-meta" style={{ marginTop: 2 }}>{(p.author_login ?? "unknown author") + ", " + relativeTime(p.updated_at_github)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Issues</h2>
        {issues.length === 0 ? (
          <p className="card-body">No issues synced yet.</p>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            {issues.map((i, idx) => (
              <div key={i.github_number} style={{ padding: "14px 22px", borderTop: idx === 0 ? "none" : "1px solid var(--color-divider)" }}>
                <a href={i.url}>{"#" + i.github_number + " " + i.title}</a>{" "}
                <span className={stateTagClass(i.state)}>{i.state}</span>
                <div className="card-meta" style={{ marginTop: 2 }}>{(i.author_login ?? "unknown author") + ", " + relativeTime(i.updated_at_github)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
