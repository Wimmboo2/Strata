import { createServerSupabaseClient } from "../../lib/supabase-server";
import { DashboardClient } from "../../components/DashboardClient";
import type { Project } from "../../lib/types";

export default async function ProjectsPage() {
  const supabase = createServerSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id ?? null;

  const [projectsRes, labelsRes, reposRes] = await Promise.all([
    supabase.from("projects").select("*").order("updated_at", { ascending: false }),
    supabase.from("labels").select("*"),
    supabase.from("project_repos").select("id,repo_full_name,project_id,pushed_at")
  ]);

  const projects = (projectsRes.data ?? []) as Project[];
  const labelsByProject: Record<string, string[]> = {};
  for (const row of labelsRes.data ?? []) {
    if (!labelsByProject[row.project_id]) labelsByProject[row.project_id] = [];
    labelsByProject[row.project_id].push(row.name);
  }
  const ownIds = new Set(projects.filter((p) => p.owner_id === userId).map((p) => p.id));
  const myRepos = (reposRes.data ?? [])
    .filter((r) => ownIds.has(r.project_id))
    .map((r) => ({ id: r.id as string, repo_full_name: r.repo_full_name as string }))
    .filter((r) => r.repo_full_name.split("/").length === 2);

  const repoActivity: Record<string, string> = {};
  for (const r of reposRes.data ?? []) {
    const pushed = r.pushed_at as string | null;
    if (!pushed) continue;
    const current = repoActivity[r.project_id];
    if (!current || pushed > current) repoActivity[r.project_id] = pushed;
  }

  return (
    <DashboardClient
      initialProjects={projects}
      initialLabelsByProject={labelsByProject}
      initialMyRepos={myRepos}
      initialRepoActivity={repoActivity}
      initialAuthed={!!userId}
      initialUserId={userId}
    />
  );
}
