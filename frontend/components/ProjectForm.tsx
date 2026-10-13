"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase-client";
import { PROJECT_STATUSES, type ProjectStatus } from "../lib/types";

export function ProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("building");
  const [labels, setLabels] = useState("");
  const [repos, setRepos] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const ownerId = userData.user?.id;
      if (!ownerId) throw new Error("Login required");
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({ owner_id: ownerId, name, description, status })
        .select()
        .single();
      if (projectError) throw projectError;
      const labelNames = labels.split(",").map((s) => s.trim()).filter(Boolean);
      if (labelNames.length > 0) {
        const { error: labelError } = await supabase
          .from("labels")
          .insert(labelNames.map((n) => ({ project_id: project.id, name: n })));
        if (labelError) throw labelError;
      }
      const repoNames = repos.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      for (const r of repoNames) {
        if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(r)) throw new Error(`Invalid repo full name: ${r}`);
      }
      if (repoNames.length > 0) {
        const { error: repoError } = await supabase
          .from("project_repos")
          .insert(repoNames.map((repo_full_name) => ({ project_id: project.id, repo_full_name })));
        if (repoError) throw repoError;
      }
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 520 }}>
      <div className="field"><label htmlFor="pname">Project name</label><input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
      <div className="field"><label htmlFor="pdesc">Description</label><textarea id="pdesc" className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="field"><label htmlFor="pstatus">Status</label>
        <select id="pstatus" className="input" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
          {PROJECT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
      </div>
      <div className="field"><label htmlFor="plabels">Labels</label><input id="plabels" className="input" placeholder="frontend, side-project" value={labels} onChange={(e) => setLabels(e.target.value)} /></div>
      <div className="field"><label htmlFor="prepos">Public repos</label><input id="prepos" className="input" placeholder="owner/repo" value={repos} onChange={(e) => setRepos(e.target.value)} /></div>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Saving" : "Create project"}</button>
    </form>
  );
}
