import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { StatusBadge } from "../../../components/StatusBadge";
import { ActivityFeed } from "../../../components/ActivityFeed";
import { AddRepoForm } from "../../../components/AddRepoForm";
import Link from "next/link";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) return <p>Project not found.</p>;
  const { data: labels } = await supabase.from("labels").select("*").eq("project_id", params.id);
  const { data: repos } = await supabase.from("project_repos").select("*").eq("project_id", params.id);
  const repoIds = (repos ?? []).map((r) => r.id);
  let commits: { github_sha: string; message: string; author_login: string | null; url: string; committed_at: string }[] = [];
  let pulls: { github_number: number; title: string; state: string; url: string; updated_at_github: string }[] = [];
  let issues: { github_number: number; title: string; state: string; url: string; updated_at_github: string }[] = [];
  if (repoIds.length > 0) {
    const { data: c } = await supabase.from("commits").select("*").in("project_repo_id", repoIds).order("committed_at", { ascending: false }).limit(100);
    const { data: p } = await supabase.from("pull_requests").select("*").in("project_repo_id", repoIds).order("updated_at_github", { ascending: false }).limit(100);
    const { data: i } = await supabase.from("issues").select("*").in("project_repo_id", repoIds).order("updated_at_github", { ascending: false }).limit(100);
    commits = (c ?? []) as typeof commits;
    pulls = (p ?? []) as typeof pulls;
    issues = (i ?? []) as typeof issues;
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0 }}>{project.name}</h1>
        <StatusBadge status={project.status} />
      </div>
      <p>{project.description}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(labels ?? []).map((l: { id: string; name: string }) => (<span key={l.id} className="tag tag-neutral">{l.name}</span>))}
      </div>
      <div className="card">
        <div className="card-kicker">Repos</div>
        <div className="card-title">Linked public repos</div>
        <ul>
          {(repos ?? []).map((r: { id: string; repo_full_name: string }) => (<li key={r.id}>{r.repo_full_name}</li>))}
        </ul>
        <AddRepoForm projectId={params.id} />
      </div>
      <p><Link className="btn btn-secondary" href={`/projects/${params.id}/edit`}>Edit project</Link></p>
      <ActivityFeed commits={commits} pulls={pulls} issues={issues} />
    </div>
  );
}
